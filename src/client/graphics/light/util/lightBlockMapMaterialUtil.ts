import * as THREE from "three";
import { LIGHT_BLOCK_MAP_FRAGMENT_GLSL, LIGHT_BLOCK_MAP_FRAGMENT_PARS_GLSL,
    LIGHT_BLOCK_MAP_PARS_GLSL, LIGHT_BLOCK_MAP_VERTEX_GLSL } from "../../shaders/lightBlockMapGLSL";

// Wires a lit material up to the room's light block map. Written once and applied to every lit
// material rather than pasted into each, since what each of them needs is identical: a world position
// and world normal carried down from the vertex stage, and one sample folded into the indirect
// diffuse.
//
// This module owns the uniforms rather than LightBlockMap owning them, so that MaterialConstructorMap
// can reach the sampling code without importing anything that leads back to GraphicsManager — which
// would close an import cycle. LightBlockMap hands its textures over here as it is constructed.

// Held as one object per texture and never replaced, because three.js keeps whatever object is put
// into shader.uniforms and re-reads its "value" every frame. Swapping the value therefore reaches
// every material already compiled, while replacing the holder would reach none of them.
const lightBlockMapColorUniform: {value: THREE.Data3DTexture} =
    {value: createPlaceholderTexture(0)};
const lightBlockMapFluxUniform: {value: THREE.Data3DTexture} =
    {value: createPlaceholderTexture(128)};

const LightBlockMapMaterialUtil =
{
    // Called by LightBlockMap once, as it is built. Until then materials sample the placeholders
    // above — which is not merely tidiness: a material compiled before the block map exists would
    // otherwise be left sampling a null sampler, and the room would come up black.
    setTextures(colorTexture: THREE.Data3DTexture, fluxTexture: THREE.Data3DTexture)
    {
        lightBlockMapColorUniform.value = colorTexture;
        lightBlockMapFluxUniform.value = fluxTexture;
    },

    // Adds the sampling to a material, keeping whatever that material already does on compilation.
    // Returns the material so this can be wrapped around a constructor call.
    addSampling<T extends THREE.Material>(material: T): T
    {
        const existingOnBeforeCompile = material.onBeforeCompile;
        material.onBeforeCompile = (shader, renderer) =>
        {
            existingOnBeforeCompile.call(material, shader, renderer);

            shader.uniforms.lightBlockMapColor = lightBlockMapColorUniform;
            shader.uniforms.lightBlockMapFlux = lightBlockMapFluxUniform;

            shader.vertexShader = LIGHT_BLOCK_MAP_PARS_GLSL + shader.vertexShader;
            // After the projection rather than before it, because that is the point at which the
            // instance transform has been applied to the vertex being drawn.
            shader.vertexShader = shader.vertexShader.replace(
                "#include <project_vertex>",
                `
                #include <project_vertex>
                ${LIGHT_BLOCK_MAP_VERTEX_GLSL}
                `
            );

            shader.fragmentShader = LIGHT_BLOCK_MAP_FRAGMENT_PARS_GLSL + shader.fragmentShader;
            // Where three.js already folds a light map's contribution in, so everything downstream —
            // the tin's specular compression, the wood's carving shade — behaves as it does today.
            shader.fragmentShader = shader.fragmentShader.replace(
                "#include <lights_fragment_maps>",
                `
                #include <lights_fragment_maps>
                ${LIGHT_BLOCK_MAP_FRAGMENT_GLSL}
                `
            );
        };
        return material;
    },
}

// A single black (or, for the flux texture, directionless) block, standing in until the real block
// map arrives. Filtering and wrapping do not matter at this size; being a sampler3D does.
function createPlaceholderTexture(fillValue: number): THREE.Data3DTexture
{
    const texture = new THREE.Data3DTexture(
        new Uint8Array([fillValue, fillValue, fillValue, 255]), 1, 1, 1);
    texture.format = THREE.RGBAFormat;
    texture.type = THREE.UnsignedByteType;
    texture.needsUpdate = true;
    return texture;
}

export default LightBlockMapMaterialUtil;
