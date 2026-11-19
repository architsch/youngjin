import Vec3 from "../../../shared/math/types/vec3";
import AudioVoice from "./audioVoice";
import SpatialAudioUtil from "../util/spatialAudioUtil";

// A sound at a position in the world, which its owner moves along with whatever makes it. How loud it is, how muffled by
// the walls in between, and to which side it is heard, follow from where the camera is (see AudioManager.update).
export default class SpatialAudioVoice extends AudioVoice
{
    private readonly position: Vec3;
    private readonly range: number;
    private attenuation: GainNode | undefined;
    private muffler: BiquadFilterNode | undefined;
    private panner: StereoPannerNode | undefined;

    constructor(clips: readonly string[], looping: boolean, volume: number, rate: number, position: Vec3, range: number)
    {
        super(clips, looping, volume, rate);
        this.position = {x: position.x, y: position.y, z: position.z};
        this.range = range;
    }

    setPosition(position: Vec3): void
    {
        this.position.x = position.x;
        this.position.y = position.y;
        this.position.z = position.z;
    }

    // AudioManager's, as the voice starts (with no smoothing) and on every frame after. countWalls is asked only while the
    // sound is within its range: past it, there is nothing to muffle.
    applyListener(listenerPosition: Vec3, listenerRight: Vec3, countWalls: (from: Vec3, to: Vec3) => number,
        smoothingSeconds: number): void
    {
        if (this.attenuation == undefined || this.isEnded())
            return;
        const distance = SpatialAudioUtil.getDistance(listenerPosition, this.position);
        const walls = (distance < this.range) ? countWalls(listenerPosition, this.position) : 0;
        const gain = SpatialAudioUtil.getDistanceGain(distance, this.range) * SpatialAudioUtil.getOcclusionGain(walls);
        const cutoff = SpatialAudioUtil.getOcclusionCutoff(walls);
        const pan = SpatialAudioUtil.getPan(listenerPosition, listenerRight, this.position);
        if (smoothingSeconds > 0)
        {
            const now = this.context!.currentTime;
            this.attenuation.gain.setTargetAtTime(gain, now, smoothingSeconds);
            this.muffler!.frequency.setTargetAtTime(cutoff, now, smoothingSeconds);
            this.panner!.pan.setTargetAtTime(pan, now, smoothingSeconds);
        }
        else
        {
            this.attenuation.gain.value = gain;
            this.muffler!.frequency.value = cutoff;
            this.panner!.pan.value = pan;
        }
    }

    protected connectOutput(context: BaseAudioContext, destination: AudioNode): AudioNode
    {
        this.attenuation = context.createGain();
        this.muffler = context.createBiquadFilter();
        this.muffler.type = "lowpass";
        this.panner = context.createStereoPanner();
        // Heard from one point: its channels mixed into one, then panned.
        this.panner.channelCount = 1;
        this.panner.channelCountMode = "explicit";
        this.attenuation.connect(this.muffler);
        this.muffler.connect(this.panner);
        this.panner.connect(destination);
        return this.attenuation;
    }

    protected disconnectOutput(): void
    {
        this.attenuation!.disconnect();
        this.muffler!.disconnect();
        this.panner!.disconnect();
    }
}
