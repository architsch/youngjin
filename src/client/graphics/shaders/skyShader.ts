import * as THREE from "three";
import { ATMOSPHERE_GROUND_PARS_GLSL, ATMOSPHERE_PARS_GLSL, ATMOSPHERE_SMOKE_PARS_GLSL }
    from "./atmosphereGLSL";
import ValueNoiseTextureUtil from "../util/valueNoiseTextureUtil";
import { NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../../../shared/system/sharedConstants";

// Paints the emptiness past the room — every pixel no surface covers — in two stages: the sky itself,
// in its own color with the clouds and the land in front of it, and then the room's own fog over all
// of that, by as much of the room's air as stands between the camera and the sky. See
// @src/client/graphics/shaders/atmosphereGLSL.ts for why the sky and the fog are separate fields, and
// how the second stage is what lets them meet without a seam.
//
// Drawn as a quad already in clip space rather than as a box or a dome around the camera. There is no
// geometry to get inside of, nothing to keep centred on the viewer, and no far plane to fall outside
// of: the quad covers the screen exactly, once, and sits at the very back of it (see
// AtmosphereMaterialUtil for why it is drawn last rather than first).
//
// Installed on an ordinary unlit material rather than written as a shader material from scratch, so
// that the pixel it produces goes through the same tone mapping and color conversion every other
// surface in the scene goes through — and is then fogged at the same point in the program, in the
// same space and from the same fog uniforms as every surface in the room. A sky that arrived at its
// color or its fog by a different route would not meet the fog on the room's edge, which is the one
// thing it has to do.

const VERTEX_PARS_GLSL = `
    varying vec2 vSkyScreenPos;
`;

// The quad spans the whole of clip space on both axes, so its own vertex positions are already the
// screen positions wanted. Written after the stock projection rather than instead of it, so that
// everything downstream that expects the projection to have happened still finds what it expects.
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

    // The room's footprint, which is where its air ends: one world unit per voxel cell along X and
    // Z, from the world's origin (see VoxelQueryUtil).
    const vec2 SKY_ROOM_SIZE = vec2(${NUM_VOXEL_COLS.toFixed(1)}, ${NUM_VOXEL_ROWS.toFixed(1)});

    // How deep into the view a line of sight leaves the room, for a ray scaled so that one unit of it
    // is one unit of view depth. The room's edge is its four boundary walls, and whichever of them the
    // ray meets first is where it leaves — so each axis is asked which of its two walls the ray is
    // heading for and how soon it gets there, and the nearer answer stands.
    //
    // Never less than nothing, which is what a camera outside the room looking away from it gets:
    // there is none of the room's air in front of it. Never more than the far plane, for the reasons
    // given where this is read.
    float skyRoomExitDepth(vec3 origin, vec3 ray)
    {
        vec2 heading = step(0.0, ray.xz);
        vec2 wall = heading * SKY_ROOM_SIZE;
        // Held off nothing, for a ray running parallel to a wall: it never reaches that one, and a
        // very large answer says so without dividing by zero.
        vec2 closing = mix(vec2(-1.0), vec2(1.0), heading) * max(abs(ray.xz), vec2(1e-5));
        vec2 exitDepth = (wall - origin.xz) / closing;
        return clamp(min(exitDepth.x, exitDepth.y), 0.0, skyFarDepth);
    }
`;

// How far the room's fog closes over the sky in a given direction. Spliced in after three.js's own fog
// declarations rather than beside the rest, since it reads them.
//
// **How much air that is**: the stretch from the camera to where its line of sight leaves the room.
// The sky is at infinity, so the only part of the room's air in front of it is the part inside the
// room — and a surface standing on the room's edge is fogged over exactly that distance, which is what
// makes a window in a boundary wall show the same fog in its aperture as on the wall around it. The
// smoke is read at that same point, so the fog over the sky thins exactly where the fog on the wall
// does.
//
// Measured as depth into the view, the way three.js measures a surface's fog, rather than as a
// straight-line distance. The two part company toward the edges of the screen, and a sky measured one
// way beside a wall measured the other would draw the very seam this exists to remove.
//
// **Held to the far plane**, which is where the quad is actually drawn, and that one limit does two
// jobs. A room that asks for no fog says so with fog distances past the far plane, while a ray running
// almost straight up or down meets no boundary wall for a very long way — so a sky allowed to be
// further off than the far plane would be fogged in a room that asked for none. And the smoke read
// where such a ray leaves the room would be so far off that neighbouring pixels sampled it at
// unrelated places, and the sky near the zenith would glitter.
//
// The distances and the smoke are the stock chunk's own arithmetic, and the room's fog chunk's (see the
// atmosphere shader), so the sky and a wall at the same depth are fogged by the same amount.
const FOG_PARS_GLSL = `
    #ifdef USE_FOG
        float skyFogCoverage(vec3 ray)
        {
            float depth = skyRoomExitDepth(cameraPosition, ray);
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

// The first stage: which way this pixel is looking, and the sky in that direction.
//
// The direction is the one thing the sky itself needs, and the only reason it holds a matrix of its
// own: every other material is handed a fragment that is *somewhere*, while the sky's fragments are
// only ever a direction. Two steps. The screen position is pushed back out through the projection,
// which gives the direction in the camera's own frame; then the camera's rotation is undone to give it
// in the world's. The second step goes through three.js's own view matrix rather than through a camera
// matrix of ours, which is what keeps the sky exactly as current as everything else in the frame —
// that uniform is uploaded as the object is drawn, where anything we copied in beforehand would be a
// frame behind and would show as the sky swimming as the player turns. It is also, deliberately, the
// same step the fog takes, and the view matrix has no scale in it, so the rotation is undone by
// multiplying from the other side rather than by inverting it. The camera's position is three.js's
// own uniform for the same reason.
//
// The ray is kept at a length of its own until everything that needs it has had it: scaled so that
// one unit of it is one unit of depth into the view, which is the measure the fog reads distance in.
//
// The projection's own inverse is a uniform because nothing in a shader can produce it, and it may be
// a frame stale without consequence: it changes only when the window is resized.
//
// **The fog is worked out here, before the sky is painted, and laid over it only at the end** — worked
// out first so that a sky the fog has closed over completely is never painted at all. The sky is the
// most expensive thing per pixel the frame draws, and in a fogged room most of what is seen of it
// through a far window is fog. The clouds read the field's slope across a pixel, which is only
// defined while neighbouring pixels take the same branch; along the line where the fog closes they
// may not, and that is harmless for the reason the clouds' own branch is — whatever the sky returns
// there is mixed away under fog that is all but whole.
//
// Painted in the sky's own color first, then the clouds across it, then whatever land stands in front
// of it — which is nothing at all above the horizon, and is the sky's alone below it (see the
// atmosphere shader, where all three live).
const FRAGMENT_GLSL = `
    vec4 skyViewPoint = skyInverseProjection * vec4(vSkyScreenPos, -1.0, 1.0);
    vec3 skyViewRay = skyViewPoint.xyz / skyViewPoint.w;
    vec3 skyRay = (skyViewRay / -skyViewRay.z) * mat3(viewMatrix);
    vec3 skyDir = normalize(skyRay);
    #ifdef USE_FOG
        float skyFog = skyFogCoverage(skyRay);
    #else
        float skyFog = 0.0;
    #endif
    if (skyFog < 1.0)
        diffuseColor.rgb = atmosphereGround(atmosphereColor(skyColor, skyDir), skyDir);
`;

// The second stage: the room's own fog, laid over the sky. It replaces three.js's own fog chunk and
// stands where that chunk stands in every material — after tone mapping and color conversion — mixing
// toward the same fog color, so the sky is fogged in the same space as a wall is.
//
// **A stage of the one program rather than a second pass over the screen**, which is how every
// surface in the room is fogged too. A second pass would draw the most expensive quad in the frame
// over again and blend it, to arrive at the same mix of the same two colors.
const FOG_GLSL = `
    #ifdef USE_FOG
        gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, skyFog);
    #endif
`;

export default function installSkyShader(shader: THREE.WebGLProgramParametersWithUniforms)
{
    // The weather, the land and the smoke in the fog over them are all read out of the shared noise
    // field, so the material has to be handed it (see ValueNoiseTextureUtil).
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
