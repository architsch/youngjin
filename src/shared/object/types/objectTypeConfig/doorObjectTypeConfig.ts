import { DoorCompositionCodec } from "../../../graphics/mesh/composition/types/compositionCodec/doorCompositionCodec";
import DoorCompositionConstants, { DOOR_FOOTPRINT_HEIGHT, DOOR_FOOTPRINT_WIDTH,
    DOOR_PANEL_ORIGIN_Y } from "../../../graphics/mesh/composition/types/compositionConstants/doorCompositionConstants";
import { InstancedMeshCompositionCodecTypeEnumMap } from "../../../graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import ColorUtil from "../../../math/util/colorUtil";
import StringUtil from "../../../math/util/stringUtil";
import EncodableByteString from "../../../networking/types/encodableByteString";
import Room from "../../../room/types/room";
import RoomValidationUtil from "../../../room/util/roomValidationUtil";
import { HUB_ROOM_ID_KEYWORD, LABEL_COLOR_PALETTE_NAME, WALL_ATTACHMENT_HITBOX_INSET } from "../../../system/sharedConstants";
import User from "../../../user/types/user";
import AddObjectSignal from "../addObjectSignal";
import ObjectTypeConfig from "./objectTypeConfig";
import ObjectTypeConfigMap from "../../maps/objectTypeConfigMap";
import WallAttachedObjectUtil from "../../util/wallAttachedObjectUtil";
import ObjectTransform from "../objectTransform";
import SetObjectMetadataSignal from "../setObjectMetadataSignal";
import SetObjectTransformSignal from "../setObjectTransformSignal";
import { DoorType, DoorTypeEnumMap } from "../doorType";
import { ObjectMetadataKeyEnumMap } from "../objectMetadataKey";

// Fixed id for a room's entrance door, so conversions add exactly one and its derived appearance is stable.
export const ENTRANCE_DOOR_OBJECT_ID = "entrance_door";

// Sizes the shared mesh instance pools (see InstancedMeshCapacityBuilder).
const MAX_DOORS_PER_ROOM = 16;

// Spawn and walk-out distances along the door's facing. The door sits on the wall/room boundary, so
// half a voxel either way is a cell centre: spawn behind the door in the wall cell, walk out to the
// floor cell (see SpawnHotspotUtil, PlayerController).
export const SPAWN_DIST_BEHIND_DOOR = 0.5;
export const ENTRANCE_DIST_IN_FRONT_OF_DOOR = 0.5;

// Metadata keys an admin may write to a door; anything else is refused.
const editableMetadataKeys = [
    ObjectMetadataKeyEnumMap.InstancedMeshComposition,
    ObjectMetadataKeyEnumMap.Label,
    ObjectMetadataKeyEnumMap.LabelColor,
    ObjectMetadataKeyEnumMap.DestinationRoomId,
    ObjectMetadataKeyEnumMap.DestinationDoorLabel,
    ObjectMetadataKeyEnumMap.DoorType,
];

// Doors connect rooms; laying one is admin-only and Hub-only (see RoomValidationUtil.canUserManageDoors).
const DoorObjectTypeConfig =
{
    objectType: "Door",
    persistent: true,
    autoUnload: true,
    maxCountPerRoom: MAX_DOORS_PER_ROOM,
    canUserAddObject: (user: User, room: Room, obj: AddObjectSignal) => {
        if (!RoomValidationUtil.canUserManageDoors(user, room))
            return false;

        // Block spoofing attempts
        if (obj.sourceUserID != user.id)
            return false;

        // Looked up per call (not at module scope) because of the config/map import cycle.
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

        // Values are sanitized by ObjectMetadataEntryMap; only the key is checked here.
        return editableMetadataKeys.includes(signal.metadataKey);
    },
    components: {
        spawnedByAny: {
            collider: {
                // Claims its stretch of wall so nothing hangs over it. The footprint is a round number
                // of half-voxels; the tested box is slightly inset (see PhysicsColliderStateUtil).
                colliderType: "wallAttachment",
                hitboxSize: {
                    sizeX: DOOR_FOOTPRINT_WIDTH,
                    sizeY: DOOR_FOOTPRINT_HEIGHT,
                    sizeZ: 0.5 * WALL_ATTACHMENT_HITBOX_INSET
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
            instancedMeshComposer: {
                codecType: InstancedMeshCompositionCodecTypeEnumMap.Door,
                codecVersion: 0,
                generateDefaultParts: (obj: AddObjectSignal) => {
                    // Seeded from room and door id (not the viewer's id, which client-spawned objects
                    // carry; see ObjectFactory), so everyone sees the same door every session.
                    const hashCode = StringUtil.getHashCode(`${obj.roomID}/${obj.objectId}`);
                    return DoorCompositionCodec.getRandomComposition(hashCode);
                },
            },
            // The name goes on the plate: the rect comes from the plate declaration, inset by its
            // moulding, slightly in front of its relief.
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
    // Door semantics: entrance creation and metadata reading.
    util: {
        // A multiplayer room's entrance door on the boundary wall, facing in. Points at the hub keyword
        // (an unwired door is locked; the balancer picks the hub at travel time). Used by both
        // generation and older-room conversion so both produce the same door.
        makeEntranceDoor: (roomID: string, entranceVoxelCol: number, entranceVoxelRow: number,
            entranceVoxelCollisionLayer: number): AddObjectSignal =>
        {
            const objectTypeIndex = ObjectTypeConfigMap.getIndexByType("Door");
            return new AddObjectSignal(roomID, "", "",
                objectTypeIndex, ENTRANCE_DOOR_OBJECT_ID,
                new ObjectTransform(
                    WallAttachedObjectUtil.getBoundaryWallAttachmentPos(objectTypeIndex,
                        entranceVoxelCol, entranceVoxelRow, entranceVoxelCollisionLayer),
                    WallAttachedObjectUtil.getBoundaryWallInwardDir(entranceVoxelCol, entranceVoxelRow)),
                {
                    [ObjectMetadataKeyEnumMap.DoorType]:
                        new EncodableByteString(`${DoorTypeEnumMap.DefaultEntrance}`),
                    [ObjectMetadataKeyEnumMap.DestinationRoomId]:
                        new EncodableByteString(HUB_ROOM_ID_KEYWORD),
                });
        },
        getLabel: (obj: AddObjectSignal): string =>
        {
            return obj.metadata[ObjectMetadataKeyEnumMap.Label]?.str ?? "";
        },
        // The label's palette index, defaulting to the nearest match for the type's default color (so
        // the picker opens on the color actually shown).
        getLabelColorIndex: (obj: AddObjectSignal): number =>
        {
            const stored = obj.metadata[ObjectMetadataKeyEnumMap.LabelColor]?.str;
            if (stored != undefined && stored.length > 0)
            {
                const index = parseInt(stored);
                if (!isNaN(index))
                    return index;
            }
            const configuredHex = ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex)
                .components.spawnedByAny?.labelText?.defaultFontColorHex;
            return ColorUtil.rgbToPaletteIndex(LABEL_COLOR_PALETTE_NAME,
                ColorUtil.hexToRGB(configuredHex ?? "#000000"));
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

export default DoorObjectTypeConfig;
