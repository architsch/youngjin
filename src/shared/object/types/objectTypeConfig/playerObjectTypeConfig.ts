import Room from "../../../room/types/room";
import User from "../../../user/types/user";
import AddObjectSignal from "../addObjectSignal";
import { ObjectCategoryEnumMap } from "../objectCategory";
import { ObjectMetadataKeyEnumMap } from "../objectMetadataKey";
import ObjectTypeConfig from "./objectTypeConfig";
import ObjectScaleUtil from "../../util/objectScaleUtil";
import SetObjectMetadataSignal from "../setObjectMetadataSignal";
import SetObjectTransformSignal from "../setObjectTransformSignal";
import { InstancedMeshCompositionCodecTypeEnumMap } from "../../../graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import { PlayerCompositionCodec } from "../../../graphics/mesh/composition/types/compositionCodec/playerCompositionCodec";
import StringUtil from "../../../math/util/stringUtil";
import { OBJECT_MESSAGE_MAX_LENGTH } from "../../../system/sharedConstants";

// The player collider size; exported because much of the game measures against the player's body.
export const PLAYER_HEIGHT = 2.5;
export const PLAYER_RADIUS_XZ = 0.375; // radius of the player on the XZ plane.

// How fast a player walks and turns per unit of steering, and how much steering there can be, whoever steers (see
// PlayerController, AgentBodyUtil).
export const PLAYER_WALK_SPEED_PER_INPUT = 9;
export const PLAYER_MAX_WALK_INPUT = 0.6;
export const PLAYER_TURN_RATE_PER_INPUT = 3; // radians per second
export const PLAYER_MAX_TURN_INPUT = 1;

// This object represents each user's player character. Users directly control their player characters in first-person view, using input devices (such as mouse and keyboard).
const PlayerObjectTypeConfig =
{
    objectType: "Player",
    persistent: false,
    autoUnload: true,
    category: ObjectCategoryEnumMap.Player,
    // No user may add or remove a player character: the server spawns one as its user joins and removes it as
    // they leave (see ServerObjectManager.addObjectAsServer).
    canUserAddObject: (user: User, room: Room, obj: AddObjectSignal) => {
        return false;
    },
    canUserRemoveObject: (user: User, room: Room, obj: AddObjectSignal) => {
        return false;
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

        // User can only set the player's message, appearance or admin prefs (admins only; see
        // ObjectMetadataEntryMap), nothing else
        if (signal.metadataKey != ObjectMetadataKeyEnumMap.SentMessage &&
            signal.metadataKey != ObjectMetadataKeyEnumMap.InstancedMeshComposition &&
            signal.metadataKey != ObjectMetadataKeyEnumMap.AdminPrefs)
            return false;

        // A player's message is no longer than the chat input takes, though the key holds an NPC's longer lines.
        if (signal.metadataKey == ObjectMetadataKeyEnumMap.SentMessage)
        {
            const message = signal.metadataValue.trim();
            if (StringUtil.truncateByCodePoints(message, OBJECT_MESSAGE_MAX_LENGTH) != message)
                return false;
        }

        return true;
    },
    components: {
        spawnedByAny: {
            instancedMeshGraphics: {},
            instancedMeshComposer: {
                codecType: InstancedMeshCompositionCodecTypeEnumMap.Player,
                codecVersion: 0,
                generateDefaultParts: (obj: AddObjectSignal) => {
                    const hashCode = StringUtil.getHashCode(obj.sourceUserID);
                    return PlayerCompositionCodec.getRandomComposition(hashCode,
                        ObjectScaleUtil.getObjectSize(obj.objectTypeIndex, obj.transform.scale));
                },
            },
            collider: {
                baseHitboxSize: {sizeX: 2 * PLAYER_RADIUS_XZ, sizeY: PLAYER_HEIGHT, sizeZ: 2 * PLAYER_RADIUS_XZ},
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