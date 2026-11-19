/**
 * Restricted zones for tests, as the game holds them: volumes kept for a user (see RestrictedZoneUtil).
 */
import EncodableByteString from "../../../src/shared/networking/types/encodableByteString";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import VolumeObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/volumeObjectTypeConfig";
import Room from "../../../src/shared/room/types/room";
import { COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, VOXEL_CELL_SIZE,
    ZONE_USER_NAME_FOR_NOBODY } from "../../../src/shared/system/sharedConstants";
import { restrictedZonesChangedObservable } from "../../../src/shared/system/sharedObservables";
import RestrictedZoneUtil from "../../../src/shared/voxel/util/restrictedZoneUtil";

/** What a zone kept for nobody names in place of a user, which leaves it the superuser's alone. */
export const NO_ONE = ZONE_USER_NAME_FOR_NOBODY;

/** The blocks a zone covers, each range inclusive. Without layers, it runs from the room's floor to its ceiling. */
export interface ZoneBlocks
{
    rowMin: number;
    rowMax: number;
    colMin: number;
    colMax: number;
    collisionLayerMin?: number;
    collisionLayerMax?: number;
}

let numZonesMade = 0;

/** The transform of the volume covering those blocks. */
export function zoneTransform(blocks: ZoneBlocks): ObjectTransform
{
    const layerMin = blocks.collisionLayerMin ?? COLLISION_LAYER_MIN;
    const layerMax = blocks.collisionLayerMax ?? COLLISION_LAYER_MAX;
    return VolumeObjectTypeConfig.util.makeTransform(
        {x: blocks.colMin * VOXEL_CELL_SIZE, y: layerMin * COLLISION_LAYER_HEIGHT, z: blocks.rowMin * VOXEL_CELL_SIZE},
        {x: (blocks.colMax + 1) * VOXEL_CELL_SIZE, y: (layerMax + 1) * COLLISION_LAYER_HEIGHT,
            z: (blocks.rowMax + 1) * VOXEL_CELL_SIZE});
}

/** A volume over those blocks kept for a user, not yet in any room. */
export function makeZoneSignal(room: Room, blocks: ZoneBlocks, userName: string = NO_ONE,
    objectId: string = `zone-${++numZonesMade}`): AddObjectSignal
{
    return new AddObjectSignal(room.id, "", "", ObjectTypeConfigMap.getIndexByType("Volume"), objectId,
        zoneTransform(blocks), {[ObjectMetadataKeyEnumMap.ZoneUserName]: new EncodableByteString(userName)});
}

/** Lays a zone straight into a room's objects, asking nobody's permission, and says so as an edit would. */
export function addRestrictedZone(room: Room, blocks: ZoneBlocks, userName: string = NO_ONE,
    objectId?: string): AddObjectSignal
{
    const zone = makeZoneSignal(room, blocks, userName, objectId);
    room.objectGroup.addObject(zone);
    restrictedZonesChangedObservable.set(room.id);
    return zone;
}

/** Takes every zone out of a room, leaving its other volumes. */
export function clearRestrictedZones(room: Room): void
{
    for (const object of Object.values(room.objectById).filter(RestrictedZoneUtil.isZone))
        room.objectGroup.removeObject(object.objectId);
    restrictedZonesChangedObservable.set(room.id);
}
