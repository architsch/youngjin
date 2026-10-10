import App from "../../app";
import RoomEditUtil from "../../system/util/roomEditUtil";
import { ZoneHandle } from "../types/zoneHandle";
import NumUtil from "../../../shared/math/util/numUtil";
import EncodableByteString from "../../../shared/networking/types/encodableByteString";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import { ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import VolumeObjectTypeConfig from "../../../shared/object/types/objectTypeConfig/volumeObjectTypeConfig";
import RemoveObjectSignal from "../../../shared/object/types/removeObjectSignal";
import SetObjectTransformSignal from "../../../shared/object/types/setObjectTransformSignal";
import ObjectIdUtil from "../../../shared/object/util/objectIdUtil";
import ObjectUpdateUtil from "../../../shared/object/util/objectUpdateUtil";
import Room from "../../../shared/room/types/room";
import RoomVolume from "../../../shared/room/types/roomVolume";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NUM_VOXEL_COLS, NUM_VOXEL_ROWS,
    ZONE_USER_NAME_FOR_NOBODY } from "../../../shared/system/sharedConstants";
import RestrictedZoneUtil from "../../../shared/voxel/util/restrictedZoneUtil";

// New zone size in voxels: grabbable on a phone, obviously resizable.
const NEW_ZONE_SIZE = 12;

const volumeTypeIndex = ObjectTypeConfigMap.getIndexByType(VolumeObjectTypeConfig.objectType);

// The edits of the room settings' plan of restricted zones (see RestrictedZonesPanel,
// @docs/gameplay/restricted_zone.md). A zone is a volume (see RestrictedZoneUtil), so each is an object's edit,
// made as any of the user's own is but kept out of the history (see RoomEditUtil.make), as the room's other
// settings are. The plan looks down on the room: it sets a zone's rows and columns, and leaves it the layers and
// the user it has.
const RestrictedZonePlanUtil =
{
    // Whether the room takes another zone: it holds only so many volumes.
    canAddZone: (room: Room): boolean =>
    {
        return ObjectUpdateUtil.canAddObject(App.getUser(), room, makeNewZone(room));
    },

    // Adds a zone at the room's centre (the plan scrolls to it), from the floor to the ceiling and kept for nobody
    // (see ZONE_USER_NAME_FOR_NOBODY). Resolves to its object's id, or null if the room refused it.
    addZone: async (room: Room): Promise<string | null> =>
    {
        const zone = makeNewZone(room);
        return await RoomEditUtil.make(room, zone) ? zone.objectId : null;
    },

    removeZone: async (room: Room, objectId: string): Promise<boolean> =>
    {
        return isZone(room, objectId) && RoomEditUtil.make(room, new RemoveObjectSignal(room.id, objectId));
    },

    // Lays a zone over other blocks. Resolves to whether it lies there now.
    setZoneBlocks: async (room: Room, objectId: string, blocks: RoomVolume): Promise<boolean> =>
    {
        if (!isZone(room, objectId))
            return false;
        // (A drag that ends where it began is no edit.)
        if (blocksMatch(VolumeObjectTypeConfig.util.getRoomVolume(room.objectById[objectId].transform), blocks))
            return true;
        return RoomEditUtil.make(room, new SetObjectTransformSignal(room.id, objectId,
            VolumeObjectTypeConfig.util.makeTransformOfRoomVolume(blocks), true));
    },

    // A zone's blocks after a drag of whole voxels from where it began, so edges always snap: of its body, which
    // moves it, or of a handle, which moves the edges it is on.
    applyDrag: (blocks: RoomVolume, handle: ZoneHandle | "body", rowDelta: number, colDelta: number): RoomVolume =>
    {
        let {rowMin, rowMax, colMin, colMax} = blocks;
        if (handle == "body")
        {
            // Clamp the shift (not individual edges), so moving never resizes.
            const rowShift = NumUtil.clampInRange(rowDelta, -rowMin, NUM_VOXEL_ROWS - 1 - rowMax);
            const colShift = NumUtil.clampInRange(colDelta, -colMin, NUM_VOXEL_COLS - 1 - colMax);
            rowMin += rowShift;
            rowMax += rowShift;
            colMin += colShift;
            colMax += colShift;
        }
        else
        {
            // Edges stop at the opposite edge: minimum one voxel, never inverted.
            if (handle == "nw" || handle == "n" || handle == "ne")
                rowMin = NumUtil.clampInRange(rowMin + rowDelta, 0, rowMax);
            if (handle == "sw" || handle == "s" || handle == "se")
                rowMax = NumUtil.clampInRange(rowMax + rowDelta, rowMin, NUM_VOXEL_ROWS - 1);
            if (handle == "nw" || handle == "w" || handle == "sw")
                colMin = NumUtil.clampInRange(colMin + colDelta, 0, colMax);
            if (handle == "ne" || handle == "e" || handle == "se")
                colMax = NumUtil.clampInRange(colMax + colDelta, colMin, NUM_VOXEL_COLS - 1);
        }
        return new RoomVolume(rowMin, rowMax, colMin, colMax, blocks.collisionLayerMin, blocks.collisionLayerMax);
    },
}

// A new zone, as the signal that adds its volume.
function makeNewZone(room: Room): AddObjectSignal
{
    const user = App.getUser();
    const rowMin = Math.floor((NUM_VOXEL_ROWS - NEW_ZONE_SIZE) / 2);
    const colMin = Math.floor((NUM_VOXEL_COLS - NEW_ZONE_SIZE) / 2);
    const blocks = new RoomVolume(rowMin, rowMin + NEW_ZONE_SIZE - 1, colMin, colMin + NEW_ZONE_SIZE - 1,
        COLLISION_LAYER_MIN, COLLISION_LAYER_MAX);
    return new AddObjectSignal(room.id, user.id, user.userName, volumeTypeIndex, ObjectIdUtil.generateRandomObjectId(),
        VolumeObjectTypeConfig.util.makeTransformOfRoomVolume(blocks),
        {[ObjectMetadataKeyEnumMap.ZoneUserName]: new EncodableByteString(ZONE_USER_NAME_FOR_NOBODY)});
}

function isZone(room: Room, objectId: string): boolean
{
    const obj = room.objectById[objectId];
    return obj != undefined && RestrictedZoneUtil.isZone(obj);
}

function blocksMatch(a: RoomVolume, b: RoomVolume): boolean
{
    return a.rowMin == b.rowMin && a.rowMax == b.rowMax && a.colMin == b.colMin && a.colMax == b.colMax
        && a.collisionLayerMin == b.collisionLayerMin && a.collisionLayerMax == b.collisionLayerMax;
}

export default RestrictedZonePlanUtil;
