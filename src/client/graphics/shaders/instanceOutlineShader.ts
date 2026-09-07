import * as THREE from "three";

// Paints a border around each instance that asks for one, in the color the material was given.
//
// This is the cheapest way to mark out a set of instances of a mesh that is drawn in one call: a
// second mesh laid over the marked ones would be a second draw and a second set of transforms to
// keep in step with the first, where this is one float per instance and a handful of instructions
// per fragment. The border is drawn onto the surface rather than floated over it, so it is occluded,
// lit and painted over by exactly the same rules as the texture underneath it.

// How wide the outline is painted, in world units. Measured against the world rather than against
// the quad, so that quads of different sizes — a whole wall face and the half-height slice of one
// that a single collision layer shows — are drawn with one line and not two thicknesses of it.
//
// Read as half of what it draws: two quads lying side by side each paint their own edge, so a line
// running between them comes out twice this wide.
const INSTANCE_OUTLINE_WIDTH = 0.025;

const VERTEX_PARS_GLSL = `
    attribute float outlineStrength;
    // Where the fragment sits on the quad, on each of the quad's two axes, measured so that 1 is
    // the inner boundary of the border and anything past it is the border itself; and how
    // strongly this instance is outlined.
    varying vec3 vInstanceOutline;
    const float INSTANCE_OUTLINE_WIDTH = ${INSTANCE_OUTLINE_WIDTH.toFixed(4)};
`;

const VERTEX_GLSL = `
    // The quad's extent in the world, recovered from the transform that put it there — the same
    // way the wood material recovers its own.
    #ifdef USE_INSTANCING
        mat3 outlineBasis = mat3(modelMatrix) * mat3(instanceMatrix);
    #else
        mat3 outlineBasis = mat3(modelMatrix);
    #endif
    vec2 outlineExtent = max(vec2(length(outlineBasis[0]), length(outlineBasis[1])), 0.0001);
    // The position is handed over rescaled rather than the distance to the edge being worked out
    // here, because every vertex of a quad sits on one of its corners: a distance-to-edge is
    // zero at all four of them, and interpolating that across the face gives zero everywhere.
    // Rescaling instead puts the border's inner boundary at 1 whatever the quad's size, which is
    // how one width in world units comes out the same on a whole wall face and on the
    // half-height slice of one that a single collision layer shows.
    //
    // The divisor is held off zero, so that a quad narrower than the border itself is filled in
    // rather than divided by nothing.
    vInstanceOutline = vec3(
        position.xy / max(0.5 - INSTANCE_OUTLINE_WIDTH / outlineExtent, 0.02),
        outlineStrength);
`;

const FRAGMENT_GLSL = `
    {
        float outlineEdge = max(abs(vInstanceOutline.x), abs(vInstanceOutline.y));
        // Faded over the width of a pixel rather than switched at a threshold: the line is
        // thinner than a voxel by an order of magnitude, so at any distance it would otherwise
        // crawl and sparkle as its two edges crossed pixel centers. Held off zero, since a
        // smoothstep whose two edges meet is undefined rather than a step.
        float outlineFade = max(fwidth(outlineEdge), 0.0005);
        diffuseColor.rgb = mix(diffuseColor.rgb, INSTANCE_OUTLINE_COLOR,
            vInstanceOutline.z * smoothstep(1.0 - outlineFade, 1.0, outlineEdge));
    }
`;

export default function installInstanceOutlineShader(
    shader: THREE.WebGLProgramParametersWithUniforms, colorHex: string)
{
    // Converted the way three.js converts a material's own color, since the fragment stage works in
    // the renderer's linear working color space rather than in the sRGB the hex is written in.
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
