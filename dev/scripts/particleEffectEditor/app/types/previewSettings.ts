import Waveform from "../../../../../src/shared/math/types/waveform";
import { PreviewMode } from "./previewMode";
import { PreviewScene } from "./previewScene";

export default interface PreviewSettings
{
    scene: PreviewScene;
    mode: PreviewMode;
    loop: boolean;
    speed: number; // how fast time passes, 1 being the game's
    scale: number; // as ParticleSystem.play's, e.g. an object's footprint
    darkFloor: boolean;
    level: Waveform; // an emitter's
    seed: number; // the same one replays the same particles
}
