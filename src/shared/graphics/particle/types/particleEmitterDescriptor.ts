import Waveform from "../../../math/types/waveform";

// What a ParticleEmitter streams out of its object's face (see ObjectTypeConfig.components.particleEmitter).
export default interface ParticleEmitterDescriptor
{
    effect: string; // ParticleEffectConfigMap id
    // Multipliers on the effect's emission rates and particle speeds.
    rateScale?: number;
    speedScale?: number;
    // Scales both over time. A steady 1 if absent.
    level?: Waveform;
    // How far in front of the object's face it emits from, in world units.
    faceOffset?: number;
    // Whether its particles end at the first solid block in front of the face, so they never pass
    // through a wall.
    stopAtBlocks?: boolean;
}
