import AudioBundleInfo from "../types/audioBundleInfo";
import DecodedAudioBundle from "../types/decodedAudioBundle";

// How loud the bundle's click must come out to be told from the silence around it. A decoder smooths its one sample out,
// but leaves most of it.
export const AUDIO_MARKER_MIN_PEAK = 0.25;

const AudioBundleUtil =
{
    download: async (url: string): Promise<ArrayBuffer> =>
    {
        const response = await fetch(url);
        if (!response.ok)
            throw new Error(`AudioBundleUtil.download :: HTTP ${response.status} (url = ${url})`);
        return await response.arrayBuffer();
    },
    decode: async (context: BaseAudioContext, bytes: ArrayBuffer, info: AudioBundleInfo): Promise<DecodedAudioBundle> =>
    {
        const buffer = await context.decodeAudioData(bytes);
        const offset = AudioBundleUtil.findMarkerOffset(buffer, info.markerTime);
        if (offset == undefined)
            console.warn(`AudioBundleUtil.decode :: The bundle's click is missing, so its clips are cut where they were put (version = ${info.version})`);
        return new DecodedAudioBundle(buffer, info.clips, offset ?? 0);
    },
    // How far this browser's decoder shifted the clips, in seconds, or undefined if the click can't be found. Decoders
    // differ in how much of the encoder's delay they cut from the start. The bundle opens with a click alone in silence,
    // markerTime in and twice that before the first clip's padding (see AudioBundleBuilder), so a shift of nearly
    // markerTime either way is found.
    findMarkerOffset: (buffer: AudioBuffer, markerTime: number): number | undefined =>
    {
        const samples = buffer.getChannelData(0);
        const end = Math.min(samples.length, Math.round(2 * markerTime * buffer.sampleRate));
        let peak = 0;
        let peakIndex = 0;
        for (let i = 0; i < end; ++i)
        {
            const level = Math.abs(samples[i]);
            if (level > peak)
            {
                peak = level;
                peakIndex = i;
            }
        }
        return (peak >= AUDIO_MARKER_MIN_PEAK) ? peakIndex / buffer.sampleRate - markerTime : undefined;
    },
}

export default AudioBundleUtil;
