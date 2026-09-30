import * as THREE from "three";
import Vec3 from "../../../shared/math/types/vec3";
import Geometry3DUtil from "../../../shared/math/util/geometry3DUtil";
import { ParticleRenderState } from "../../../shared/graphics/particle/types/particleRenderState";
import { DIR_VEC_BY_CODE } from "../../../shared/system/sharedConstants";
import VALUE_NOISE_GLSL from "./valueNoiseGLSL";
import WAVEFORM_GLSL from "./waveformGLSL";
import { LIGHT_BLOCK_MAP_SAMPLE_PARS_GLSL } from "./lightBlockMapGLSL";

// Particles and animated sprites, spliced into a stock material (MeshBasicMaterial for the blended batch,
// MeshPhongMaterial for the solid one). The vertex stage computes everything about an instance from its
// starting state and the clock (see ParticleBatch for the per-instance layout, ParticleParamTextureUtil
// for the parameter rows), so the CPU never touches a particle after its birth.

// Per-instance attributes, four vec4s each.
export const PARTICLE_DATA_ATTRIBUTES = ["particleData0", "particleData1", "particleData2", "particleData3"];

// The parameter texture: one row per layer or sprite definition, of these texels.
export const PARTICLE_PARAM_ROW_TEXELS = 16;
export const PARTICLE_CURVE_SAMPLES = 8;
export const PARTICLE_PARAM_TEXEL = {
    atlasRect: 0, // u, v, width and height of frame 0; later frames follow along u
    animation: 1, // frame count, frames per second (0 = once over its life), kind, orientation
    motion: 2, // gravity, drag, turbulence, stretch
    look: 3, // additiveness, lit, spin min, spin max
    sprite: 4, // turns per unit of phase, frames per unit of phase, level alpha, level size
    spriteColor: 5, // linear rgb
    colorCurve: 6, // linear rgb and alpha, one sample per texel
    sizeCurve: 14, // four samples per texel
};
export const PARTICLE_KIND_CODE = {particle: 0, sprite: 1};
export const PARTICLE_ORIENTATION_CODE = {camera: 0, velocity: 1};

function vec3GLSL(v: Vec3): string
{
    return `vec3(${v.x.toFixed(1)}, ${v.y.toFixed(1)}, ${v.z.toFixed(1)})`;
}

// Each facing's frame, by direction code (see DIR_VEC_BY_CODE), exactly as attached objects lay out.
const FACING_BASES = DIR_VEC_BY_CODE.map(dir => Geometry3DUtil.getAxisFacingBasis(dir));
const FACING_GLSL = `
    const vec3 PARTICLE_FACING_NORMAL[6] = vec3[6](${FACING_BASES.map(b => vec3GLSL(b.normal)).join(", ")});
    const vec3 PARTICLE_FACING_RIGHT[6] = vec3[6](${FACING_BASES.map(b => vec3GLSL(b.right)).join(", ")});
    const vec3 PARTICLE_FACING_UP[6] = vec3[6](${FACING_BASES.map(b => vec3GLSL(b.up)).join(", ")});
`;

const T = PARTICLE_PARAM_TEXEL;

