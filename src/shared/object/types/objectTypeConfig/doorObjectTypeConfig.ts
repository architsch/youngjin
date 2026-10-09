import DoorCompositionConstants, { DOOR_FOOTPRINT_HEIGHT, DOOR_FOOTPRINT_WIDTH,
    DOOR_PANEL_ORIGIN_Y } from "../../../graphics/mesh/composition/types/compositionConstants/doorCompositionConstants";
import { InstancedMeshCompositionCodecTypeEnumMap } from "../../../graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import CompositionMetadataUtil from "../../../graphics/mesh/composition/util/compositionMetadataUtil";
import StringUtil from "../../../math/util/stringUtil";
import EncodableByteString from "../../../networking/types/encodableByteString";
import Room from "../../../room/types/room";
import RoomValidationUtil from "../../../room/util/roomValidationUtil";
import { ATTACHMENT_HITBOX_INSET, BACKWARD_DIR, HUB_ROOM_ID_KEYWORD, MAX_ROOM_X, MAX_ROOM_Z, UNIT_VEC3,
    WALL_DIRECTIONS } from "../../../system/sharedConstants";
import User from "../../../user/types/user";
import AddObjectSignal from "../addObjectSignal";
import { ObjectCategoryEnumMap } from "../objectCategory";
import ObjectTypeConfig from "./objectTypeConfig";
import ObjectScaleUtil from "../../util/objectScaleUtil";
import ObjectTypeConfigMap from "../../maps/objectTypeConfigMap";
import ObjectTransform from "../objectTransform";
import Vec3 from "../../../math/types/vec3";
import SetObjectMetadataSignal from "../setObjectMetadataSignal";
import SetObjectTransformSignal from "../setObjectTransformSignal";
import { DoorType, DoorTypeEnumMap } from "../doorType";
import { ObjectMetadataKeyEnumMap } from "../objectMetadataKey";

// Fixed id for a room's entrance door, so conversions add exactly one and its derived appearance is stable.
export const ENTRANCE_DOOR_OBJECT_ID = "entrance_door";

// Spawn and walk-out distances along the door's facing: spawn behind the door in the middle of the wall
// it needs (see its supportDepth), walk out as far in front of it (see SpawnHotspotUtil, PlayerController).
export const SPAWN_DIST_BEHIND_DOOR = 0.5;
export const ENTRANCE_DIST_IN_FRONT_OF_DOOR = 0.5;

const COMPOSITION_CODEC_VERSION = 0;

// Metadata keys the room's superuser may write to a door; anything else is refused.
const editableMetadataKeys = [
    ObjectMetadataKeyEnumMap.InstancedMeshComposition,
    ObjectMetadataKeyEnumMap.Label,
    ObjectMetadataKeyEnumMap.LabelColor,
    ObjectMetadataKeyEnumMap.LabelFont,
    ObjectMetadataKeyEnumMap.DestinationRoomId,
    ObjectMetadataKeyEnumMap.DestinationDoorLabel,
    ObjectMetadataKeyEnumMap.DoorType,
];

