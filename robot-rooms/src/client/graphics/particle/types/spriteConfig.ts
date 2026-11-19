import { ParticleRenderState } from "../../../../shared/graphics/particle/types/particleRenderState";

// A persistent animated sprite (see SpriteHandle). Its phase advances by its rate (a Waveform) each
// second; these turn the phase into motion.
export default interface SpriteConfig
{
    sprite: string; // ParticleAtlasUtil sprite id; a flipbook strip if framesPerUnit is set
    renderState: ParticleRenderState;
    additiveness?: number; // blended only
    lit?: boolean; // blended only (solid sprites are always lit)
    turnsPerUnit?: number; // counter-clockwise as seen from the front
    framesPerUnit?: number;
    // How far alpha and size follow where the rate stands in its range, 0 to 1 (1 = gone at its low).
    levelAlpha?: number;
    levelSize?: number;
    colorHex?: string;
}
