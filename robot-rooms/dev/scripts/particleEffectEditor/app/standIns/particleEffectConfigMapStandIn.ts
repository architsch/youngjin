import ParticleEffectConfig from "../../../../../src/client/graphics/particle/types/particleEffectConfig";

// ParticleEffectConfigMap as the particle system sees it (see server.js): the effects being edited, which the
// preview swaps in before each bake.
let configs: {[effect: string]: ParticleEffectConfig} = {};

const ParticleEffectConfigMapStandIn =
{
    getConfig: (effect: string): ParticleEffectConfig | undefined =>
    {
        return configs[effect];
    },
    getEffects: (): string[] =>
    {
        return Object.keys(configs);
    },
    setConfigs: (effects: {[effect: string]: ParticleEffectConfig}): void =>
    {
        configs = effects;
    },
}

export default ParticleEffectConfigMapStandIn;
