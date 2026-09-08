import Room from "../../../room/types/room";
import { IS_SERVER } from "../../../system/sharedConstants";
import User from "../../../user/types/user";
import AddObjectSignal from "../addObjectSignal";
import { ObjectMetadataKeyEnumMap } from "../objectMetadataKey";
import ObjectTypeConfig from "./objectTypeConfig";
import SetObjectMetadataSignal from "../setObjectMetadataSignal";
import SetObjectTransformSignal from "../setObjectTransformSignal";
import { InstancedMeshCompositionCodecTypeEnumMap } from "../../../graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import { PlayerCompositionCodec } from "../../../graphics/mesh/composition/types/compositionCodec/playerCompositionCodec";
import StringUtil from "../../../math/util/stringUtil";

// How big a player character stands in the world. The two of them are the player's collider, which
// is where anything that has to measure against a player's body — where his eyes sit, how far a
// selection ring floats over his head, which collision layer he is standing on — reads them back
// from. Exported as well, because a great deal of the game is measured against a player and the
// expressions doing the measuring stay legible only if the quantity is named.
export const PLAYER_HEIGHT = 2.5;
export const PLAYER_RADIUS_XZ = 0.375; // radius of the player on the XZ plane.

// Every player character in the room draws its parts from one pool of mesh instances, so the room
// can only hold as many as that pool was sized for. The cap is also what the room balancer fills
// rooms up to (see RoomPickerUtil).
export const MAX_PLAYERS_PER_ROOM = 64;
const MAX_MESH_INSTANCES_PER_PLAYER = 32;

// This object represents each user's player character. Users directly control their player characters in first-person view, using input devices (such as mouse and keyboard).
const PlayerObjectTypeConfig =
{
    objectType: "Player",
    persistent: false,
    autoUnload: true,
    maxCountPerRoom: MAX_PLAYERS_PER_ROOM,
    canUserAddObject: (user: User, room: Room, obj: AddObjectSignal) => {
        return IS_SERVER; // Only the server can add a player character.
    },
    canUserRemoveObject: (user: User, room: Room, obj: AddObjectSignal) => {
        return IS_SERVER; // Only the server can remove a player character.
    },
    canUserSetObjectTransform: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectTransformSignal) => {
        // User can only move his/her own player character
        if (obj.sourceUserID != user.id)
            return false;

        // Player movement must obey the laws of physics
        if (signal.ignorePhysics)
            return false;

        return true;
    },
    canUserSetObjectMetadata: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectMetadataSignal) => {
        // User can only set the metadata of his/her own player character
        if (obj.sourceUserID != user.id)
            return false;

        // User can only set the player's message or appearance, nothing else
        if (signal.metadataKey != ObjectMetadataKeyEnumMap.SentMessage &&
            signal.metadataKey != ObjectMetadataKeyEnumMap.InstancedMeshComposition)
            return false;

        return true;
    },
    components: {
        spawnedByAny: {
            instancedMeshGraphics: {},
            instancedMeshComposer: {
                maxNumInstancesPerMesh: MAX_PLAYERS_PER_ROOM * MAX_MESH_INSTANCES_PER_PLAYER,
                codecType: InstancedMeshCompositionCodecTypeEnumMap.Player,
                codecVersion: 0,
                generateDefaultParts: (obj: AddObjectSignal) => {
                    const hashCode = StringUtil.getHashCode(obj.sourceUserID);
                    return PlayerCompositionCodec.getRandomComposition(hashCode);
                },
            },
            collider: {
                colliderType: "rigidbody",
                hitboxSize: {sizeX: 2 * PLAYER_RADIUS_XZ, sizeY: PLAYER_HEIGHT, sizeZ: 2 * PLAYER_RADIUS_XZ},
                applyHardCollisionToOthers: false,
                outgoingSoftCollisionForceMultiplier: 1,
                outgoingSoftCollisionForceLimit: {x: 1, y: 0, z: 1},
                incomingSoftCollisionForceMultiplier: 1,
                maxClimbableHeight: 0.2 * PLAYER_HEIGHT + 0.1, // a little bit more than the height of a voxel block, which is (0.2 * PLAYER_HEIGHT).
            },
            speechBubble: {
                yOffset: 0.5*PLAYER_HEIGHT,
                checkLineOfSight: true,
                prependUserNameToMessage: true,
            },
            playerProximityDetector: { // This is to prevent the mesh of any nearby player from clipping through the camera's view.
                maxDist: 0.45,
                maxLookAngle: -1,
                maxFaceAngle: -1,
                checkLineOfSight: false, // A body this close to the camera is in the way whether it is in view or not.
            },
            easingMotion: {},
        },
        spawnedByMe: {
            playerController: {},
            periodicTransformEmitter: {},
            rigidbody: {},
        },
        spawnedByOther: {
            periodicTransformReceiver: {},
        },
    },
} satisfies ObjectTypeConfig;

export default PlayerObjectTypeConfig;