import GameObject from "./gameObject";
import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../../shared/object/types/objectMetadataKey";
import CannonBallMotionUtil from "../../../../shared/object/util/cannonBallMotionUtil";
import CannonBallStateUtil from "../../../../shared/object/util/cannonBallStateUtil";
import PhysicsManager from "../../../../shared/physics/physicsManager";
import PhysicsSphereUtil from "../../../../shared/physics/util/physicsSphereUtil";
import Vec3 from "../../../../shared/math/types/vec3";
import Vector3DUtil from "../../../../shared/math/util/vector3DUtil";
import InstancedMeshComposer from "../../components/instancedMeshComposer";
import { cannonBallBounceObservable, cannonBallBurstObservable,
    cannonBlastObservable } from "../../../system/clientObservables";

// How quickly what is drawn closes on where the ball is, once the server's word has moved that, a share a second.
const SETTLE_RATE = 12;
// Having struck a body, it is held there for the server to say what came of it, no longer than this, in seconds:
// then it flies on through that body.
export const MAX_HELD_SECONDS = 0.3;
// The time it stood held it flies again at this share over its pace, and never owes more of it than this, in seconds.
const CATCH_UP_SHARE = 0.5;
const MAX_OWED_SECONDS = 0.5;
// Shown bursting ahead of the server's word, it is taken to be flying still after this long without it, in seconds.
export const MAX_UNCONFIRMED_SECONDS = 1;
// A burst the server tells of this far from the one shown is another, in world units.
const SAME_BURST_DISTANCE = 1;
// The longest it flies in one go, in seconds, however long it is since it last did: a page long out of sight flies
// none of what it missed.
const MAX_STEP_SECONDS = 0.25;
// How many times in one go it may bounce off something before it rests until the next, as the server's does (see
// CannonBallUtil).
const MAX_BOUNCES_PER_STEP = 4;
// A bounce it makes ahead of the server's word is taken back after this long without one, in seconds: longer than the
// server's steps are apart, by more than the way from it may add.
export const MAX_UNTOLD_BOUNCE_SECONDS = 0.5;

// A cannon's ball, which the server flies and ends (see CannonBallUtil). A browser is told of one only as it is fired,
// whenever something turns it, and as it bursts; in between it flies the ball itself, as the server does (see
// CannonBallMotionUtil), through other balls, whose bounces the server tells of. Off a mirror, an NPC or a cannon it
// bounces at once, as the server's does: if the server's word of that hasn't come in a moment, its ball never did,
// and this one goes back to the way it went. Each bounce is shown as it is made here, or, made by the server's ball
// alone, as its word comes, which counts them. Where it strikes the room itself, or something else that stands still,
// it is shown bursting at once: the server's word of that, a moment later, brings whatever the blast did. At a body,
// which may not be where the server has it, it waits for that word instead.
export default class CannonBallGameObject extends GameObject
{
    // Every ball in the room.
    private static readonly ballIds: Set<string> = new Set();

    private instancedMeshComposer: InstancedMeshComposer;
    // Where it is and how it moves, as flown here since the server last said.
    private at: Vec3;
    private vel: Vec3;
    // How far from there it is drawn: what the server's word moved it by, closed up over a moment.
    private drawnOffset: Vec3 = {x: 0, y: 0, z: 0};
    private heldSeconds = 0;
    private owedSeconds = 0;
    // The bodies it was held at for nothing, and what it bounced off for nothing.
    private passedObjectIds: Set<string> | undefined;
    // How many times it has bounced, as flown here (see CannonBallState), and the last of those that was shown.
    private bounces: number;
    private bouncesShown: number;
    // The first bounce it made here that the server has yet to tell of: off what, where it was, how it went and how
    // many times it had bounced as it struck that, and how long it has flown since.
    private untoldBounce: {objectId: string, at: Vec3, vel: Vec3, bounces: number, seconds: number} | undefined;
    // Where it was shown bursting, and for how long the server has yet to say so. Once that proves wrong, it bursts
    // only on the server's word.
    private burstShownAt: Vec3 | undefined;
    private unconfirmedSeconds = 0;
    private burstConfirmed = false;
    private strikesUnseen = false;
    private updatedAt = performance.now();

