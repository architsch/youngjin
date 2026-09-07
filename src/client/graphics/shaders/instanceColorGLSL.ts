// Applies an instanced mesh's per-instance color to the fragment being drawn.
//
// Three.js folds the color set by InstancedMesh.setColorAt into vColor through its stock color_vertex
// chunk, but its color_fragment chunk only tints diffuseColor where USE_COLOR is defined — that is,
// where the material was given a per-*vertex* color attribute. None of the texture-less instanced
// materials here has one, so without this their instance colors would be carried all the way down the
// pipeline and then dropped.
//
// The guard makes it a no-op on an instanced mesh that never sets a color, so a material pays nothing
// for supporting one.
//
// Written to be spliced in directly after "#include <color_fragment>".
const INSTANCE_COLOR_FRAGMENT_GLSL = `
    #ifdef USE_INSTANCING_COLOR
        diffuseColor.rgb *= vColor;
    #endif
`;

export default INSTANCE_COLOR_FRAGMENT_GLSL;
