import ParticleEffectConfig from "../../../../../src/client/graphics/particle/types/particleEffectConfig";

// The file the editor edits (see server.js): every effect by its name, which is how the game plays it, in the
// order the file lists them.
export default interface ParticleEffectSource
{
    effects: {[effect: string]: ParticleEffectConfig};
}
