// Which particle batch draws something (see ParticleBatch): "blended" for translucent air, which writes no
// depth, and "solid" for cut-out surfaces, which write depth and are lit like any other surface.
export type ParticleRenderState = "blended" | "solid";
