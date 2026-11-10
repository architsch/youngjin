import AudioClipPlayer from "./audioClipPlayer";
import AudioClipShuffler from "./audioClipShuffler";
import DecodedAudioBundle from "./decodedAudioBundle";

// Plays clips cut from the decoded bundle: one once, one looped, or several one after another with no gap.
export default class BundledClipPlayer implements AudioClipPlayer
{
    private readonly context: BaseAudioContext;
    private readonly output: AudioNode;
    private readonly bundle: DecodedAudioBundle;
    private readonly clips: readonly string[];
    private readonly looping: boolean;
    private readonly rate: number;
    private readonly onFinished: () => void;
    private readonly onReleased: () => void;
    private readonly sources: Set<AudioBufferSourceNode> = new Set();
    private shuffler: AudioClipShuffler | undefined;
    // When a sequence's next clip starts, in the context's time.
    private nextStartTime = 0;
    private stopped = false;

    constructor(context: BaseAudioContext, output: AudioNode, bundle: DecodedAudioBundle, clips: readonly string[],
        looping: boolean, rate: number, onFinished: () => void, onReleased: () => void)
    {
        this.context = context;
        this.output = output;
        this.bundle = bundle;
        this.clips = clips;
        this.looping = looping;
        this.rate = rate;
        this.onFinished = onFinished;
        this.onReleased = onReleased;
    }

    start(): void
    {
        const now = this.context.currentTime;
        if (this.looping && this.clips.length > 1)
        {
            this.shuffler = new AudioClipShuffler(this.clips);
            this.nextStartTime = now;
            // One clip always waits its turn behind the one playing, so that each follows the last with no gap (see
            // onSourceEnded).
            this.queueNextClip();
            this.queueNextClip();
            return;
        }
        const clip = this.bundle.getClip(this.clips[0])!;
        const source = this.createSource();
        if (this.looping)
        {
            source.loop = true;
            source.loopStart = clip.start;
            source.loopEnd = clip.start + clip.duration;
            source.start(now, clip.start);
        }
        else
            source.start(now, clip.start, clip.duration);
    }

    stop(when: number): void
    {
        this.stopped = true;
        for (const source of this.sources)
            source.stop(when);
    }

    private createSource(): AudioBufferSourceNode
    {
        const source = this.context.createBufferSource();
        source.buffer = this.bundle.buffer;
        source.playbackRate.value = this.rate;
        source.connect(this.output);
        source.onended = () => this.onSourceEnded(source);
        this.sources.add(source);
        return source;
    }

    private queueNextClip(): void
    {
        const clip = this.bundle.getClip(this.shuffler!.next())!;
        // A turn missed while the page was too busy to queue it starts as soon as it can.
        const startTime = Math.max(this.nextStartTime, this.context.currentTime);
        this.createSource().start(startTime, clip.start, clip.duration);
        this.nextStartTime = startTime + clip.duration / this.rate;
    }

    private onSourceEnded(source: AudioBufferSourceNode): void
    {
        this.sources.delete(source);
        source.disconnect();
        if (this.shuffler != undefined && !this.stopped)
        {
            this.queueNextClip();
            return;
        }
        if (!this.looping)
            this.onFinished();
        if (this.sources.size == 0)
            this.onReleased();
    }
}
