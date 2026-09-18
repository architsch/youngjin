import * as THREE from "three";
import { ATMOSPHERE_FOG_TINT_PARS_GLSL, ATMOSPHERE_GROUND_PARS_GLSL, ATMOSPHERE_PARS_GLSL,
    ATMOSPHERE_SMOKE_PARS_GLSL } from "./atmosphereGLSL";
import ValueNoiseTextureUtil from "../util/valueNoiseTextureUtil";
import { NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../../../shared/system/sharedConstants";

// Paints every uncovered pixel: sky color, clouds and land, then the room's fog over them (see
// atmosphereGLSL). A full-screen clip-space quad (drawn last; see AtmosphereMaterialUtil), installed
// on a stock unlit material so tone mapping, color conversion and fog match every other surface.

const VERTEX_PARS_GLSL = `
    varying vec2 vSkyScreenPos;
`;

// The quad already spans clip space. Written after the stock projection so downstream chunks still work.
const VERTEX_GLSL = `
    vSkyScreenPos = position.xy;
    gl_Position = vec4(position.xy, 1.0, 1.0);
`;

const FRAGMENT_PARS_GLSL = `
    varying vec2 vSkyScreenPos;
    uniform vec3 skyColor;
    uniform mat4 skyInverseProjection;
    uniform float skyFarDepth;
    ${ATMOSPHERE_PARS_GLSL}
    ${ATMOSPHERE_GROUND_PARS_GLSL}
    ${ATMOSPHERE_SMOKE_PARS_GLSL}
    ${ATMOSPHERE_FOG_TINT_PARS_GLSL}

    // Room footprint on XZ, starting at the origin (see VoxelQueryUtil).
    const vec2 SKY_ROOM_SIZE = vec2(${NUM_VOXEL_COLS.toFixed(1)}, ${NUM_VOXEL_ROWS.toFixed(1)});

    // View depth at which a ray (scaled to one unit of view depth) exits the room through the nearest
    // boundary wall. Clamped to [0, far plane].
    float skyRoomExitDepth(vec3 origin, vec3 ray)
    {
        vec2 heading = step(0.0, ray.xz);
        vec2 wall = heading * SKY_ROOM_SIZE;
        // Avoids division by zero for rays parallel to a wall.
        vec2 closing = mix(vec2(-1.0), vec2(1.0), heading) * max(abs(ray.xz), vec2(1e-5));
        vec2 exitDepth = (wall - origin.xz) / closing;
        return clamp(min(exitDepth.x, exitDepth.y), 0.0, skyFarDepth);
    }
`;

// Fog over the sky = fog over the room's air up to the exit depth, thinned by smoke at the exit
// point, so a window shows the same fog as the wall around it. View depth (not distance) matches
// three.js surface fog. Clamping to the far plane keeps no-fog rooms unfogged and stops smoke
// sampled far away from glittering near the zenith. Placed after fog_pars_fragment, which it reads.
const FOG_PARS_GLSL = `
    #ifdef USE_FOG
        float skyFogCoverage(vec3 ray, out vec3 exitPos)
        {
            float depth = skyRoomExitDepth(cameraPosition, ray);
            // Where the ray leaves the room: the far end of the air this fog is made of, so it is
            // tinted over the same stretch a surface's fog is.
            exitPos = cameraPosition + ray * depth;
            #ifdef FOG_EXP2
                float coverage = 1.0 - exp( - fogDensity * fogDensity * depth * depth );
            #else
                float coverage = smoothstep( fogNear, fogFar, depth );
            #endif
            if (atmosphereSmoke.y > 0.0 && coverage > 0.0)
            {
                coverage *= 1.0 -
                    atmosphereSmoke.y * atmosphereSmokeThinning(cameraPosition + ray * depth);
            }
            return coverage;
        }
    #endif
`;

// View ray: unproject the screen position, then rotate into world space with three.js's own
// viewMatrix (uploaded at draw time, so it's never a frame stale; its transpose undoes the rotation).
// The ray is scaled to unit view depth for the fog. Fog is computed first so fully fogged pixels skip
// painting the expensive sky.
const FRAGMENT_GLSL = `
    vec4 skyViewPoint = skyInverseProjection * vec4(vSkyScreenPos, -1.0, 1.0);
    vec3 skyViewRay = skyViewPoint.xyz / skyViewPoint.w;
    vec3 skyRay = (skyViewRay / -skyViewRay.z) * mat3(viewMatrix);
    vec3 skyDir = normalize(skyRay);
    #ifdef USE_FOG
        vec3 skyFogExitPos;
        float skyFog = skyFogCoverage(skyRay, skyFogExitPos);
    #else
        float skyFog = 0.0;
    #endif
    if (skyFog < 1.0)
        diffuseColor.rgb = atmosphereGround(atmosphereColor(skyColor, skyDir), skyDir);
`;

// Replaces the stock fog chunk (same position and color space as every surface's fog), within the
// same program rather than as a second pass.
const FOG_GLSL = `
    #ifdef USE_FOG
        if (skyFog > 0.0)
        {
            gl_FragColor.rgb = mix(gl_FragColor.rgb,
                atmosphereFogColor(fogColor, skyFogExitPos), skyFog);
        }
    #endif
`;

export default function installSkyShader(shader: THREE.WebGLProgramParametersWithUniforms)
{
    ValueNoiseTextureUtil.bindUniform(shader);

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
        "#include <fog_pars_fragment>",
        `
        #include <fog_pars_fragment>
        ${FOG_PARS_GLSL}
        `
    );
    shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        `
        #include <color_fragment>
        ${FRAGMENT_GLSL}
        `
    );
    shader.fragmentShader = shader.fragmentShader.replace(
        "#include <fog_fragment>",
        FOG_GLSL
    );
}
