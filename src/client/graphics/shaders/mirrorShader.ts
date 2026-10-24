import * as THREE from "three";

// A mirror's glass: each of its points shows where the reflection drew it (see MirrorReflectionUtil), a projective
// lookup by the matrix the reflection was drawn with, under its surface: a color, lit and fogged as any surface is, laid
// over the reflection as opaquely as the mirror is set to (see MirrorObjectTypeConfig). The reflection itself is fogged
// over the whole way the light comes, glass and all, so it is laid under the surface's fog rather than through it.

const VERTEX_PARS_GLSL = `
    uniform mat4 mirrorTextureMatrix;
    varying vec4 vMirrorCoord;
`;

// After the stock projection, which leaves the vertex in "transformed".
const VERTEX_GLSL = `
    #ifdef USE_INSTANCING
        vMirrorCoord = mirrorTextureMatrix * (modelMatrix * instanceMatrix * vec4(transformed, 1.0));
    #else
        vMirrorCoord = mirrorTextureMatrix * (modelMatrix * vec4(transformed, 1.0));
    #endif
`;

const FRAGMENT_PARS_GLSL = `
    uniform sampler2D mirrorMap;
    uniform vec4 mirrorUVBounds;
    uniform float mirrorReflectionShown;
    uniform vec3 mirrorSurfaceColor;
    uniform float mirrorSurfaceOpacity;
    varying vec4 vMirrorCoord;
    // A silvered pane gives back most of the light that reaches it.
    const float MIRROR_REFLECTANCE = 0.9;
    // Linear-space color of the glass before its first reflection is drawn.
    const vec3 MIRROR_UNDRAWN_COLOR = vec3(0.32, 0.38, 0.42);
`;

// The divide is per fragment, so the lookup follows the glass's perspective. The surface is what the stock lighting
// lights.
const COLOR_FRAGMENT_GLSL = `
    vec2 mirrorUV = clamp(vMirrorCoord.xy / vMirrorCoord.w, mirrorUVBounds.xy, mirrorUVBounds.zw);
    vec3 mirrorReflection = mix(MIRROR_UNDRAWN_COLOR, texture2D(mirrorMap, mirrorUV).rgb * MIRROR_REFLECTANCE,
        mirrorReflectionShown);
    diffuseColor.rgb = mirrorSurfaceColor;
`;

// Once the surface is lit and fogged, in the color space it was written in.
const BLEND_FRAGMENT_GLSL = `
    gl_FragColor.rgb = mix(linearToOutputTexel(vec4(mirrorReflection, 1.0)).rgb, gl_FragColor.rgb,
        mirrorSurfaceOpacity);
`;

export default function installMirrorShader(shader: THREE.WebGLProgramParametersWithUniforms)
{
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
        ${COLOR_FRAGMENT_GLSL}
        `
    );
    // Right after the fog, whichever chunk the room's air puts in its place (see AtmosphereMaterialUtil).
    shader.fragmentShader = shader.fragmentShader.replace(
        "#include <premultiplied_alpha_fragment>",
        `
        ${BLEND_FRAGMENT_GLSL}
        #include <premultiplied_alpha_fragment>
        `
    );
}