// Doors connect rooms; only the room's superuser lays them (see RoomValidationUtil.isRoomSuperuser).
const DoorObjectTypeConfig =
{
    objectType: "Door",
    persistent: true,
    autoUnload: true,
    category: ObjectCategoryEnumMap.Door,
    attachment: {
        allowedDirections: WALL_DIRECTIONS,
        // Arrivals stand inside the wall behind the door, which has to hide them (see SPAWN_DIST_BEHIND_DOOR).
        supportDepth: 2 * SPAWN_DIST_BEHIND_DOOR,
    },
    canUserAddObject: (user: User, room: Room, obj: AddObjectSignal) => {
        if (!RoomValidationUtil.isRoomSuperuser(user, room))
            return false;

        // Block spoofing attempts
        if (obj.sourceUserID != user.id)
            return false;

        return true;
    },
    canUserRemoveObject: (user: User, room: Room, obj: AddObjectSignal) => {
        return RoomValidationUtil.isRoomSuperuser(user, room);
    },
    canUserSetObjectTransform: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectTransformSignal) => {
        if (!RoomValidationUtil.isRoomSuperuser(user, room))
            return false;

        // A door is slid along the wall by a gizmo, which is a placement rather than a motion.
        if (!signal.ignorePhysics)
            return false;

        return true;
    },
    canUserSetObjectMetadata: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectMetadataSignal) => {
        if (!RoomValidationUtil.isRoomSuperuser(user, room))
            return false;

        // A look must be one of a door's own; other values are sanitized by ObjectMetadataEntryMap.
        if (signal.metadataKey == ObjectMetadataKeyEnumMap.InstancedMeshComposition)
        {
            return CompositionMetadataUtil.isIndexedLookOf("Door", COMPOSITION_CODEC_VERSION,
                signal.metadataValue);
        }
        return editableMetadataKeys.includes(signal.metadataKey);
    },
    components: {
        spawnedByAny: {
            collider: {
                // Claims its stretch of wall so nothing hangs over it. The footprint is a round number
                // of blocks' widths; the tested box is slightly inset (see PhysicsColliderStateUtil).
                baseHitboxSize: {
                    sizeX: DOOR_FOOTPRINT_WIDTH,
                    sizeY: DOOR_FOOTPRINT_HEIGHT,
                    sizeZ: 0.5 * ATTACHMENT_HITBOX_INSET
                },
                applyHardCollisionToOthers: false, // pass-through: the wall behind already blocks the player
                outgoingSoftCollisionForceMultiplier: 0,
                incomingSoftCollisionForceMultiplier: 0,
                maxClimbableHeight: 0,
            },
            playerProximityDetector: {
                maxDist: 3.5,
                maxLookAngle: 0.25*Math.PI,
                // Prompts only from in front of the face: excludes a just-arrived player standing behind
                // it and positions edge-on beside it.
                maxFaceAngle: Math.PI/4,
                checkLineOfSight: true, // A door across the room can stand behind anything built since.
            },
            speechBubble: {
                yOffset: 0.25,
                checkLineOfSight: false,
                prependUserNameToMessage: false,
            },
            instancedMeshGraphics: {},
            // One of its pre-encoded finishes (see pre_encoding_source.json).
            instancedMeshComposer: {
                codecType: InstancedMeshCompositionCodecTypeEnumMap.Indexed,
                codecVersion: COMPOSITION_CODEC_VERSION,
                generateDefaultParts: (obj: AddObjectSignal) => {
                    // Seeded from room and door id (not the viewer's id, which client-spawned objects
                    // carry; see ObjectFactory), so everyone sees the same door every session.
                    const hashCode = StringUtil.getHashCode(`${obj.roomID}/${obj.objectId}`);
                    return CompositionMetadataUtil.decodeSeededIndexed("Door", 0, hashCode,
                        COMPOSITION_CODEC_VERSION, ObjectScaleUtil.getObjectSize(obj.objectTypeIndex, obj.transform.scale));
                },
                // Straight on, as it stands in its wall.
                thumbnailView: {yawDeg: 0, pitchDeg: 0},
            },
            // The name goes on the plate: the rect comes from the plate declaration, inset by its
            // moulding, slightly in front of its relief.
            labelText: {
                localTransform: {
                    pos: {
                        x: DoorCompositionConstants.label.offset.x,
                        y: DOOR_PANEL_ORIGIN_Y + DoorCompositionConstants.label.offset.y,
                        z: DoorCompositionConstants.label.relief + 0.005,
                    },
                    dir: BACKWARD_DIR,
                    scale: {
                        x: DoorCompositionConstants.label.size.x
                            - 2 * DoorCompositionConstants.label.mouldingThickness,
                        y: DoorCompositionConstants.label.size.y
                            - 2 * DoorCompositionConstants.label.mouldingThickness,
                        z: 1,
                    },
                },
                defaultFontColorHex: "#33302c", // a dark grey that reads as lettering without going to black
            },
            orbitOccluder: {}, // Part of the wall it sits in, as far as the orbit camera is concerned.
        },
    },
    // Door semantics: entrance creation and metadata reading (its label is read through LabelTextUtil).
    util: {
        // A multiplayer room's entrance door on the boundary wall, facing in: entrancePos is the middle of its
        // foot, on the wall's room-facing surface. Points at the hub keyword (an unwired door is locked; the
        // balancer picks the hub at travel time). Used by both generation and older-room conversion so both
        // produce the same door.
        makeEntranceDoor: (roomID: string, entrancePos: Vec3): AddObjectSignal =>
        {
            const objectTypeIndex = ObjectTypeConfigMap.getIndexByType("Door");
            return new AddObjectSignal(roomID, "", "",
                objectTypeIndex, ENTRANCE_DOOR_OBJECT_ID,
                new ObjectTransform(
                    // Origin half a doorway above the floor (collider-centred).
                    {x: entrancePos.x, y: entrancePos.y + 0.5 * DOOR_FOOTPRINT_HEIGHT, z: entrancePos.z},
                    getBoundaryWallInwardDir(entrancePos),
                    {...UNIT_VEC3}),
                {
                    [ObjectMetadataKeyEnumMap.DoorType]:
                        new EncodableByteString(`${DoorTypeEnumMap.DefaultEntrance}`),
                    [ObjectMetadataKeyEnumMap.DestinationRoomId]:
                        new EncodableByteString(HUB_ROOM_ID_KEYWORD),
                });
        },
        getDestinationRoomId: (obj: AddObjectSignal): string =>
        {
            return obj.metadata[ObjectMetadataKeyEnumMap.DestinationRoomId]?.str ?? "";
        },
        getDestinationDoorLabel: (obj: AddObjectSignal): string =>
        {
            return obj.metadata[ObjectMetadataKeyEnumMap.DestinationDoorLabel]?.str ?? "";
        },
        // Unspecified means a custom (non-default) entrance.
        getDoorType: (obj: AddObjectSignal): DoorType =>
        {
            const metadata = obj.metadata[ObjectMetadataKeyEnumMap.DoorType];
            if (!metadata)
                return DoorTypeEnumMap.CustomEntrance;
            const doorType = parseInt(metadata.str);
            return isNaN(doorType) ? DoorTypeEnumMap.CustomEntrance : doorType;
        },
    },
} satisfies ObjectTypeConfig;

// Facing into the room, out of the boundary wall a spot is nearest.
function getBoundaryWallInwardDir(pos: Vec3): Vec3
{
    const distToWall = Math.min(pos.x, MAX_ROOM_X - pos.x, pos.z, MAX_ROOM_Z - pos.z);
    if (distToWall == MAX_ROOM_Z - pos.z)
        return {x: 0, y: 0, z: -1};
    if (distToWall == pos.z)
        return {x: 0, y: 0, z: 1};
    if (distToWall == MAX_ROOM_X - pos.x)
        return {x: -1, y: 0, z: 0};
    return {x: 1, y: 0, z: 0};
}

export default DoorObjectTypeConfig;
