import * as THREE from "three";
import INSTANCE_COLOR_FRAGMENT_GLSL from "./instanceColorGLSL";

// An unlit square in its instance's color, or what an instance draws within it instead (see EmissiveGlyph): a face on
// a dark screen, or a battery with some of its cells lit, drawn by the fragment shader from a handful of numbers, so
// that every such square in a room is one mesh and one draw call, whatever each shows. An instance may also dim with the
// camera's distance (see EMISSIVE_DIM_START_DISTANCE). A mesh that sets neither attribute draws plain squares.

// Per instance: (what it draws: 0 its color, 1 a face, 2 a battery; whether it dims with distance; a face's eye style
// plus EMISSIVE_ANIMATION_STEP times its animations; how much of its glow shows), and (a face's eye opening, mouth curve
// and mouth opening; a battery's lit cells).
export const EMISSIVE_GLYPH_ATTRIBUTE = "emissiveGlyph";
export const EMISSIVE_GLYPH_SHAPE_ATTRIBUTE = "emissiveGlyphShape";
export const EMISSIVE_KIND_FACE = 1;
export const EMISSIVE_KIND_BATTERY = 2;
// A face's animations, added up: it blinks now and then, its eyes keep drooping shut, and it flickers on and off.
export const EMISSIVE_ANIMATION_STEP = 4;
export const EMISSIVE_ANIMATION_BLINK = 1;
export const EMISSIVE_ANIMATION_DROOP = 2;
export const EMISSIVE_ANIMATION_FLICKER = 4;
// A dimming instance shows all of its glow up to this far from the camera, in world units, and none from this far.
export const EMISSIVE_DIM_START_DISTANCE = 5;
export const EMISSIVE_DIM_END_DISTANCE = 20;
// How long a blink's shut eyes last, in seconds, how long a droop takes to come round, and how long a flicker's
// light and its dark each last.
export const EMISSIVE_BLINK_SECONDS = 0.13;
export const EMISSIVE_DROOP_SECONDS = 3.2;
export const EMISSIVE_FLICKER_SECONDS = 0.45;

// The clock the animations run by, in seconds, wrapped so that it keeps its precision. The holder is never replaced:
// three.js re-reads "value" each frame.
const TIME_WRAP_SECONDS = 3600;
const emissiveTimeUniform = {value: 0};

export function setEmissiveShaderTime(seconds: number): void
{
    emissiveTimeUniform.value = seconds % TIME_WRAP_SECONDS;
}

const VERTEX_PARS_GLSL = `
    attribute vec4 ${EMISSIVE_GLYPH_ATTRIBUTE};
    attribute vec4 ${EMISSIVE_GLYPH_SHAPE_ATTRIBUTE};
    varying vec4 vEmissiveGlyph;
    varying vec4 vEmissiveShape;
    // (the square's own position .xy, each from -0.5 to 0.5; its width over its height .z; its instance's own
    // share of a second .w, which keeps instances from blinking together).
    varying vec4 vEmissiveQuad;
    varying float vEmissiveGlow;
`;

// After <project_vertex>, which gives mvPosition.
const VERTEX_GLSL = `
    vEmissiveGlyph = ${EMISSIVE_GLYPH_ATTRIBUTE};
    vEmissiveShape = ${EMISSIVE_GLYPH_SHAPE_ATTRIBUTE};
    #ifdef USE_INSTANCING
        float emissiveAspect = length(instanceMatrix[0].xyz) / max(length(instanceMatrix[1].xyz), 0.00001);
        float emissiveSeed = fract(float(gl_InstanceID) * 0.6180339887);
    #else
        float emissiveAspect = 1.0;
        float emissiveSeed = 0.0;
    #endif
    vEmissiveQuad = vec4(position.xy, emissiveAspect, emissiveSeed);
    vEmissiveGlow = (vEmissiveGlyph.y > 0.5)
        ? clamp((${EMISSIVE_DIM_END_DISTANCE.toFixed(1)} - length(mvPosition.xyz))
            / ${(EMISSIVE_DIM_END_DISTANCE - EMISSIVE_DIM_START_DISTANCE).toFixed(1)}, 0.0, 1.0)
        : 1.0;
`;

