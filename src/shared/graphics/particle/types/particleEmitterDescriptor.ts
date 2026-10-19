import Waveform from "../../../math/types/waveform";

// What a ParticleEmitter streams out of its object's face (see ObjectTypeConfig.components.particleEmitter).
export default interface ParticleEmitterDescriptor
{
    effect: string; // ParticleEffectConfigMap id
    // Multipliers on the effect's emission rates and particle speeds.
    rateScale?: number;
    speedScale?: number;
    // How fast its particles' lives run: a slower pace takes them along the same paths, over as much longer lives.
    particleTimeScale?: number;
    // "#rrggbb" its particles are tinted with, over the effect's own colors; each keeps the one it was born with.
    // White if absent.
    tint?: string;
    // Scales both over time. A steady 1 if absent.
    level?: Waveform;
    // How far in front of the object's face it emits from, in world units.
    faceOffset?: number;
    // How far from the face its particles carry, in world units: sped up where the effect's own speeds would fall
    // short of it (and as many more of them emitted), and ended there. As far as those speeds take them if absent.
    reach?: number;
    // Whether its particles end at the first solid block in front of the face, so they never pass
    // through a wall.
    stopAtBlocks?: boolean;
}
