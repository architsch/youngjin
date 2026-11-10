import AudioBundleMap from "../maps/audioBundleMap";

// A clip by the name ProceduralSounds or the audio manifest gives it, so that playing one by a name in neither fails to
// compile.
type AudioClipName = keyof typeof AudioBundleMap.clips | keyof typeof AudioBundleMap.streams;

export default AudioClipName;
