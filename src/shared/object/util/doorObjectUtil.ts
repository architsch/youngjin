import Vec3 from "../../math/types/vec3";
import { COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MIN, DOOR_FOOTPRINT_HEIGHT,
    LABEL_COLOR_PALETTE_NAME, NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../../system/sharedConstants";
import ColorUtil from "../../math/util/colorUtil";
import EncodableByteString from "../../networking/types/encodableByteString";
import ObjectTypeConfigMap from "../maps/objectTypeConfigMap";
import AddObjectSignal from "../types/addObjectSignal";
import { DoorType, DoorTypeEnumMap } from "../types/doorType";
import { ObjectMetadataKeyEnumMap } from "../types/objectMetadataKey";
import ObjectTransform from "../types/objectTransform";

// The id every room's own way in is filed under. Fixed rather than drawn, so that a room converted
// from an older format gains exactly one of these however many times it is read, and so that the
// appearance derived from a door's id (see DoorObjectTypeConfig) is the same door every session.
export const ENTRANCE_DOOR_OBJECT_ID = "entrance_door";

// Everything about a door that is a question of what it means rather than of how it is drawn: where
// a room's own way in stands, and how to read the metadata a door carries.
//
// The type index is looked up on each call rather than captured at module scope: this file sits
// inside an import cycle, and a lookup made at load time would depend on which module happened to be
// evaluated first.
const DoorObjectUtil =
{
    // The door a multiplayer room is generated with — its way in, standing in the boundary wall at
    // the room's entrance cell and facing into the room.
    //
    // Both room generation and the conversion that carries older rooms across call this, so that a
    // room built today and a room migrated yesterday come out holding the same door.
    makeEntranceDoor: (roomID: string, entranceVoxelCol: number, entranceVoxelRow: number,
        entranceVoxelCollisionLayer: number): AddObjectSignal =>
    {
        return new AddObjectSignal(roomID, "", "",
            ObjectTypeConfigMap.getIndexByType("Door"), ENTRANCE_DOOR_OBJECT_ID,
            new ObjectTransform(
                getWallAttachmentPos(entranceVoxelCol, entranceVoxelRow, entranceVoxelCollisionLayer),
                getInwardFacingDir(entranceVoxelCol, entranceVoxelRow)),
            {
                [ObjectMetadataKeyEnumMap.DoorType]:
                    new EncodableByteString(`${DoorTypeEnumMap.DefaultEntrance}`),
            });
    },
    getLabel: (obj: AddObjectSignal): string =>
    {
        return obj.metadata[ObjectMetadataKeyEnumMap.Label]?.str ?? "";
    },
    // Which position in the lettering palette the object's name is written in. An object that has
    // never been told falls back on the color its type was given, matched to the nearest position the
    // palette holds — so the picker opens on the color the label is actually wearing rather than on
    // an arbitrary one, and picking that same swatch back changes nothing.
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
    // A door with nothing said about it is a custom entrance: a door somebody put up is one of the
    // room's ways in only once it says so.
    getDoorType: (obj: AddObjectSignal): DoorType =>
    {
        const metadata = obj.metadata[ObjectMetadataKeyEnumMap.DoorType];
        if (!metadata)
            return DoorTypeEnumMap.CustomEntrance;
        const doorType = parseInt(metadata.str);
        return isNaN(doorType) ? DoorTypeEnumMap.CustomEntrance : doorType;
    },
}

// Where a door hung on the boundary wall of the given cell stands. A wall attachment's collider is
// centred on its position while the door itself stands on the floor, so its origin sits half a
// footprint above the storey it is mounted on; across the wall it is centred on the cell, and along
// the wall's normal it sits on the face the room looks at.
function getWallAttachmentPos(col: number, row: number, collisionLayer: number): Vec3
{
    const floorY = (collisionLayer - COLLISION_LAYER_MIN) * COLLISION_LAYER_HEIGHT;
    const y = floorY + 0.5 * DOOR_FOOTPRINT_HEIGHT;

    if (row >= NUM_VOXEL_ROWS - 1)
        return {x: col + 0.5, y, z: row};
    if (row <= 0)
        return {x: col + 0.5, y, z: row + 1};
    if (col >= NUM_VOXEL_COLS - 1)
        return {x: col, y, z: row + 0.5};
    return {x: col + 1, y, z: row + 0.5};
}

// Which way a door in that cell faces: out of the boundary wall it is hung on, into the room.
function getInwardFacingDir(col: number, row: number): Vec3
{
    if (row >= NUM_VOXEL_ROWS - 1)
        return {x: 0, y: 0, z: -1};
    if (row <= 0)
        return {x: 0, y: 0, z: 1};
    if (col >= NUM_VOXEL_COLS - 1)
        return {x: -1, y: 0, z: 0};
    return {x: 1, y: 0, z: 0};
}

export default DoorObjectUtil;