const PARTICLE_VERTEX_PARS_GLSL = `
    attribute vec4 particleData0;
    attribute vec4 particleData1;
    attribute vec4 particleData2;
    attribute vec4 particleData3;
    uniform float particleTime;
    uniform highp sampler2D particleParams;
    varying vec4 vParticleColor;
    varying float vParticleAdditive;
    ${VALUE_NOISE_GLSL}
    ${WAVEFORM_GLSL}
    ${FACING_GLSL}

    const float PARTICLE_TAU = 6.28318530718;
    const int PARTICLE_CURVE_SAMPLES = ${PARTICLE_CURVE_SAMPLES};
    // A particle this near the camera fades out, so a large quad never fills the screen.
    const float PARTICLE_NEAR_FADE_START = 0.3;
    const float PARTICLE_NEAR_FADE_END = 0.9;
    // A lit particle away from every lamp still shows faintly, like the room's ambient light.
    const float PARTICLE_LIT_FLOOR = 0.35;
    // How far above the floor a landed particle's middle is held, in its own sizes.
    const float PARTICLE_LANDING_LIFT = 0.3;

    vec4 particleParam(float row, int texel)
    {
        return texelFetch(particleParams, ivec2(texel, int(row + 0.5)), 0);
    }

    float particleHash(float seed, float salt)
    {
        return fract(sin(seed * 91.3458 + salt * 47.853) * 43758.5453);
    }

    vec4 particleColorCurve(float row, float life)
    {
        float x = clamp(life, 0.0, 1.0) * float(PARTICLE_CURVE_SAMPLES - 1);
        int i0 = int(floor(x));
        int i1 = min(i0 + 1, PARTICLE_CURVE_SAMPLES - 1);
        return mix(particleParam(row, ${T.colorCurve} + i0), particleParam(row, ${T.colorCurve} + i1),
            x - float(i0));
    }

    float particleSizeCurve(float row, float life)
    {
        float x = clamp(life, 0.0, 1.0) * float(PARTICLE_CURVE_SAMPLES - 1);
        int i0 = int(floor(x));
        int i1 = min(i0 + 1, PARTICLE_CURVE_SAMPLES - 1);
        float a = particleParam(row, ${T.sizeCurve} + i0 / 4)[i0 % 4];
        float b = particleParam(row, ${T.sizeCurve} + i1 / 4)[i1 % 4];
        return mix(a, b, x - float(i0));
    }

    // An sRGB "#rrggbb" packed as one integer (see ParticleColorUtil), linearized.
    vec3 particleUnpackTint(float packed)
    {
        vec3 srgb = vec3(floor(packed / 65536.0), mod(floor(packed / 256.0), 256.0), mod(packed, 256.0))
            / 255.0;
        return mix(srgb / 12.92, pow((srgb + 0.055) / 1.055, vec3(2.4)), step(0.04045, srgb));
    }

    // Where one corner of this instance's quad goes, which way the quad faces, and the corner's atlas UV.
    void particleCompute(vec2 corner, vec2 cornerUv, out vec3 worldPos, out vec3 worldNormal,
        out vec2 atlasUv)
    {
        float row = particleData2.x;
        vec4 rect = particleParam(row, ${T.atlasRect});
        vec4 animation = particleParam(row, ${T.animation});
        vec4 look = particleParam(row, ${T.look});
        float frames = max(animation.x, 1.0);

        vec3 center = particleData0.xyz;
        vec2 size = vec2(0.0); // stays zero for a dead instance, which collapses the quad
        vec4 color = vec4(0.0);
        float angle = 0.0;
        float frame = 0.0;
        // The camera's axes in world space: the rows of the view rotation.
        vec3 axisX = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 axisY = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        worldNormal = vec3(0.0, 0.0, 1.0);

        if (animation.z < 0.5) // transient particle
        {
            float age = particleTime - particleData0.w;
            float lifetime = particleData1.w;
            if (age >= 0.0 && age < lifetime)
            {
                float life = age / lifetime;
                vec4 motion = particleParam(row, ${T.motion});
                float drag = motion.y;
                // Closed-form motion under linear drag: how far the launch has carried it, and how far
                // gravity has pulled it.
                float carry = (drag > 0.0) ? (1.0 - exp(-drag * age)) / drag : age;
                float fall = (drag > 0.0) ? (age - carry) / drag : 0.5 * age * age;
                center = particleData0.xyz + particleData1.xyz * carry;
                center.y -= motion.x * fall;
                vec3 velocity = particleData1.xyz * exp(-drag * age);
                velocity.y -= motion.x * carry;
                if (motion.z > 0.0)
                {
                    center += valueNoiseWarp(center * 0.8 +
                        vec3(particleData2.y * 16.0, particleTime * 0.4, 0.0)) * (motion.z * life);
                }
                size = vec2(particleData2.z * particleSizeCurve(row, life));
                // Its drawn bottom rests on the floor, not its middle, so the floor doesn't cut it in half.
                center.y = max(center.y, particleData3.y + PARTICLE_LANDING_LIFT * size.y);

                vec4 curveColor = particleColorCurve(row, life);
                color = vec4(curveColor.rgb * particleUnpackTint(particleData2.w), curveColor.a);
                float spin = mix(look.z, look.w, particleHash(particleData2.y, 1.0));
                angle = particleHash(particleData2.y, 2.0) * PARTICLE_TAU + spin * age;
                frame = (animation.y > 0.0)
                    ? floor(age * animation.y + particleHash(particleData2.y, 3.0) * frames)
                    : floor(life * frames);

                if (animation.w > 0.5) // stretched along its motion, as the camera sees it
                {
                    vec3 toCamera = normalize(cameraPosition - center);
                    vec3 across = velocity - dot(velocity, toCamera) * toCamera;
                    float acrossLength = length(across);
                    if (acrossLength > 0.0001)
                    {
                        axisY = across / acrossLength;
                        axisX = normalize(cross(axisY, toCamera));
                        size.y *= 1.0 + motion.w * length(velocity);
                        angle = 0.0;
                    }
                }
            }
        }
        else if (particleData1.z > 0.0) // persistent sprite
        {
            int code = int(particleData1.x + 0.5);
            int facing = code / 4;
            float quarterTurns = float(code - facing * 4);
            float shape = floor(particleData2.z);
            float duty = particleData2.z - shape;
            vec4 wave = particleData3;
            float phase = particleData1.y + waveformIntegral(wave, shape, duty, particleData0.w, particleTime);
            float level = waveformShapeValue(shape, duty, wave.z * particleTime + wave.w);
            vec4 spriteAnimation = particleParam(row, ${T.sprite});
            vec3 spriteColor = particleParam(row, ${T.spriteColor}).rgb;

            axisX = PARTICLE_FACING_RIGHT[facing];
            axisY = PARTICLE_FACING_UP[facing];
            worldNormal = PARTICLE_FACING_NORMAL[facing];
            // Quarter turns run clockwise as seen from the front, spin counter-clockwise.
            angle = -quarterTurns * 0.25 * PARTICLE_TAU + fract(phase * spriteAnimation.x) * PARTICLE_TAU;
            frame = floor(phase * spriteAnimation.y);
            size = particleData1.zw * (1.0 - spriteAnimation.w * (1.0 - level));
            color = vec4(spriteColor * particleUnpackTint(particleData2.y),
                1.0 - spriteAnimation.z * (1.0 - level));
        }

        float c = cos(angle);
        float s = sin(angle);
        vec3 turnedX = axisX * c + axisY * s;
        vec3 turnedY = axisY * c - axisX * s;
        worldPos = center + turnedX * (corner.x * size.x) + turnedY * (corner.y * size.y);
        frame = mod(frame, frames);
        atlasUv = rect.xy + vec2((frame + cornerUv.x) * rect.z, cornerUv.y * rect.w);

        #ifdef PARTICLE_BLENDED
            color.a *= smoothstep(PARTICLE_NEAR_FADE_START, PARTICLE_NEAR_FADE_END,
                distance(center, cameraPosition));
            if (look.y > 0.5)
            {
                // Inside a block the map reads black rather than unlit, so keep the color there.
                float openness;
                vec3 lamp = lightBlockMapLightAt(center, openness);
                if (openness >= LIGHT_BLOCK_MAP_MIN_OPENNESS)
                    color.rgb *= PARTICLE_LIT_FLOOR + lamp;
            }
        #endif
        vParticleColor = color;
        vParticleAdditive = look.x;
    }
`;