const FRAGMENT_PARS_GLSL = `
    uniform float emissiveTime;
    varying vec4 vEmissiveGlyph;
    varying vec4 vEmissiveShape;
    varying vec4 vEmissiveQuad;
    varying float vEmissiveGlow;

    // Linear-space colors: a screen switched on but showing nothing, an unlit battery cell, and a battery's casing.
    const vec3 EMISSIVE_SCREEN_COLOR = vec3(0.034, 0.036, 0.038);
    const vec3 EMISSIVE_CELL_COLOR = vec3(0.022, 0.024, 0.024);
    const vec3 EMISSIVE_CASING_COLOR = vec3(0.19, 0.20, 0.20);

    // Signed distances, negative inside: a box with rounded corners, a round-ended stroke between two points.
    float emissiveRoundBox(vec2 p, vec2 halfSize, float radius)
    {
        vec2 q = abs(p) - halfSize + radius;
        return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
    }
    float emissiveStroke(vec2 p, vec2 a, vec2 b, float halfWidth)
    {
        vec2 ab = b - a;
        float along = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
        return length(p - a - ab * along) - halfWidth;
    }

    // One eye, about its own middle. towardNose: +1 or -1, the side its other eye is on.
    float emissiveEye(vec2 p, float towardNose, float open, float style)
    {
        const float RADIUS = 0.105;
        if (style > 1.5) // crossed
        {
            float reach = 0.8 * RADIUS;
            return min(emissiveStroke(p, vec2(-reach, -reach), vec2(reach, reach), 0.026),
                emissiveStroke(p, vec2(-reach, reach), vec2(reach, -reach), 0.026));
        }
        // Shut, a line; opening, an oval growing taller; past open, a larger circle.
        float wide = max(open, 1.0);
        float radius = RADIUS * sqrt(wide);
        float tall = max(min(open, 1.0), 0.0);
        float lineDist = emissiveStroke(p, vec2(-radius, 0.0), vec2(radius, 0.0), 0.02);
        float ovalDist = (length(vec2(p.x, p.y / max(tall, 0.001))) - radius) * max(tall, 0.2);
        float dist = (tall < 0.16) ? lineDist : min(ovalDist, lineDist + 0.02 * (1.0 - tall));
        if (style > 0.5 && tall >= 0.16) // slanted: cut from above by a lid that falls toward the nose
            dist = max(dist, (p.y - 0.3 * radius) + 0.85 * p.x * towardNose);
        return dist;
    }

    // The mouth, about its own middle: a crescent curving up (curve 1) or down (-1), a level line (0), or an "O".
    float emissiveMouth(vec2 p, float curve, float open)
    {
        if (open > 0.5)
            return abs(length(p) - 0.075) - 0.026;
        const float HALF_WIDTH = 0.29;
        const float DEPTH = 0.115;
        float across = clamp(p.x / HALF_WIDTH, -1.0, 1.0);
        float arch = 1.0 - across * across;
        float middle = -curve * DEPTH * arch + 0.5 * curve * DEPTH;
        float halfThick = mix(0.02, 0.014 + 0.036 * arch, min(abs(curve), 1.0));
        return max(abs(p.y - middle) - halfThick, abs(p.x) - HALF_WIDTH);
    }
`;

