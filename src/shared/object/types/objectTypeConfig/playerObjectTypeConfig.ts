import Room from "../../../room/types/room";
import { IS_SERVER } from "../../../system/sharedConstants";
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

// The player collider size; exported because much of the game measures against the player's body.
export const PLAYER_HEIGHT = 2.5;
export const PLAYER_RADIUS_XZ = 0.375; // radius of the player on the XZ plane.

// This object represents each user's player character. Users directly control their player characters in first-person view, using input devices (such as mouse and keyboard).
const PlayerObjectTypeConfig =
{
    objectType: "Player",
    persistent: false,
    autoUnload: true,
    category: ObjectCategoryEnumMap.Player,
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