    constructor(params: AddObjectSignal)
    {
        super(params);

        this.instancedMeshComposer = this.components.instancedMeshComposer as InstancedMeshComposer;
        if (!this.instancedMeshComposer)
            throw new Error("CannonBallGameObject requires InstancedMeshComposer component");

        const {pos, vel, bounces} = CannonBallStateUtil.getObjectState(params);
        this.at = pos;
        this.vel = vel;
        this.bounces = bounces;
        this.bouncesShown = bounces;
        this.obj.position.set(pos.x, pos.y, pos.z);
    }

    async onSpawn(): Promise<void>
    {
        await super.onSpawn();
        CannonBallGameObject.ballIds.add(this.params.objectId);
    }

    async onDespawn(): Promise<void>
    {
        CannonBallGameObject.ballIds.delete(this.params.objectId);
        await super.onDespawn();
    }

    onSetMetadata(key: ObjectMetadataKey, value: string)
    {
        super.onSetMetadata(key, value);
        if (key !== ObjectMetadataKeyEnumMap.CannonState)
            return;

        const state = CannonBallStateUtil.getObjectState(this.params);
        this.untoldBounce = undefined;
        if (state.exploded)
        {
            const shownAt = this.burstShownAt;
            if (shownAt == undefined || Vector3DUtil.distSqr(shownAt, state.pos) > SAME_BURST_DISTANCE * SAME_BURST_DISTANCE)
                this.showBurst(state.pos);
            this.burstConfirmed = true;
            cannonBlastObservable.set({position: state.pos, hitObjectIds: state.hitObjectIds, struck: state.struck});
            return;
        }

        // It flies on from where the server has it, drawn from where it was.
        if (this.burstShownAt != undefined)
            this.flyOnUnseeing();
        const {x, y, z} = this.obj.position;
        // A bounce of the server's ball that this one never made is shown where this one is drawn, about where it
        // would have made it (two balls that bounced having flown on into each other here), out the way the word
        // turns it.
        this.bounces = state.bounces;
        if (CannonBallStateUtil.isBounceCountAhead(this.bounces, this.bouncesShown))
        {
            const turn = Vector3DUtil.subtract(state.vel, this.vel);
            this.showBounce({x, y, z}, (Vector3DUtil.lengthSqr(turn) > 0) ? Vector3DUtil.normalize(turn) : {x: 0, y: 1, z: 0});
        }
        this.at = state.pos;
        this.vel = state.vel;
        this.drawnOffset = {x: x - state.pos.x, y: y - state.pos.y, z: z - state.pos.z};
        this.heldSeconds = 0;
        this.owedSeconds = 0;
    }

    // By the clock rather than the frame: the server's ball flies on however slowly this browser draws.
    update(_deltaTime: number)
    {
        const now = performance.now();
        const seconds = Math.min(MAX_STEP_SECONDS, 0.001 * (now - this.updatedAt));
        this.updatedAt = now;
        if (this.burstConfirmed)
            return;
        if (this.burstShownAt != undefined)
        {
            this.unconfirmedSeconds += seconds;
            if (this.unconfirmedSeconds < MAX_UNCONFIRMED_SECONDS)
                return;
            this.flyOnUnseeing();
        }

        this.fly(seconds);
        if (this.burstShownAt != undefined)
            return;
        if (this.untoldBounce != undefined && this.untoldBounce.seconds >= MAX_UNTOLD_BOUNCE_SECONDS)
            this.takeBackBounce();
        const kept = Math.exp(-SETTLE_RATE * seconds);
        this.drawnOffset.x *= kept;
        this.drawnOffset.y *= kept;
        this.drawnOffset.z *= kept;
        this.obj.position.set(this.at.x + this.drawnOffset.x, this.at.y + this.drawnOffset.y, this.at.z + this.drawnOffset.z);
        this.notifyTransformChanged();
    }

