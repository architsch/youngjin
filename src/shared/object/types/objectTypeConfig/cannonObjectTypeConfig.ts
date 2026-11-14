import { InstancedMeshCompositionCodecTypeEnumMap } from "../../../graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import InstancedMeshCompositionPart from "../../../graphics/mesh/composition/types/instancedMeshCompositionPart";
import CannonCompositionUtil from "../../../graphics/mesh/composition/util/cannonCompositionUtil";
import Room from "../../../room/types/room";
import { RoomTypeEnumMap } from "../../../room/types/roomType";
import { ATTACHMENT_HITBOX_INSET, CANNON_PRICE_DOLLARS, DIR_VEC_BY_NAME,
    WALL_DIRECTIONS } from "../../../system/sharedConstants";
import User from "../../../user/types/user";
import AddObjectSignal from "../addObjectSignal";
import { ObjectCategoryEnumMap } from "../objectCategory";
import { ObjectMetadata } from "../objectMetadata";
import { ObjectMetadataKeyEnumMap } from "../objectMetadataKey";
import SetObjectMetadataSignal from "../setObjectMetadataSignal";
import SetObjectTransformSignal from "../setObjectTransformSignal";
import CannonAimUtil from "../../util/cannonAimUtil";
import CannonStateUtil from "../../util/cannonStateUtil";
import ObjectTypeConfig from "./objectTypeConfig";

// How many balls a cannon comes with: it destroys itself once it has fired the last. How many it fires in a row once
// switched on, after which it switches itself off.
export const CANNON_BALL_COUNT = 20;
export const CANNON_SHOTS_IN_A_ROW = 4;
// How long a cannon rests once installed or switched on, before anything else, in seconds; then how long it waits,
// as after each shot, before it turns to someone, a while picked at random between the two; and how long it stands
// aimed before it fires.
export const CANNON_REST_SECONDS = 2;
export const CANNON_FIRE_INTERVAL_SECONDS = [6, 10];
export const CANNON_READY_SECONDS = 0.5;
// Whom it fires at: the nearest player, if no farther from its pivot than this nor nearer than this, in world units.
export const CANNON_MAX_RANGE = 16;
export const CANNON_MIN_RANGE = 2;
// How fast its barrel turns, in radians a second, written from its degrees a second: slowly enough for someone
// walking round it to keep ahead of. How near to pointing at them is on them, in radians, and how long it must have
// them in its sights without a break (see CannonUtil) before it is aimed.
export const CANNON_TURN_RATE = 30 * Math.PI / 180;
export const CANNON_AIM_TOLERANCE = 0.03;
export const CANNON_LOCK_SECONDS = 1;
// How long it stands after its last ball, before it destroys itself, or after the last of a row, before it switches
// itself off.
export const CANNON_SPENT_SECONDS = 0.8;
// How far its barrel tilts from the face it stands on, in radians, and how far it droops on a floor while switched
// off (see CannonAimUtil.getSleepAim).
export const CANNON_MIN_PITCH = -0.25 * Math.PI;
export const CANNON_MAX_PITCH = 0.5 * Math.PI;
export const CANNON_SLEEP_PITCH = -0.5;
// How far over its middle its sleep shows rising, in world units.
const SLEEP_EFFECT_HEIGHT = 0.6;

// Cannons, on floors and walls: a barrel on a pillar, which the server plays (see CannonUtil). Every so often one turns
// after the nearest player and, aimed, fires a ball at where they stand (see CannonBallObjectTypeConfig), a few in a
// row before it switches itself off, until it has fired its last and destroys itself; its counters show how many are
// left (see CannonCompositionUtil). Anyone may add one, for a price, switch it off and on, move it or remove it,
// subject to restricted zones (see ObjectUpdateUtil). All it keeps of itself is its CannonState, of which a user sets
// the switch alone.
const CannonObjectTypeConfig =
{
    objectType: "Cannon",
    persistent: true,
    autoUnload: true,
    category: ObjectCategoryEnumMap.Cannon,
    // A whole unit cube standing out of its face, which it needs open (see ObjectAttachmentUtil).
    attachment: {
        allowedDirections: [...WALL_DIRECTIONS, DIR_VEC_BY_NAME["+y"]],
        standsOut: true,
    },
    price: CANNON_PRICE_DOLLARS,
    canUserAddObject: (user: User, room: Room, obj: AddObjectSignal) => {
        // Block spoofing attempts. Only into a room the server plays: a single-player room's would just stand there.
        return obj.sourceUserID == user.id && room.roomType != RoomTypeEnumMap.SinglePlayer;
    },
    canUserRemoveObject: (user: User, room: Room, obj: AddObjectSignal) => {
        return true;
    },
    canUserSetObjectTransform: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectTransformSignal) => {
        // A cannon is dragged from face to face by a gizmo, which is a placement rather than a motion.
        return signal.ignorePhysics;
    },
    canUserSetObjectMetadata: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectMetadataSignal) => {
        // Its switch alone: the rest of its state is the server's (see CannonStateUtil.merge).
        return signal.metadataKey == ObjectMetadataKeyEnumMap.CannonState && CannonStateUtil.isSwitch(signal.metadataValue);
    },
    components: {
        spawnedByAny: {
            collider: {
                // As solid as a block. A little short of the cube's far side, so that it clears what is on a face
                // there; across its face the tested box is inset as any attached object's (see
                // PhysicsColliderStateUtil).
                baseHitboxSize: {
                    sizeX: 1,
                    sizeY: 1,
                    sizeZ: 1 - ATTACHMENT_HITBOX_INSET
                },
                bouncesSpheres: true, // a cannon ball comes off its box where the two touch
                applyHardCollisionToOthers: true,
                outgoingSoftCollisionForceMultiplier: 1,
                incomingSoftCollisionForceMultiplier: 0,
                maxClimbableHeight: 0,
            },
            instancedMeshGraphics: {},
            instancedMeshComposer: {
                codecType: InstancedMeshCompositionCodecTypeEnumMap.Cannon,
                codecVersion: 0,
                generateDefaultParts: (obj: AddObjectSignal) => {
                    return {params: {}, parts: CannonCompositionUtil.buildParts()};
                },
                // Its barrel points where its state has it aim, and its counters show the balls left. Changes of
                // either recompose the parts (see CannonGameObject), which turns the barrel smoothly between them.
                deriveParts: (obj: AddObjectSignal, parts: InstancedMeshCompositionPart[]) => {
                    const state = CannonStateUtil.getObjectState(obj);
                    CannonCompositionUtil.pose(parts, obj.transform.dir,
                        CannonAimUtil.getLocalDirection(CannonStateUtil.getShownAim(state, obj.transform.dir)),
                        state.ballsLeft);
                },
            },
            // Only while it is switched off.
            particleEmitter: {
                baseline: {effect: "cannonSleep", upright: true, faceOffset: SLEEP_EFFECT_HEIGHT},
                getOverride: (metadata: ObjectMetadata) => ({
                    rateScale: CannonStateUtil.decode(metadata[ObjectMetadataKeyEnumMap.CannonState]?.str ?? "").on ? 0 : 1,
                }),
            },
        },
    },
} satisfies ObjectTypeConfig;

export default CannonObjectTypeConfig;