// After <color_fragment> and the instance color: diffuseColor is the color the instance lights up in.
const FRAGMENT_GLSL = `
    ${INSTANCE_COLOR_FRAGMENT_GLSL}
    {
        float emissiveKind = vEmissiveGlyph.x;
        vec3 emissiveLight = diffuseColor.rgb * vEmissiveGlow;
        if (emissiveKind < 0.5)
            diffuseColor.rgb = emissiveLight;
        else
        {
            // In units of the square's height, about its middle.
            vec2 p = vec2(vEmissiveQuad.x * vEmissiveQuad.z, vEmissiveQuad.y);
            vec2 halfSize = vec2(0.5 * vEmissiveQuad.z, 0.5);
            float edge = max(fwidth(p.y), 0.0005);
            float time = emissiveTime + vEmissiveQuad.w * 17.0;
            float lit = 0.0;
            vec3 unlit = EMISSIVE_SCREEN_COLOR;

            if (emissiveKind < 1.5)
            {
                if (emissiveRoundBox(p, halfSize, 0.13) > 0.0)
                    discard;
                float animations = floor(vEmissiveGlyph.z / ${EMISSIVE_ANIMATION_STEP.toFixed(1)} + 0.001);
                float style = vEmissiveGlyph.z - animations * ${EMISSIVE_ANIMATION_STEP.toFixed(1)};
                bool blinks = mod(animations, 2.0) > 0.5;
                bool droops = mod(floor(animations / 2.0), 2.0) > 0.5;
                bool flickers = mod(floor(animations / 4.0), 2.0) > 0.5;

                float open = vEmissiveShape.x;
                if (droops)
                    open *= clamp(0.5 + 0.9 * sin(time * ${(2 * Math.PI / EMISSIVE_DROOP_SECONDS).toFixed(4)}), 0.0, 1.0);
                if (blinks && fract(time / (3.1 + 2.0 * vEmissiveQuad.w)) < ${EMISSIVE_BLINK_SECONDS.toFixed(2)} / 3.1)
                    open = 0.0;
                float glow = vEmissiveGlyph.w;
                if (flickers && fract(time / ${(2 * EMISSIVE_FLICKER_SECONDS).toFixed(2)}) > 0.5)
                    glow = 0.0;

                vec2 eyeOffset = vec2(0.24 * vEmissiveQuad.z, 0.12);
                float dist = min(
                    emissiveEye(p - vec2(-eyeOffset.x, eyeOffset.y), 1.0, open, style),
                    emissiveEye(p - eyeOffset, -1.0, open, style));
                dist = min(dist, emissiveMouth(p - vec2(0.0, -0.2), vEmissiveShape.y, vEmissiveShape.z));
                // What is lit, and the glass's glow around it.
                lit = (1.0 - smoothstep(-edge, edge, dist)) + 0.22 * exp(-max(dist, 0.0) * 26.0);
                // Scan lines, faded out where they would be finer than the pixels showing them.
                float lines = 0.86 + 0.14 * sin(p.y * 6.2831853 * 30.0);
                lit *= glow * mix(1.0, lines, clamp(1.0 - edge * 60.0, 0.0, 1.0));
                unlit *= 1.0 - 0.35 * dot(p / halfSize, p / halfSize) * 0.5;
            }
            else
            {
                // The casing with its nub to the right, and three cells in it.
                vec2 casingMiddle = vec2(-0.07 * halfSize.x, 0.0);
                vec2 casingHalf = vec2(0.86 * halfSize.x, 0.42);
                float casing = emissiveRoundBox(p - casingMiddle, casingHalf, 0.1);
                float nub = emissiveRoundBox(p - vec2(0.89 * halfSize.x, 0.0), vec2(0.08 * halfSize.x, 0.17), 0.04);
                if (min(casing, nub) > 0.0)
                    discard;
                unlit = EMISSIVE_CASING_COLOR;
                vec2 inner = casingHalf - 0.09;
                float cellHalf = (inner.x - 0.06) / 3.0;
                for (int i = 0; i < 3; ++i)
                {
                    vec2 cellMiddle = casingMiddle + vec2((float(i) - 1.0) * (2.0 * cellHalf + 0.06), 0.0);
                    float cell = emissiveRoundBox(p - cellMiddle, vec2(cellHalf, inner.y), 0.03);
                    float inside = 1.0 - smoothstep(-edge, edge, cell);
                    unlit = mix(unlit, EMISSIVE_CELL_COLOR, inside);
                    if (float(i) < vEmissiveShape.w - 0.5)
                        lit = max(lit, inside);
                }
            }
            diffuseColor.rgb = unlit + emissiveLight * lit;
        }
    }
`;

export default function installInstancedEmissiveShader(shader: THREE.WebGLProgramParametersWithUniforms)
{
    shader.uniforms.emissiveTime = emissiveTimeUniform;

    shader.vertexShader = VERTEX_PARS_GLSL + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
        "#include <project_vertex>",
        `
        #include <project_vertex>
        ${VERTEX_GLSL}
        `
    );

    shader.fragmentShader = FRAGMENT_PARS_GLSL + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        `
        #include <color_fragment>
        ${FRAGMENT_GLSL}
        `
    );
}
