import Room from "../../../room/types/room";
import { IS_SERVER, PLAYER_HEIGHT } from "../../../system/sharedConstants";
import User from "../../../user/types/user";
import { UserRole } from "../../../user/types/userRole";
import AddObjectSignal from "../addObjectSignal";
import { ObjectMetadataKeyEnumMap } from "../objectMetadataKey";
import ObjectTypeConfig from "./objectTypeConfig";
import SetObjectMetadataSignal from "../setObjectMetadataSignal";
import SetObjectTransformSignal from "../setObjectTransformSignal";

// This object represents each user's player character. Users directly control their player characters in first-person view, using input devices (such as mouse and keyboard).
const PlayerObjectTypeConfig: ObjectTypeConfig =
{
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
        if (obj.sourceUserID != user.id)
            return false;

        // Player movement must obey the laws of physics
        if (signal.ignorePhysics)
            return false;

        return true;
    },
    canUserSetObjectMetadata: (user: User, userRole: UserRole, room: Room, obj: AddObjectSignal, signal: SetObjectMetadataSignal) => {
        // User can only set the metadata of his/her own player character
        if (obj.sourceUserID != user.id)
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
                hitboxSize: {sizeX: 0.6, sizeY: PLAYER_HEIGHT, sizeZ: 0.6},
                applyHardCollisionToOthers: false,
                outgoingSoftCollisionForceMultiplier: 1,
                outgoingSoftCollisionForceLimit: {x: 1, y: 0, z: 1},
                incomingSoftCollisionForceMultiplier: 1,
                maxClimbableHeight: 0.6, // a little bit more than the height of a voxel block
            },
            speechBubble: {
                yOffset: 0.5*PLAYER_HEIGHT,
                checkLineOfSight: true,
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
                localPosition: {x: 0, y: 0, z: 0},
                scale: {x: 0.3, y: 0.3, z: 0.3},
            },
            periodicTransformReceiver: {},
            // Lets the receptionist (and other remote players) play a cosmetic bounce, e.g. an NPC
            // nodding when it replies. It animates the visual node, so it stays out of the way of
            // the networked transform the receiver drives.
            easingMotion: {},
        },
    },
}

export default PlayerObjectTypeConfig;