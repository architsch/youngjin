// How the preview plays an effect: once, as ParticleSystem.play does, or on and on from an emitter, as a
// ParticleEmitter component does. "auto" picks by the effect's layers (see PreviewStage.getMode).
export type PreviewMode = "auto" | "oneShot" | "emitter";
