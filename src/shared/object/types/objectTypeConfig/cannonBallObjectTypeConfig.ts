import { InstancedMeshCompositionCodecTypeEnumMap } from "../../../graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import CannonCompositionUtil from "../../../graphics/mesh/composition/util/cannonCompositionUtil";
import AddObjectSignal from "../addObjectSignal";
import { ObjectCategoryEnumMap } from "../objectCategory";
import ObjectTypeConfig from "./objectTypeConfig";

export const CANNON_BALL_RADIUS = 0.25;
// How fast a ball leaves its cannon, in world units a second: slow enough to step out of the way of. A fan's stream
// may speed one up, never past the most.
export const CANNON_BALL_SPEED = 3;
export const CANNON_BALL_MAX_SPEED = 6;
// The share of the push a fan's stream gives a body (see PhysicsForceUtil) that a ball takes, being heavy.
export const CANNON_BALL_WIND_SHARE = 0.2;
// How far from where a ball strikes its blast reaches, in world units.
export const CANNON_BALL_BLAST_RADIUS = 0.5;
// How far past the room a ball flies before it is gone, in world units.
export const CANNON_BALL_VANISH_DISTANCE = 20;
// How a blast throws a body it reaches, in world units a second: across the room, away from the ball, and upward.
export const CANNON_BLAST_PUSH_SPEED = 64;
export const CANNON_BLAST_LIFT_SPEED = 44;

// A cannon's ball, which the server fires and flies (see CannonBallUtil): straight, with no weight, but for what a
// fan's stream does to it. Nobody may touch it by any signal. Whatever it strikes it bursts on, throwing the players
// its blast reaches and breaking the blocks it reaches that anyone could remove; two balls bounce off each other
// instead. It is no part of what is built, though the room's saves keep it (see ObjectTypeConfigMap.isStoredWithRoom).
// Its collider is a sphere. Its place and speed are its CannonState (see CannonBallStateUtil), since it may fly past
// what a transform holds.
const CannonBallObjectTypeConfig =
{
    objectType: "CannonBall",
    persistent: false,
    autoUnload: true,
    category: ObjectCategoryEnumMap.CannonBall,
    canUserAddObject: () => false,
    canUserRemoveObject: () => false,
    canUserSetObjectTransform: () => false,
    canUserSetObjectMetadata: () => false,
    components: {
        spawnedByAny: {
            collider: {
                baseHitboxSize: {
                    sizeX: 2 * CANNON_BALL_RADIUS,
                    sizeY: 2 * CANNON_BALL_RADIUS,
                    sizeZ: 2 * CANNON_BALL_RADIUS
                },
                shape: "sphere",
                // Nothing a body walks into: only its bursting moves anyone.
                applyHardCollisionToOthers: false,
                outgoingSoftCollisionForceMultiplier: 0,
                incomingSoftCollisionForceMultiplier: 0,
                maxClimbableHeight: 0,
            },
            instancedMeshGraphics: {},
            instancedMeshComposer: {
                codecType: InstancedMeshCompositionCodecTypeEnumMap.CannonBall,
                codecVersion: 0,
                generateDefaultParts: (obj: AddObjectSignal) => {
                    return {params: {}, parts: CannonCompositionUtil.buildBallParts(2 * CANNON_BALL_RADIUS)};
                },
            },
        },
    },
} satisfies ObjectTypeConfig;

export default CannonBallObjectTypeConfig;
