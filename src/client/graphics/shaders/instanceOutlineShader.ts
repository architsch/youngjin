import * as THREE from "three";

// Paints a border on instances with outlineStrength > 0. One float per instance instead of a second
// overlaid mesh, and it is occluded and lit like the surface itself.

// Half-width in world units (adjacent quads each paint their edge, so shared lines are double).
const INSTANCE_OUTLINE_WIDTH = 0.025;

const VERTEX_PARS_GLSL = `
    attribute float outlineStrength;
    // (quad position rescaled so the border's inner boundary is at 1, outline strength)
    varying vec3 vInstanceOutline;
    const float INSTANCE_OUTLINE_WIDTH = ${INSTANCE_OUTLINE_WIDTH.toFixed(4)};
`;

const VERTEX_GLSL = `
    #ifdef USE_INSTANCING
        mat3 outlineBasis = mat3(modelMatrix) * mat3(instanceMatrix);
    #else
        mat3 outlineBasis = mat3(modelMatrix);
    #endif
    vec2 outlineExtent = max(vec2(length(outlineBasis[0]), length(outlineBasis[1])), 0.0001);
    // Rescaled position rather than edge distance (which is 0 at every corner vertex and would
    // interpolate to 0). Keeps the width constant in world units; the divisor floor fills tiny quads.
    vInstanceOutline = vec3(
        position.xy / max(0.5 - INSTANCE_OUTLINE_WIDTH / outlineExtent, 0.02),
        outlineStrength);
`;

const FRAGMENT_GLSL = `
    {
        float outlineEdge = max(abs(vInstanceOutline.x), abs(vInstanceOutline.y));
        // Anti-aliased over one pixel (floored so smoothstep's edges never meet).
        float outlineFade = max(fwidth(outlineEdge), 0.0005);
        diffuseColor.rgb = mix(diffuseColor.rgb, INSTANCE_OUTLINE_COLOR,
            vInstanceOutline.z * smoothstep(1.0 - outlineFade, 1.0, outlineEdge));
    }
`;

export default function installInstanceOutlineShader(
    shader: THREE.WebGLProgramParametersWithUniforms, colorHex: string)
{
    // THREE.Color converts sRGB hex to the linear working space.
    const color = new THREE.Color(colorHex);

    shader.vertexShader = VERTEX_PARS_GLSL + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `
        #include <begin_vertex>
        ${VERTEX_GLSL}
        `
    );

    shader.fragmentShader = `
        varying vec3 vInstanceOutline;
        const vec3 INSTANCE_OUTLINE_COLOR = vec3(${color.r.toFixed(5)}, ${color.g.toFixed(5)}, ${color.b.toFixed(5)});
    `+ shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        `
        #include <color_fragment>
        ${FRAGMENT_GLSL}
        `
    );
}
