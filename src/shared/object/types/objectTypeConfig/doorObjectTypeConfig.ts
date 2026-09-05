import { DoorCompositionCodec } from "../../../graphics/mesh/composition/types/compositionCodec/doorCompositionCodec";
import DoorCompositionConstants from "../../../graphics/mesh/composition/types/compositionConstants/doorCompositionConstants";
import { DOOR_PANEL_ORIGIN_Y } from "../../../graphics/mesh/composition/types/compositionBuilder/doorCompositionBuilder";
import { InstancedMeshCompositionCodecTypeEnumMap } from "../../../graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import StringUtil from "../../../math/util/stringUtil";
import Room from "../../../room/types/room";
import RoomValidationUtil from "../../../room/util/roomValidationUtil";
import { DOOR_FOOTPRINT_HEIGHT, DOOR_FOOTPRINT_WIDTH, MAX_DOORS_PER_ROOM, MAX_MESH_INSTANCES_PER_DOOR } from "../../../system/sharedConstants";
import User from "../../../user/types/user";
import AddObjectSignal from "../addObjectSignal";
import ObjectTypeConfig from "./objectTypeConfig";
import ObjectTypeConfigMap from "../../maps/objectTypeConfigMap";
import SetObjectMetadataSignal from "../setObjectMetadataSignal";
import SetObjectTransformSignal from "../setObjectTransformSignal";
import { ObjectMetadataKeyEnumMap } from "../objectMetadataKey";

// The metadata an admin is allowed to write onto a door. Everything a door is — where it leads, what
// it is called, whether it offers itself as a room's way in, and what it is finished in — is one of
// these; anything else arriving under a door's id is refused rather than stored.
const editableMetadataKeys = [
    ObjectMetadataKeyEnumMap.InstancedMeshComposition,
    ObjectMetadataKeyEnumMap.Label,
    ObjectMetadataKeyEnumMap.LabelColor,
    ObjectMetadataKeyEnumMap.DestinationRoomId,
    ObjectMetadataKeyEnumMap.DestinationDoorLabel,
    ObjectMetadataKeyEnumMap.DoorType,
];

// A door is a gateway from one room to another, hung on a wall like a picture. Laying one is an edit
// to the shape of the world rather than to a room's contents, so it is an admin's to make and only
// in a Hub — see RoomValidationUtil.canUserManageDoors.
const DoorObjectTypeConfig: ObjectTypeConfig =
{
    objectType: "Door",
    persistent: true,
    autoUnload: true,
    canUserAddObject: (user: User, room: Room, obj: AddObjectSignal) => {
        if (!RoomValidationUtil.canUserManageDoors(user, room))
            return false;

        // Block spoofing attempts
        if (obj.sourceUserID != user.id)
            return false;

        // Every door in the room draws its parts from one pool of mesh instances, so the room can
        // only hold as many as that pool was sized for.
        const typeIndex = ObjectTypeConfigMap.getIndexByType("Door");
        const doorCount = Object.values(room.objectById)
            .filter(obj => obj.objectTypeIndex === typeIndex).length;
        if (doorCount >= MAX_DOORS_PER_ROOM)
            return false;

        return true;
    },
    canUserRemoveObject: (user: User, room: Room, obj: AddObjectSignal) => {
        return RoomValidationUtil.canUserManageDoors(user, room);
    },
    canUserSetObjectTransform: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectTransformSignal) => {
        if (!RoomValidationUtil.canUserManageDoors(user, room))
            return false;

        // A door is slid along the wall by a gizmo, which is a placement rather than a motion.
        if (!signal.ignorePhysics)
            return false;

        return true;
    },
    canUserSetObjectMetadata: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectMetadataSignal) => {
        if (!RoomValidationUtil.canUserManageDoors(user, room))
            return false;

        // The values themselves are settled by ObjectMetadataEntryMap, which clamps a door type into
        // the enum and cuts a label to length, so what is left to ask here is only which keys a door
        // answers to at all.
        return editableMetadataKeys.includes(signal.metadataKey);
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
            // The door's name goes where a sign belongs: on the plate, which is the one region of
            // its face finished differently for the purpose. The rect comes from the plate's own
            // declaration rather than being written out again, so the two cannot drift apart, and
            // it is inset by the moulding running around the plate so the text never rides over the
            // carving. It stands a little in front of the plate's own relief.
            labelText: {
                localOffset: {
                    x: DoorCompositionConstants.label.offset.x,
                    y: DOOR_PANEL_ORIGIN_Y + DoorCompositionConstants.label.offset.y,
                    z: DoorCompositionConstants.label.relief + 0.005,
                },
                size: {
                    x: DoorCompositionConstants.label.size.x
                        - 2 * DoorCompositionConstants.label.mouldingThickness,
                    y: DoorCompositionConstants.label.size.y
                        - 2 * DoorCompositionConstants.label.mouldingThickness,
                },
                defaultFontColorHex: "#33302c", // a dark grey that reads as lettering without going to black
            },
            orbitOccluder: {}, // Part of the wall it sits in, as far as the orbit camera is concerned.
        },
    },
}

export default DoorObjectTypeConfig;
