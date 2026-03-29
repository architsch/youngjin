import Room from "../../room/types/room";
import { RoomTypeEnumMap } from "../../room/types/roomType";
import { IS_SERVER, MAX_CANVASES_PER_ROOM, MAX_IMAGE_URL_LENGTH } from "../../system/sharedConstants";
import User from "../../user/types/user";
import { UserRole, UserRoleEnumMap } from "../../user/types/userRole";
import AddObjectSignal from "../types/addObjectSignal";
import { ObjectMetadataKeyEnumMap } from "../types/objectMetadataKey";
import ObjectTypeConfig from "../types/objectTypeConfig";
import SetObjectMetadataSignal from "../types/setObjectMetadataSignal";
import SetObjectTransformSignal from "../types/setObjectTransformSignal";

// This map specifies all types of GameObject and their global configs.
// Each config specifies all types of GameObjectComponents which must be included in the
// GameObject when it spawns (Each GameObject can have one or more GameObjectComponents in it).
const objectTypeConfigPairs: [number, ObjectTypeConfig][] = [
    [0, { // This object represents each voxel in the room's voxelGrid. Each voxel consists of blocks, and each block consists of quads (aka "voxelQuads").
        objectType: "Voxel",
        persistent: false,
        canUserAddObject: (user: User, userRole: UserRole, room: Room, obj: AddObjectSignal) => {
            return false;
        },
        canUserRemoveObject: (user: User, userRole: UserRole, room: Room, obj: AddObjectSignal) => {
            return false;
        },
        canUserSetObjectTransform: (user: User, userRole: UserRole, room: Room, obj: AddObjectSignal, signal: SetObjectTransformSignal) => {
            return false;
        },
        canUserSetObjectMetadata: (user: User, userRole: UserRole, room: Room, obj: AddObjectSignal, signal: SetObjectMetadataSignal) => {
            return false;
        },
        components: {
            spawnedByAny: {
                // Collider is not needed here because the physics system handles voxels under a separate logic.
                instancedMeshGraphics: {
                    createInstanceIdPool: false,
                },
            },
        },
    }],
    [1, { // This object represents each user's player character. Users directly control their player characters in first-person view, using input devices (such as mouse and keyboard).
        objectType: "Player",
        persistent: false,
        canUserAddObject: (user: User, userRole: UserRole, room: Room, obj: AddObjectSignal) => {
            return IS_SERVER; // Only the server can add a player character.
        },
        canUserRemoveObject: (user: User, userRole: UserRole, room: Room, obj: AddObjectSignal) => {
            return IS_SERVER; // Only the server can remove a player character.
        },
        canUserSetObjectTransform: (user: User, userRole: UserRole, room: Room, obj: AddObjectSignal, signal: SetObjectTransformSignal) => {
            // User can only move his/her own player character
            if (obj.sourceUserID != user.id || obj.sourceUserName != user.userName)
                return false;

            // Player movement must obey the laws of physics
            if (signal.ignorePhysics)
                return false;

            return true;
        },
        canUserSetObjectMetadata: (user: User, userRole: UserRole, room: Room, obj: AddObjectSignal, signal: SetObjectMetadataSignal) => {
            // User can only set the metadata of his/her own player character
            if (obj.sourceUserID != user.id || obj.sourceUserName != user.userName)
                return false;

            // User can only set the player's message nothing else
            if (signal.metadataKey != ObjectMetadataKeyEnumMap.SentMessage)
                return false;

            return true;
        },
        components: {
            spawnedByAny: {
                collider: {
                    colliderType: "rigidbody",
                    hitboxSize: {sizeX: 0.6, sizeY: 2.5, sizeZ: 0.6},
                },
                speechBubble: {
                    yOffset: 2.4,
                    prependUserNameToMessage: true,
                    showMessageIfSpawnedByMe: false,
                    showMessageIfSpawnedByOther: true,
                },
                playerProximityDetector: { // This is to prevent the mesh of any nearby player from clipping through the camera's view.
                    maxDist: 0.45,
                    maxLookAngle: -1,
                },
            },
            spawnedByMe: {
                firstPersonController: {},
                periodicTransformEmitter: {},
                rigidbody: {},
            },
            spawnedByOther: {
                modelGraphics: {
                    path: "lowpolyghost/lowpolyghost.glb",
                    localPosition: {x: 0, y: 1.22, z: 0},
                    scale: {x: 0.3, y: 0.3, z: 0.3},
                },
                periodicTransformReceiver: {},
            },
        },
    }],
    [2, { // This object represents a canvas (image) that can be exhibited in the room (like a painting in an art gallery).
        objectType: "Canvas",
        persistent: true,
        canUserAddObject: (user: User, userRole: UserRole, room: Room, obj: AddObjectSignal) => {
            // Block users who have no editing privilege
            const userCanEditRoom = room.roomType == RoomTypeEnumMap.Hub ||
                userRole == UserRoleEnumMap.Owner ||
                userRole == UserRoleEnumMap.Editor;
            if (!userCanEditRoom)
                return false;

            // Block spoofing attempts
            if (obj.sourceUserID != user.id || obj.sourceUserName != user.userName)
                return false;

            // Block users from adding too many canvases
            const typeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");
            const canvasCount = Object.values(room.objectById)
                .filter(obj => obj.objectTypeIndex === typeIndex).length;
            if (canvasCount >= MAX_CANVASES_PER_ROOM)
                return false;

            return true;
        },
        canUserRemoveObject: (user: User, userRole: UserRole, room: Room, obj: AddObjectSignal) => {
            // Block users who have no editing privilege
            const userCanEditRoom = room.roomType == RoomTypeEnumMap.Hub ||
                userRole == UserRoleEnumMap.Owner ||
                userRole == UserRoleEnumMap.Editor;
            if (!userCanEditRoom)
                return false;

            return true;
        },
        canUserSetObjectTransform: (user: User, userRole: UserRole, room: Room, obj: AddObjectSignal, signal: SetObjectTransformSignal) => {
            // Block users who have no editing privilege
            const userCanEditRoom = room.roomType == RoomTypeEnumMap.Hub ||
                userRole == UserRoleEnumMap.Owner ||
                userRole == UserRoleEnumMap.Editor;
            if (!userCanEditRoom)
                return false;

            // Canvas movement must ignore physics
            if (!signal.ignorePhysics)
                return false;

            return true;
        },
        canUserSetObjectMetadata: (user: User, userRole: UserRole, room: Room, obj: AddObjectSignal, signal: SetObjectMetadataSignal) => {
            // Block users who have no editing privilege
            const userCanEditRoom = room.roomType == RoomTypeEnumMap.Hub ||
                userRole == UserRoleEnumMap.Owner ||
                userRole == UserRoleEnumMap.Editor;
            if (!userCanEditRoom)
                return false;

            // User can only set the canvas's image URL and nothing else
            if (signal.metadataKey != ObjectMetadataKeyEnumMap.ImageURL)
                return false;

            // Image URL must not exceed its maximum length
            if (signal.metadataValue.length > MAX_IMAGE_URL_LENGTH)
                return false;

            return true;
        },
        components: {
            spawnedByAny: {
                collider: {
                    colliderType: "wallAttachment",
                    hitboxSize: {sizeX: 0.98, sizeY: 0.98, sizeZ: 0.01},
                },
                instancedMeshGraphics: {
                    createInstanceIdPool: true,
                },
            },
        },
    }],
];

const indexToConfig: {[objectTypeIndex: number]: ObjectTypeConfig} = {};
const typeToIndex: {[objectType: string]: number} = {};

objectTypeConfigPairs.forEach(pair => {
    indexToConfig[pair[0]] = pair[1];
    typeToIndex[pair[1].objectType] = pair[0];
});

const ObjectTypeConfigMap =
{
    getConfigByIndex: (objectTypeIndex: number): ObjectTypeConfig =>
    {
        const config = indexToConfig[objectTypeIndex];
        if (config == undefined)
            throw new Error(`getConfigByIndex :: Invalid object type index (objectTypeIndex = ${objectTypeIndex})`);
        return config;
    },
    getIndexByType: (objectType: string): number =>
    {
        const objectTypeIndex = typeToIndex[objectType];
        if (objectTypeIndex == undefined)
            throw new Error(`getIndexByType :: Invalid object type (objectType = ${objectType})`);
        return objectTypeIndex;
    },
}

export default ObjectTypeConfigMap;