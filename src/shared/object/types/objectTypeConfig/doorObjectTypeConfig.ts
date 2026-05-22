import Room from "../../../room/types/room";
import User from "../../../user/types/user";
import { UserRole } from "../../../user/types/userRole";
import AddObjectSignal from "../addObjectSignal";
import ObjectTypeConfig from "./objectTypeConfig";
import SetObjectMetadataSignal from "../setObjectMetadataSignal";
import SetObjectTransformSignal from "../setObjectTransformSignal";

// This object represents the room's entrance door. This is the only gateway through which
// players (users) can move from room to room.
const DoorObjectTypeConfig: ObjectTypeConfig =
{
    objectType: "Door",
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
            collider: {
                colliderType: "standalone",
                hitboxSize: {sizeX: 2.85, sizeY: 3.719, sizeZ: 0.01}, // matches the door mesh footprint
                applyHardCollisionToOthers: false, // pass-through: the wall behind already blocks the player
                outgoingSoftCollisionForceMultiplier: 0,
                incomingSoftCollisionForceMultiplier: 0,
                maxClimbableHeight: 0,
            },
            playerProximityDetector: {
                maxDist: 3.5,
                maxLookAngle: 0.25*Math.PI,
            },
            speechBubble: {
                yOffset: 2,
                checkLineOfSight: false,
                prependUserNameToMessage: false,
                showMessageIfSpawnedByMe: true,
                showMessageIfSpawnedByOther: true,
            },
            meshGraphics: {
                path: "door.webp",
                geometryId: "Square",
                localPosition: {x: 0, y: 1.84, z: 0.001},
                scale: {x: 2.85, y: 3.719, z: 1}, // y = x * 1.3049
            },
        },
    },
}

export default DoorObjectTypeConfig;