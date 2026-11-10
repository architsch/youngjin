import GameObject from "./gameObject";
import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import CannonAim from "../../../../shared/object/types/cannonAim";
import { CannonPhaseEnumMap } from "../../../../shared/object/types/cannonPhase";
import CannonState from "../../../../shared/object/types/cannonState";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../../shared/object/types/objectMetadataKey";
import { CANNON_BALL_COUNT, CANNON_TURN_RATE } from "../../../../shared/object/types/objectTypeConfig/cannonObjectTypeConfig";
import CannonAimUtil from "../../../../shared/object/util/cannonAimUtil";
import CannonStateUtil from "../../../../shared/object/util/cannonStateUtil";
import CannonCompositionUtil from "../../../../shared/graphics/mesh/composition/util/cannonCompositionUtil";
import InstancedMeshComposer from "../../components/instancedMeshComposer";
import AudioManager from "../../../audio/audioManager";
import SpatialAudioVoice from "../../../audio/types/spatialAudioVoice";
import { cannonFiredObservable } from "../../../system/clientObservables";

// Its gears, heard from its pivot, from farther off than it fires, while it turns to aim at someone, by more than
// this many radians, and for this long after the last frame it did, in seconds, so that a wait for the server's next
// word leaves no gap in them.
export const TURN_SOUND_VOLUME = 0.6;
export const TURN_SOUND_RANGE = 22;
const TURN_SOUND_MIN_ANGLE = 0.01;
const TURN_SOUND_HOLD_SECONDS = 0.12;
// Its barrel is never further behind where it is told to point than it can turn in this long, in seconds: more than
// the server's steps are apart, so that it turns at the server's own rate unless it has fallen behind.
const CATCH_UP_SECONDS = 0.3;

// A cannon, which the server plays (see CannonUtil): all this does is show what its state says. The barrel turns to
// where the state has it aim, at the rate the server turns it, so that an aim told in steps shows as one turn; the
// gauges follow the balls left; a ball fewer is a shot, told to whatever shows and sounds one. Its sleep, while
// switched off, is its ParticleEmitter's.
export default class CannonGameObject extends GameObject
{
    private instancedMeshComposer: InstancedMeshComposer;
    private state: CannonState;
    private shownAim: CannonAim;
    private turnSound: SpatialAudioVoice | undefined;
    private turnSoundSecondsLeft = 0;

    constructor(params: AddObjectSignal)
    {
        super(params);

        this.instancedMeshComposer = this.components.instancedMeshComposer as InstancedMeshComposer;
        if (!this.instancedMeshComposer)
            throw new Error("CannonGameObject requires InstancedMeshComposer component");
        if (!this.components.particleEmitter)
            throw new Error("CannonGameObject requires ParticleEmitter component");

        this.state = CannonStateUtil.getObjectState(params);
        this.shownAim = this.getTarget();
    }

    async onDespawn(): Promise<void>
    {
        this.setTurnSound(false);
        await super.onDespawn();
    }

    onSetMetadata(key: ObjectMetadataKey, value: string)
    {
        super.onSetMetadata(key, value);
        if (key !== ObjectMetadataKeyEnumMap.CannonState)
            return;

        const ballsBefore = this.state.ballsLeft;
        this.state = CannonStateUtil.getObjectState(this.params);
        if (this.state.ballsLeft == ballsBefore)
            return;
        // It fires the way the server has it aimed, wherever its barrel had got to here.
        if (this.state.ballsLeft < ballsBefore)
            this.shownAim = this.getTarget();
        this.pose();
        if (this.state.ballsLeft < ballsBefore)
        {
            const {pos, dir} = this.params.transform;
            cannonFiredObservable.set({position: CannonAimUtil.getMuzzle(pos, dir, this.state.aim),
                direction: CannonAimUtil.getDirection(dir, this.state.aim)});
        }
    }

    // On another face its gauges may lie the other way along their squares (see CannonCompositionUtil.pose).
    onTransformChanged(resized: boolean)
    {
        this.pose();
        super.onTransformChanged(resized);
        this.turnSound?.setPosition(this.getPivot());
    }

    update(deltaTime: number)
    {
        const target = this.getTarget();
        const left = CannonAimUtil.getAngleBetween(this.shownAim, target);
        const turning = left > TURN_SOUND_MIN_ANGLE;
        if (target.yaw != this.shownAim.yaw || target.pitch != this.shownAim.pitch)
        {
            // At the server's rate, or faster where it has fallen behind what the server tells in a step.
            const rate = Math.max(CANNON_TURN_RATE, left / CATCH_UP_SECONDS);
            this.shownAim = CannonAimUtil.turnToward(this.shownAim, target, rate * deltaTime);
            this.pose();
        }

        const {on, phase} = this.state;
        const aiming = on && (phase == CannonPhaseEnumMap.Aiming || phase == CannonPhaseEnumMap.Ready);
        this.turnSoundSecondsLeft = (turning && aiming) ? TURN_SOUND_HOLD_SECONDS
            : Math.max(0, this.turnSoundSecondsLeft - deltaTime);
        this.setTurnSound(this.turnSoundSecondsLeft > 0);
    }

    private getTarget(): CannonAim
    {
        return CannonStateUtil.getShownAim(this.state, this.params.transform.dir);
    }

    private pose(): void
    {
        CannonCompositionUtil.pose(this.instancedMeshComposer.getParts(), this.params.transform.dir,
            CannonAimUtil.getLocalDirection(this.shownAim), this.state.ballsLeft / CANNON_BALL_COUNT);
        this.instancedMeshComposer.redrawParts();
    }

    private setTurnSound(playing: boolean): void
    {
        if (playing == (this.turnSound != undefined))
            return;
        if (playing)
        {
            this.turnSound = AudioManager.playLoopAt("cannon/turn", this.getPivot(),
                {volume: TURN_SOUND_VOLUME, range: TURN_SOUND_RANGE});
        }
        else
        {
            this.turnSound!.stop();
            this.turnSound = undefined;
        }
    }

    private getPivot()
    {
        return CannonAimUtil.getPivot(this.params.transform.pos, this.params.transform.dir);
    }
}