const PARTICLE_FRAGMENT_PARS_GLSL = `
    varying vec4 vParticleColor;
    varying float vParticleAdditive;
`;

// After the atlas sample. The atlas is premultiplied (so its mipmaps don't darken edges), which is undone
// before tinting, and before the solid batch's alpha test.
const PARTICLE_COLOR_FRAGMENT_GLSL = `
    diffuseColor.rgb = (diffuseColor.a > 0.0) ? diffuseColor.rgb / diffuseColor.a : vec3(0.0);
    diffuseColor *= vParticleColor;
    #ifdef PARTICLE_BLENDED
        if (diffuseColor.a < 0.004)
            discard;
    #endif
`;

// After the fog (blended only). Additive light fades to nothing in fog rather than to the fog's color,
// and the output is premultiplied, with the additive share adding without covering what lies behind.
const PARTICLE_BLEND_FRAGMENT_GLSL = `
    #ifdef USE_FOG
        gl_FragColor.rgb = mix(gl_FragColor.rgb, particlePreFogColor * (1.0 - fogFactor), vParticleAdditive);
    #endif
    gl_FragColor.rgb *= gl_FragColor.a;
    gl_FragColor.a *= 1.0 - vParticleAdditive;
`;

// Leaves the stock includes in place, because addSampling and addFogNoise splice after this and anchor on
// them. Phong computes its normal before begin_vertex, so the instance is read before uv_vertex (the first
// chunk of both materials).
export default function installParticleShader(shader: THREE.WebGLProgramParametersWithUniforms,
    renderState: ParticleRenderState)
{
    const define = (renderState === "blended") ? "#define PARTICLE_BLENDED\n" : "";
    const lampSamplingPars = (renderState === "blended") ? LIGHT_BLOCK_MAP_SAMPLE_PARS_GLSL : "";

    shader.vertexShader = define + lampSamplingPars + PARTICLE_VERTEX_PARS_GLSL + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
        "#include <uv_vertex>",
        `
        vec3 particleWorldPos;
        vec3 particleWorldNormal;
        vec2 particleAtlasUv;
        particleCompute(position.xy, uv, particleWorldPos, particleWorldNormal, particleAtlasUv);
        #include <uv_vertex>
        vMapUv = particleAtlasUv;
        `
    );
    if (renderState === "solid")
    {
        shader.vertexShader = shader.vertexShader.replace(
            "#include <beginnormal_vertex>",
            `
            #include <beginnormal_vertex>
            objectNormal = particleWorldNormal;
            `
        );
    }
    shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `
        #include <begin_vertex>
        transformed = particleWorldPos;
        `
    );

    shader.fragmentShader = define + PARTICLE_FRAGMENT_PARS_GLSL + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `
        #include <map_fragment>
        ${PARTICLE_COLOR_FRAGMENT_GLSL}
        `
    );
    if (renderState === "blended")
    {
        shader.fragmentShader = shader.fragmentShader.replace(
            "#include <fog_fragment>",
            `
            vec3 particlePreFogColor = gl_FragColor.rgb;
            #include <fog_fragment>
            ${PARTICLE_BLEND_FRAGMENT_GLSL}
            `
        );
    }
}
