import AudioClipPlayer from "./audioClipPlayer";
import AudioClipShuffler from "./audioClipShuffler";
import AudioStreamElement from "./audioStreamElement";
import AudioStreamUtil from "../util/audioStreamUtil";

// Plays clips streamed from files of their own, as they download (see AudioStreamUtil): one once, one looped, or several
// one after another, each as soon as the last has ended.
export default class StreamedClipPlayer implements AudioClipPlayer
{
    private readonly context: AudioContext;
    private readonly output: AudioNode;
    private readonly getURL: (clip: string) => string;
    private readonly clips: readonly string[];
    private readonly looping: boolean;
    private readonly rate: number;
    private readonly onFinished: () => void;
    private readonly onReleased: () => void;
    private stream: AudioStreamElement | undefined;
    private shuffler: AudioClipShuffler | undefined;
    private failuresInARow = 0;
    private stopped = false;

    constructor(context: AudioContext, output: AudioNode, getURL: (clip: string) => string, clips: readonly string[],
        looping: boolean, rate: number, onFinished: () => void, onReleased: () => void)
    {
        this.context = context;
        this.output = output;
        this.getURL = getURL;
        this.clips = clips;
        this.looping = looping;
        this.rate = rate;
        this.onFinished = onFinished;
        this.onReleased = onReleased;
    }

    start(): void
    {
        if (this.looping && this.clips.length > 1)
            this.shuffler = new AudioClipShuffler(this.clips);
        const stream = AudioStreamUtil.take(this.context);
        this.stream = stream;
        stream.node.connect(this.output);
        stream.element.loop = this.looping && this.shuffler == undefined;
        stream.element.playbackRate = this.rate;
        stream.element.preservesPitch = false;
        stream.element.onended = () => this.onStreamEnded();
        stream.element.onerror = () => this.onStreamFailed();
        this.playNext();
    }

    // An element can't be told when to stop, so it is let go of once the voice has faded it out.
    stop(when: number): void
    {
        if (this.stopped)
            return;
        this.stopped = true;
        setTimeout(() => this.release(), 1000 * Math.max(0, when - this.context.currentTime));
    }

    private playNext(): void
    {
        AudioStreamUtil.play(this.stream!, this.getURL(this.shuffler?.next() ?? this.clips[0]));
    }

    private onStreamEnded(): void
    {
        if (this.stopped)
            return;
        this.failuresInARow = 0;
        if (this.shuffler != undefined)
        {
            this.playNext();
            return;
        }
        this.finish();
    }

    // A sequence skips a file that fails, unless every one does.
    private onStreamFailed(): void
    {
        console.warn(`StreamedClipPlayer :: A stream failed to play (src = ${this.stream?.element.src})`);
        if (this.stopped)
            return;
        if (this.shuffler != undefined && ++this.failuresInARow < this.clips.length)
        {
            this.playNext();
            return;
        }
        this.finish();
    }

    private finish(): void
    {
        this.stopped = true;
        this.onFinished();
        this.release();
    }

    private release(): void
    {
        if (this.stream == undefined)
            return;
        AudioStreamUtil.release(this.stream);
        this.stream = undefined;
        this.onReleased();
    }
}
