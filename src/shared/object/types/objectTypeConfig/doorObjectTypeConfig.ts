import { DoorCompositionCodec } from "../../../graphics/mesh/composition/types/compositionCodec/doorCompositionCodec";
import { InstancedMeshCompositionCodecTypeEnumMap } from "../../../graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import StringUtil from "../../../math/util/stringUtil";
import Room from "../../../room/types/room";
import { DOOR_FOOTPRINT_HEIGHT, DOOR_FOOTPRINT_WIDTH, MAX_DOORS_PER_ROOM, MAX_MESH_INSTANCES_PER_DOOR } from "../../../system/sharedConstants";
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
        // A door's appearance is decided for it and is not the user's to change. The composition it
        // is decided as is nonetheless a plain, editable set of colors (see DoorCompositionCodec),
        // so that letting the user finish his own doors is a matter of opening this up.
        return false;
    },
    components: {
        spawnedByAny: {
            collider: {
                // A door lays claim to the stretch of wall it hangs on, so nothing else can be hung
                // over it — which the room's entrance door needs as much as an owner's own door
                // would, having spent every previous version of this object being hangable-over.
                colliderType: "wallAttachment",
                hitboxSize: {sizeX: DOOR_FOOTPRINT_WIDTH, sizeY: DOOR_FOOTPRINT_HEIGHT, sizeZ: 0.01},
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
                maxFaceAngle: Math.PI/4,
                checkLineOfSight: true, // A door across the room can stand behind anything built since.
            },
            speechBubble: {
                yOffset: 0.25,
                checkLineOfSight: false,
                prependUserNameToMessage: false,
            },
            instancedMeshGraphics: {},
            instancedMeshComposer: {
                maxNumInstancesPerMesh: MAX_DOORS_PER_ROOM * MAX_MESH_INSTANCES_PER_DOOR,
                codecType: InstancedMeshCompositionCodecTypeEnumMap.Door,
                codecVersion: 0,
                generateDefaultParts: (obj: AddObjectSignal) => {
                    // Seeded from where the door stands rather than from who is looking at it: a
                    // client-spawned object carries the viewing user's id (see ObjectFactory), so
                    // seeding from that would give every player in a room a different door. The
                    // room and the door's own id are the same for everyone and the same next
                    // session, which is what makes a room's door recognizably its own.
                    const hashCode = StringUtil.getHashCode(`${obj.roomID}/${obj.objectId}`);
                    return DoorCompositionCodec.getRandomComposition(hashCode);
                },
            },
            orbitOccluder: {}, // Part of the wall it sits in, as far as the orbit camera is concerned.
        },
    },
}

export default DoorObjectTypeConfig;
