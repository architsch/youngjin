// Where a sprite's frames lie in the particle atlas, in UV units (V up): frame i spans u + i * width to
// u + (i + 1) * width (see ParticleAtlasUtil).
export default interface ParticleAtlasSprite
{
    u: number;
    v: number;
    width: number;
    height: number;
    frames: number;
}
