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
    autoUnload: true,
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
                // The door is a panel filling a doorway, and prompts only those standing in front
                // of its face. That rules out two positions a player really does end up in: behind
                // it, which is where he spawns on arriving in the room, looking straight through it
                // on his way out into the room; and flat against the wall beside it, where the
                // panel is edge-on and there is nothing of it left to see. Wide enough to keep the
                // whole approach to a door of this width, up to standing at the edge of the panel a
                // pace out from the wall.
                maxFaceAngle: Math.PI/3,
                checkLineOfSight: true, // A door across the room can stand behind anything built since.
            },
            speechBubble: {
                yOffset: 2,
                checkLineOfSight: false,
                prependUserNameToMessage: false,
            },
            meshGraphics: {
                path: "door.webp",
                geometryId: "Square",
                localPosition: {x: 0, y: 1.84, z: 0.001},
                scale: {x: 2.85, y: 3.719, z: 1}, // y = x * 1.3049
            },
            orbitOccluder: {}, // Part of the wall it sits in, as far as the orbit camera is concerned.
        },
    },
}

export default DoorObjectTypeConfig;