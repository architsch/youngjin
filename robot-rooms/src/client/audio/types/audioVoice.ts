import AudioClipPlayer from "./audioClipPlayer";

// How long a sound cut short fades out over, so that stopping it never clicks.
export const AUDIO_STOP_FADE_SECONDS = 0.05;
// How quickly a sound follows a change of its volume.
export const AUDIO_VOLUME_SMOOTHING_SECONDS = 0.02;

// A sound AudioManager plays: a clip once, a clip over and over, or several clips one after another in an endless
// shuffled order. Its owner keeps it to change or stop it. Until AudioManager starts it, it only remembers what it is
// told.
export default class AudioVoice
{
    readonly clips: readonly string[];
    // Plays until stopped; otherwise it plays its one clip once.
    readonly looping: boolean;
    // How fast it plays, which raises its pitch as much.
    readonly rate: number;
    protected context: BaseAudioContext | undefined;
    private volume: number;
    private output: GainNode | undefined;
    private player: AudioClipPlayer | undefined;
    private stopped = false;
    private finished = false;

    constructor(clips: readonly string[], looping: boolean, volume: number, rate: number = 1)
    {
        this.clips = clips;
        this.looping = looping;
        this.volume = volume;
        this.rate = rate;
    }

    // Once its one clip has played, or once it is stopped.
    isEnded(): boolean
    {
        return this.stopped || this.finished;
    }

    setVolume(volume: number): void
    {
        this.volume = volume;
        if (this.output != undefined && !this.stopped)
            this.output.gain.setTargetAtTime(volume, this.context!.currentTime, AUDIO_VOLUME_SMOOTHING_SECONDS);
    }

    stop(fadeSeconds: number = AUDIO_STOP_FADE_SECONDS): void
    {
        if (this.isEnded())
            return;
        this.stopped = true;
        if (this.output == undefined)
            return;
        const now = this.context!.currentTime;
        const gain = this.output.gain;
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(gain.value, now);
        gain.linearRampToValueAtTime(0, now + fadeSeconds);
        this.player!.stop(now + fadeSeconds);
    }

    // AudioManager's, once what the clips play from is there and the page may make sound: starts at once, into
    // destination, through a player createPlayer makes for the voice's output.
    start(context: BaseAudioContext, destination: AudioNode,
        createPlayer: (output: AudioNode, onFinished: () => void, onReleased: () => void) => AudioClipPlayer): void
    {
        if (this.stopped || this.output != undefined)
            return;
        this.context = context;
        this.output = context.createGain();
        this.output.gain.value = this.volume;
        this.output.connect(this.connectOutput(context, destination));
        this.player = createPlayer(this.output, () => this.finished = true, () => this.release());
        this.player.start();
    }

    // What the output feeds on its way to destination: destination itself, unless a subclass puts something between.
    protected connectOutput(context: BaseAudioContext, destination: AudioNode): AudioNode
    {
        return destination;
    }

    // Lets go of whatever connectOutput put between.
    protected disconnectOutput(): void
    {
    }

    private release(): void
    {
        this.output!.disconnect();
        this.disconnectOutput();
    }
}