    private fly(seconds: number): void
    {
        const roomID = this.params.roomID;
        if (!PhysicsManager.hasRoom(roomID))
            return;

        const catchUp = Math.min(this.owedSeconds, CATCH_UP_SHARE * seconds);
        this.owedSeconds -= catchUp;
        let secondsLeft = seconds + catchUp;
        if (this.untoldBounce != undefined)
            this.untoldBounce.seconds += secondsLeft;
        for (let bounces = 0; bounces < MAX_BOUNCES_PER_STEP && secondsLeft > 0; ++bounces)
        {
            const flown = CannonBallMotionUtil.advance(roomID, this.at, this.vel, secondsLeft, this.getIgnoredObjectIds());
            secondsLeft = flown.secondsLeft;
            const hit = flown.hit;
            if (hit == undefined)
            {
                this.heldSeconds = 0;
                return;
            }
            // Whatever it strikes here the server's ball didn't, or its word would have come.
            if (this.strikesUnseen)
            {
                Object.assign(this.at, Vector3DUtil.add(this.at, Vector3DUtil.scale(this.vel, secondsLeft)));
                return;
            }
            if (hit.object != undefined && PhysicsSphereUtil.bounces(hit.object))
            {
                this.untoldBounce ??= {objectId: hit.object.objectId, at: {...this.at}, vel: {...this.vel},
                    bounces: this.bounces, seconds: secondsLeft};
                CannonBallMotionUtil.rebound(this.vel, hit.normal);
                this.bounces = CannonBallStateUtil.countBounce(this.bounces);
                // (One made again, the server's word having taken the ball back to before it, was shown already.)
                if (CannonBallStateUtil.isBounceCountAhead(this.bounces, this.bouncesShown))
                    this.showBounce(hit.center, hit.normal);
                continue;
            }
            if (hit.object == undefined || !PhysicsSphereUtil.isBody(PhysicsManager.physicsRooms[roomID], hit.object))
            {
                // Where a bounce the server has yet to tell of leads it, its ball may never come: it waits here.
                if (this.untoldBounce == undefined)
                    this.showBurst(this.at);
                return;
            }

            this.heldSeconds += secondsLeft;
            this.owedSeconds = Math.min(MAX_OWED_SECONDS, this.owedSeconds + secondsLeft);
            if (this.heldSeconds >= MAX_HELD_SECONDS)
            {
                this.passedObjectIds ??= new Set();
                this.passedObjectIds.add(hit.object.objectId);
                this.heldSeconds = 0;
            }
            return;
        }
    }

    private getIgnoredObjectIds(): ReadonlySet<string>
    {
        return (this.passedObjectIds == undefined) ? CannonBallGameObject.ballIds
            : new Set([...CannonBallGameObject.ballIds, ...this.passedObjectIds]);
    }

    private showBurst(position: Vec3): void
    {
        this.burstShownAt = {...position};
        this.unconfirmedSeconds = 0;
        this.instancedMeshComposer.setHidden(true);
        cannonBallBurstObservable.set({position: this.burstShownAt});
    }

    // Where its middle is as it bounces, and the way it comes off what it bounces off.
    private showBounce(middle: Vec3, normal: Vec3): void
    {
        this.bouncesShown = this.bounces;
        cannonBallBounceObservable.set({position: {...middle}, normal: {...normal}});
    }

    // The bounce the server never told of never happened: it is where it would have flown without it, drawn from
    // where it was, and passes what it bounced off.
    private takeBackBounce(): void
    {
        const {objectId, at, vel, bounces, seconds} = this.untoldBounce!;
        this.untoldBounce = undefined;
        const {x, y, z} = this.obj.position;
        this.at = Vector3DUtil.add(at, Vector3DUtil.scale(vel, seconds));
        this.vel = vel;
        this.bounces = bounces;
        this.bouncesShown = bounces;
        this.drawnOffset = {x: x - this.at.x, y: y - this.at.y, z: z - this.at.z};
        this.passedObjectIds ??= new Set();
        this.passedObjectIds.add(objectId);
    }

    // The burst shown never happened: drawn again, it goes wherever the server's ball does.
    private flyOnUnseeing(): void
    {
        this.burstShownAt = undefined;
        this.strikesUnseen = true;
        this.instancedMeshComposer.setHidden(false);
    }
}
