import AABB3 from "../../math/types/aabb3";
import Geometry3DUtil from "../../math/util/geometry3DUtil";
import Vec3 from "../../math/types/vec3";
import ObjectTypeConfigMap from "../../object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../object/types/addObjectSignal";
// Type-only: ObjectUpdateUtil reaches this module, so a value import would be a cycle.
import type ObjectTransform from "../../object/types/objectTransform";
import VolumeObjectTypeConfig from "../../object/types/objectTypeConfig/volumeObjectTypeConfig";
import PhysicsColliderStateUtil from "../../physics/util/physicsColliderStateUtil";
import Room from "../../room/types/room";
import RoomVolume from "../../room/types/roomVolume";
import RoomValidationUtil from "../../room/util/roomValidationUtil";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, MAX_ROOM_Y,
    ZONE_USER_NAME_FOR_NOBODY } from "../../system/sharedConstants";
import { restrictedZonesChangedObservable } from "../../system/sharedObservables";
import User from "../../user/types/user";
import VoxelQueryUtil from "./voxelQueryUtil";

// Well inside a block, larger than coordinate rounding.
const EDGE_MARGIN = 0.01;

// Restricted zones (see @docs/gameplay/restricted_zone.md): the room's volumes that are kept for a user (see
// VolumeObjectTypeConfig). Inside one, only that user and the room's superuser may edit, or the superuser alone
// where it is kept for nobody. Applied on client and server through VoxelUpdateUtil and ObjectUpdateUtil.
const RestrictedZoneUtil =
{
    // Whether a zone over this block blocks this user.
    blocksVoxelBlockEdit(user: User, room: Room, row: number, col: number, collisionLayer: number): boolean
    {
        return getZonesBlocking(user, room).some(zone =>
            RestrictedZoneUtil.blocksHold(getBlocks(zone), row, col, collisionLayer));
    },

    // Whether a zone blocks painting this face. Tested by where the face lies, so the faces a zone ends at
    // stay paintable (see getTestBox).
    blocksVoxelQuadEdit(user: User, room: Room, quadIndex: number): boolean
    {
        const zones = getZonesBlocking(user, room);
        if (zones.length == 0)
            return false;

        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
        const voxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, row, col);
        if (!voxel)
            return false;

        // Visibility ignored; it doesn't affect zone membership.
        const dimensions = VoxelQueryUtil.getVoxelQuadTransformDimensions(room.voxelGrid.voxels, quadIndex, true);
        const point: Vec3 = {
            x: VoxelQueryUtil.getWorldXAtVoxelColCenter(col) + dimensions.offsetX,
            y: dimensions.offsetY,
            z: VoxelQueryUtil.getWorldZAtVoxelRowCenter(row) + dimensions.offsetZ,
        };
        return zones.some(zone => Geometry3DUtil.pointOverlapsAABB(point, getTestBox(zone)));
    },

    // Whether an object here would reach into a zone blocking this user. Only persistent objects are
    // checked, and the type check comes first (players pass through here constantly). A volume never is:
    // zones are made of them, and whose they are is their type's own rule.
    blocksObjectEdit(user: User, room: Room, objectTypeIndex: number,
        transform: ObjectTransform): boolean
    {
        const config = ObjectTypeConfigMap.getConfigByIndex(objectTypeIndex);
        if (!config.persistent || config == VolumeObjectTypeConfig)
            return false;

        const zones = getZonesBlocking(user, room);
        if (zones.length == 0)
            return false;

        const colliderState = PhysicsColliderStateUtil.getObjectColliderState(
            objectTypeIndex, transform);
        if (!colliderState)
            return false;
        return zones.some(zone => Geometry3DUtil.AABBsOverlap(colliderState.hitbox, getTestBox(zone)));
    },

    // Told of every object added, removed, moved or given another value (see ObjectUpdateUtil): a volume's
    // change may be a zone's, which whoever draws the zones follows.
    noteObjectChange(room: Room, obj: AddObjectSignal): void
    {
        if (isVolume(obj))
            restrictedZonesChangedObservable.set(room.id);
    },

    // Whether an object is a restricted zone: a volume kept for a user, or for nobody (see
    // ZONE_USER_NAME_FOR_NOBODY). One that says neither is none.
    isZone(obj: AddObjectSignal): boolean
    {
        return isVolume(obj) && VolumeObjectTypeConfig.util.getZoneUserName(obj).length > 0;
    },

    // The room's zones, whomever each is kept for.
    getZones(room: Room): AddObjectSignal[]
    {
        return Object.values(room.objectById).filter(RestrictedZoneUtil.isZone);
    },

    // The blocks each of the room's zones covers, for drawing them (see RestrictedZoneOutlineUtil).
    getBlocksOfZones(room: Room): RoomVolume[]
    {
        return RestrictedZoneUtil.getZones(room).map(getBlocks);
    },

    blocksHold(blocks: RoomVolume, row: number, col: number, collisionLayer: number): boolean
    {
        return row >= blocks.rowMin && row <= blocks.rowMax && col >= blocks.colMin && col <= blocks.colMax
            && collisionLayer >= blocks.collisionLayerMin && collisionLayer <= blocks.collisionLayerMax;
    },
};

