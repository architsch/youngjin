// Applies InstancedMesh.setColorAt colors. three.js's color_fragment only tints under USE_COLOR
// (per-vertex colors), which these materials lack, so instance colors would otherwise be dropped.
// Splice directly after "#include <color_fragment>".
const INSTANCE_COLOR_FRAGMENT_GLSL = `
    #ifdef USE_INSTANCING_COLOR
        diffuseColor.rgb *= vColor;
    #endif
`;

export default INSTANCE_COLOR_FRAGMENT_GLSL;
