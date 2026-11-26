import AudioClipPlayer from "./audioClipPlayer";
import AudioPhrasePart from "./audioPhrasePart";
import DecodedAudioBundle from "./decodedAudioBundle";

// Plays a phrase of clips cut from the decoded bundle (see AudioManager.playPhraseAt): each once, at its own time, rate
// and loudness, all scheduled as it starts.
export default class BundledPhrasePlayer implements AudioClipPlayer
{
    private readonly context: BaseAudioContext;
    private readonly output: AudioNode;
    private readonly bundle: DecodedAudioBundle;
    private readonly parts: readonly AudioPhrasePart[];
    private readonly rate: number;
    private readonly onFinished: () => void;
    private readonly onReleased: () => void;
    private readonly playing: Map<AudioBufferSourceNode, GainNode> = new Map();

    // rate: the whole phrase's, over each part's own.
    constructor(context: BaseAudioContext, output: AudioNode, bundle: DecodedAudioBundle, parts: readonly AudioPhrasePart[],
        rate: number, onFinished: () => void, onReleased: () => void)
    {
        this.context = context;
        this.output = output;
        this.bundle = bundle;
        this.parts = parts;
        this.rate = rate;
        this.onFinished = onFinished;
        this.onReleased = onReleased;
    }

    start(): void
    {
        const now = this.context.currentTime;
        for (const part of this.parts)
        {
            const clip = this.bundle.getClip(part.clip)!;
            const gain = this.context.createGain();
            gain.gain.value = part.volume;
            gain.connect(this.output);
            const source = this.context.createBufferSource();
            source.buffer = this.bundle.buffer;
            source.playbackRate.value = this.rate * part.rate;
            source.connect(gain);
            source.onended = () => this.onSourceEnded(source);
            this.playing.set(source, gain);
            source.start(now + Math.max(0, part.at) / this.rate, clip.start, clip.duration);
        }
    }

    // A part not yet begun never begins, and still ends then.
    stop(when: number): void
    {
        for (const source of this.playing.keys())
            source.stop(when);
    }

    private onSourceEnded(source: AudioBufferSourceNode): void
    {
        source.disconnect();
        this.playing.get(source)?.disconnect();
        this.playing.delete(source);
        if (this.playing.size > 0)
            return;
        this.onFinished();
        this.onReleased();
    }
}
