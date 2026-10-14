import * as THREE from "three";
import ValueNoiseTextureUtil from "../../util/valueNoiseTextureUtil";
import LightBlockMapMaterialUtil from "../../light/util/lightBlockMapMaterialUtil";

// The particle materials' shared clock and textures, set by ParticleSystem. Lives apart from it so
// MaterialConstructorMap can use it without an import cycle. Holders are never replaced: three.js re-reads
// "value" each frame.
const particleTimeUniform = {value: 0};
const particleParamsUniform: {value: THREE.Texture | null} = {value: null};
let atlasTexture: THREE.Texture | undefined;

// How far a lit particle's color goes toward its lamps' hue in the thick of their light (see particleShader), and
// zero while the room has no lamp, which skips the sample.
const PARTICLE_LAMP_TINT = 0.8;
const particleLampTintUniform = {value: 0};

const ParticleMaterialUtil =
{
    // Before the materials are created (see ParticleSystem.load), since each is built around the atlas.
    setTextures: (atlas: THREE.Texture, params: THREE.Texture): void =>
    {
        atlasTexture = atlas;
        particleParamsUniform.value = params;
    },
    setTime: (time: number): void =>
    {
        particleTimeUniform.value = time;
    },
    setRoomHasLamps: (roomHasLamps: boolean): void =>
    {
        particleLampTintUniform.value = roomHasLamps ? PARTICLE_LAMP_TINT : 0;
    },
    getAtlasTexture: (): THREE.Texture =>
    {
        if (atlasTexture == undefined)
            throw new Error("The particle atlas is used before it is built (see ParticleSystem.load).");
        return atlasTexture;
    },
    bindUniforms: (shader: THREE.WebGLProgramParametersWithUniforms): void =>
    {
        shader.uniforms.particleTime = particleTimeUniform;
        shader.uniforms.particleParams = particleParamsUniform;
        shader.uniforms.particleLampTint = particleLampTintUniform;
        // Turbulence reads the shared noise, and lit particles the lamp field, in the vertex stage.
        ValueNoiseTextureUtil.bindUniform(shader);
        LightBlockMapMaterialUtil.bindColorUniform(shader);
    },
}

export default ParticleMaterialUtil;
