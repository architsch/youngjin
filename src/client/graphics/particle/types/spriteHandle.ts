import Vec3 from "../../../../shared/math/types/vec3";
import Waveform from "../../../../shared/math/types/waveform";
import WaveformUtil from "../../../../shared/math/util/waveformUtil";
import DirUtil from "../../../../shared/math/util/dirUtil";
import ParticleBatch from "./particleBatch";
import ParticleColorUtil from "../util/particleColorUtil";

// A persistent animated sprite (see ParticleSystem.createSprite). Its state lives in its batch slot, which
// the shader animates from the clock; the handle forwards changes, and only real ones.
export default class SpriteHandle
{
    readonly sprite: string;
    private batch: ParticleBatch | undefined;
    private readonly slot: number;
    private readonly getTime: () => number;
    private readonly onRelease: (handle: SpriteHandle) => void;
    private rate: Waveform = WaveformUtil.constant(1);
    private tintHex = "#ffffff";

    constructor(sprite: string, batch: ParticleBatch, slot: number, getTime: () => number,
        onRelease: (handle: SpriteHandle) => void)
    {
        this.sprite = sprite;
        this.batch = batch;
        this.slot = slot;
        this.getTime = getTime;
        this.onRelease = onRelease;
    }

    // facing snaps to its nearest axis. Quarter turns run clockwise as seen from the front.
    setPose(position: Vec3, facing: Vec3, quarterTurns: number, width: number, height: number): void
    {
        const orientationCode = DirUtil.dirVecToCode(facing) * 4 + (((Math.round(quarterTurns) % 4) + 4) % 4);
        this.batch?.setSpritePose(this.slot, position, orientationCode, width, height);
    }

    // Units of phase per second (see SpriteConfig). The phase carries on from where it stands.
    setRate(rate: Waveform): void
    {
        if (this.batch == undefined || WaveformUtil.equals(rate, this.rate))
            return;
        this.rate = {...rate};
        this.batch.setSpriteRate(this.slot, rate, this.getTime());
    }

    setTint(hex: string): void
    {
        if (this.batch == undefined || hex === this.tintHex)
            return;
        this.tintHex = hex;
        this.batch.setSpriteTint(this.slot, ParticleColorUtil.packHex(hex));
    }

    release(): void
    {
        if (this.batch == undefined)
            return;
        this.batch.releaseSlot(this.slot);
        this.batch = undefined;
        this.onRelease(this);
    }

    isReleased(): boolean
    {
        return this.batch == undefined;
    }
}
