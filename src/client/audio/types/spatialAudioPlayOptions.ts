import AudioPlayOptions from "./audioPlayOptions";

export default interface SpatialAudioPlayOptions extends AudioPlayOptions
{
    // How far from the camera it is still heard, in world units (see SpatialAudioUtil.getDistanceGain).
    range?: number;
}