function isVolume(obj: AddObjectSignal): boolean
{
    return ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex) == VolumeObjectTypeConfig;
}

// The room's zones that hold against this user: none for its superuser, and never the ones kept for them.
function getZonesBlocking(user: User, room: Room): AddObjectSignal[]
{
    // (Most rooms hold no volume at all, and edits come often.)
    if (room.objectGroup.getCategoryCount(VolumeObjectTypeConfig.category) == 0)
        return [];
    if (RoomValidationUtil.isRoomSuperuser(user, room))
        return [];
    return RestrictedZoneUtil.getZones(room).filter(zone => !isKeptFor(zone, user));
}

// Whether a zone lets this user in: the one it names, which is nobody where it names none (see
// ZONE_USER_NAME_FOR_NOBODY), whatever anyone is called.
function isKeptFor(zone: AddObjectSignal, user: User): boolean
{
    const zoneUserName = VolumeObjectTypeConfig.util.getZoneUserName(zone);
    return zoneUserName != ZONE_USER_NAME_FOR_NOBODY && zoneUserName == user.userName;
}

// The blocks a zone covers: its volume's, and with them the room's own floor or ceiling where it reaches the
// bottom or the top of the room, which are faces of the solid just past the layers (see
// VoxelQueryUtil.getVoxelBlockCollisionLayerFromQuadIndex).
function getBlocks(zone: AddObjectSignal): RoomVolume
{
    const blocks = VolumeObjectTypeConfig.util.getRoomVolume(zone.transform);
    if (blocks.collisionLayerMin <= COLLISION_LAYER_MIN)
        blocks.collisionLayerMin = COLLISION_LAYER_MIN - 1;
    if (blocks.collisionLayerMax >= COLLISION_LAYER_MAX)
        blocks.collisionLayerMax = COLLISION_LAYER_MAX + 1;
    return blocks;
}

// A zone's box for the overlap tests, which are strict (a point on a face is outside). It is drawn in from the
// zone's sides, so the faces it ends at stay paintable, and the objects on them editable (an attached collider
// is thinner than the inset; see PhysicsColliderStateUtil): but out past the room's floor or ceiling where the
// zone reaches one, whose tiles there are the zone's.
function getTestBox(zone: AddObjectSignal): AABB3
{
    const {min, max} = VolumeObjectTypeConfig.util.getBox(zone.transform);
    const minY = (min.y <= 0) ? -EDGE_MARGIN : min.y + EDGE_MARGIN;
    const maxY = (max.y >= MAX_ROOM_Y) ? MAX_ROOM_Y + EDGE_MARGIN : max.y - EDGE_MARGIN;
    return {
        center: {x: 0.5 * (min.x + max.x), y: 0.5 * (minY + maxY), z: 0.5 * (min.z + max.z)},
        halfSize: {
            x: 0.5 * (max.x - min.x) - EDGE_MARGIN,
            y: 0.5 * (maxY - minY),
            z: 0.5 * (max.z - min.z) - EDGE_MARGIN,
        },
    };
}

export default RestrictedZoneUtil;
