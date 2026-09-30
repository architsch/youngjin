import ParticleEffectConfig from "../types/particleEffectConfig";
import particleEffects from "./particleEffects.json";

// Every visual effect, by name, kept in particleEffects.json so the particle effect editor
// (npm run particleEffectEditor) can write it. JSON can't be typed as tuples and unions, so particle.test.ts
// checks each entry against ParticleEffectConfigUtil instead. Each layer is one row of the parameter texture,
// baked once at load, so a new effect costs no shader change, recompile or draw call.
const configs = particleEffects.effects as unknown as {[effect: string]: ParticleEffectConfig};

const ParticleEffectConfigMap =
{
    getConfig: (effect: string): ParticleEffectConfig | undefined =>
    {
        return configs[effect];
    },
    getEffects: (): string[] =>
    {
        return Object.keys(configs);
    },
}

export default ParticleEffectConfigMap;
