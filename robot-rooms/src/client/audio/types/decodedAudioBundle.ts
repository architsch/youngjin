import AudioClip from "./audioClip";

// The audio bundle's samples, and where each clip lies in them as this browser decoded them (see
// AudioBundleUtil.findMarkerOffset).
export default class DecodedAudioBundle
{
    readonly buffer: AudioBuffer;
    private readonly clips: Map<string, AudioClip> = new Map();

    // offset: how far the decoder shifted every clip from where the bundle put it, in seconds.
    constructor(buffer: AudioBuffer, clips: {readonly [name: string]: AudioClip}, offset: number)
    {
        this.buffer = buffer;
        for (const [name, clip] of Object.entries(clips))
            this.clips.set(name, {start: clip.start + offset, duration: clip.duration});
    }

    getClip(name: string): AudioClip | undefined
    {
        return this.clips.get(name);
    }
}
