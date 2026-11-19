import * as THREE from "three";
import { LIGHT_BLOCK_MAP_FRAGMENT_GLSL, LIGHT_BLOCK_MAP_FRAGMENT_PARS_GLSL,
    LIGHT_BLOCK_MAP_PARS_GLSL, LIGHT_BLOCK_MAP_VERTEX_GLSL } from "../../shaders/lightBlockMapGLSL";

// Adds light block map sampling to lit materials. Owns the uniforms (rather than LightBlockMap) so
// MaterialConstructorMap can use it without an import cycle through GraphicsManager.

// 1x1x1 stand-ins (black / directionless, alpha 0 = "nothing here").
const placeholderColorTexture = createPlaceholderTexture(0);
const placeholderFluxTexture = createPlaceholderTexture(128);

// Holder objects are never replaced: three.js re-reads "value" each frame, so swapping the value
// reaches already-compiled materials.
const lightBlockMapColorUniform: {value: THREE.Data3DTexture} = {value: placeholderColorTexture};
const lightBlockMapFluxUniform: {value: THREE.Data3DTexture} = {value: placeholderFluxTexture};

const LightBlockMapMaterialUtil =
{
    // Until called, materials sample placeholders (a null sampler would render the room black).
    setTextures(colorTexture: THREE.Data3DTexture, fluxTexture: THREE.Data3DTexture)
    {
        lightBlockMapColorUniform.value = colorTexture;
        lightBlockMapFluxUniform.value = fluxTexture;
    },

    // Draws something that isn't in the room, which its lamps don't light (see RoomPreviewUtil).
    drawWithoutLamps<T>(draw: () => T): T
    {
        const colorTexture = lightBlockMapColorUniform.value;
        const fluxTexture = lightBlockMapFluxUniform.value;
        LightBlockMapMaterialUtil.setTextures(placeholderColorTexture, placeholderFluxTexture);
        try
        {
            return draw();
        }
        finally
        {
            LightBlockMapMaterialUtil.setTextures(colorTexture, fluxTexture);
        }
    },

    // For splices that sample by world position alone (the fog and the sky); the lit path below
    // binds the flux as well.
    bindColorUniform(shader: THREE.WebGLProgramParametersWithUniforms)
    {
        shader.uniforms.lightBlockMapColor = lightBlockMapColorUniform;
    },

    // Chains onto the material's existing onBeforeCompile. Returns the material for wrapping.
    addSampling<T extends THREE.Material>(material: T): T
    {
        const existingOnBeforeCompile = material.onBeforeCompile;
        material.onBeforeCompile = (shader, renderer) =>
        {
            existingOnBeforeCompile.call(material, shader, renderer);

            LightBlockMapMaterialUtil.bindColorUniform(shader);
            shader.uniforms.lightBlockMapFlux = lightBlockMapFluxUniform;

            shader.vertexShader = LIGHT_BLOCK_MAP_PARS_GLSL + shader.vertexShader;
            // After project_vertex, where the instance transform has been applied.
            shader.vertexShader = shader.vertexShader.replace(
                "#include <project_vertex>",
                `
                #include <project_vertex>
                ${LIGHT_BLOCK_MAP_VERTEX_GLSL}
                `
            );

            shader.fragmentShader = LIGHT_BLOCK_MAP_FRAGMENT_PARS_GLSL + shader.fragmentShader;
            // Where three.js folds in light maps, so downstream material code is unaffected.
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

function createPlaceholderTexture(fillValue: number): THREE.Data3DTexture
{
    const texture = new THREE.Data3DTexture(
        new Uint8Array([fillValue, fillValue, fillValue, 0]), 1, 1, 1);
    texture.format = THREE.RGBAFormat;
    texture.type = THREE.UnsignedByteType;
    texture.needsUpdate = true;
    return texture;
}

export default LightBlockMapMaterialUtil;
