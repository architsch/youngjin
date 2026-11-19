import ParticleLayerConfig from "./particleLayerConfig";

// A named visual effect (see ParticleEffectConfigMap): layers played together, e.g. a flash, sparks and
// smoke. Each layer is one row of the parameter texture, so a new effect is data alone.
export default interface ParticleEffectConfig
{
    note?: string; // what the effect is for, in place of a comment (the map is JSON)
    layers: ParticleLayerConfig[];
}
