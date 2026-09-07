import * as THREE from "three";
import { ATMOSPHERE_GROUND_PARS_GLSL, ATMOSPHERE_PARS_GLSL } from "./atmosphereGLSL";
import ValueNoiseTextureUtil from "../util/valueNoiseTextureUtil";

// Paints the emptiness past the room — every pixel no surface covers — as the room's own air seen at
// infinity (see @src/client/graphics/shaders/atmosphereGLSL.ts for what that means and why the fog
// reads the same field).
//
// Drawn as a quad already in clip space rather than as a box or a dome around the camera. There is no
// geometry to get inside of, nothing to keep centred on the viewer, and no far plane to fall outside
// of: the quad covers the screen exactly, once, and sits at the very back of it (see
// AtmosphereMaterialUtil for why it is drawn last rather than first).
//
// Installed on an ordinary unlit material rather than written as a shader material from scratch, so
// that the pixel it produces goes through the same tone mapping and color conversion every other
// surface in the scene goes through. A sky that arrived at its color by a different route would not
// match the fog, which is the one thing it has to do.

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
    ${ATMOSPHERE_PARS_GLSL}
    ${ATMOSPHERE_GROUND_PARS_GLSL}
`;

// The direction this pixel is looking. This is the one thing the sky needs, and the only reason it
// holds a matrix of its own: every other material is handed a fragment that is *somewhere*, while the
// sky's fragments are only ever a direction.
//
// Two steps. The screen position is pushed back out through the projection, which gives the direction
// in the camera's own frame; then the camera's rotation is undone to give it in the world's. The
// second step goes through three.js's own view matrix rather than through a camera matrix of ours,
// which is what keeps the sky exactly as current as everything else in the frame — that uniform is
// uploaded as the object is drawn, where anything we copied in beforehand would be a frame behind and
// would show as the sky swimming as the player turns. It is also, deliberately, the same step the fog
// takes, and the view matrix has no scale in it, so the rotation is undone by multiplying from the
// other side rather than by inverting it.
//
// The projection's own inverse is a uniform because nothing in a shader can produce it, and it may be
// a frame stale without consequence: it changes only when the window is resized.
// The air first, then whatever land stands in front of it — which is nothing at all above the
// horizon, and is the sky's alone below it (see the atmosphere shader, where both live).
const FRAGMENT_GLSL = `
    vec4 skyViewPoint = skyInverseProjection * vec4(vSkyScreenPos, -1.0, 1.0);
    vec3 skyDir = normalize((skyViewPoint.xyz / skyViewPoint.w) * mat3(viewMatrix));
    diffuseColor.rgb = atmosphereGround(atmosphereColor(skyColor, skyDir), skyDir);
`;

export default function installSkyShader(shader: THREE.WebGLProgramParametersWithUniforms)
{
    // Both the weather and the land are read out of the shared noise field, so the material has to be
    // handed it (see ValueNoiseTextureUtil).
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
        "#include <color_fragment>",
        `
        #include <color_fragment>
        ${FRAGMENT_GLSL}
        `
    );
}
