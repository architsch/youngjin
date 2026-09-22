import Geometry3DUtil from "../../math/util/geometry3DUtil";
import Vec3 from "../../math/types/vec3";
import ObjectTypeConfigMap from "../../object/maps/objectTypeConfigMap";
// Type-only: ObjectUpdateUtil reaches this module, so a value import would be a cycle.
import type ObjectTransform from "../../object/types/objectTransform";
import PhysicsColliderStateUtil from "../../physics/util/physicsColliderStateUtil";
import Room from "../../room/types/room";
import RoomValidationUtil from "../../room/util/roomValidationUtil";
import { MAX_RESTRICTED_ZONES, NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../../system/sharedConstants";
import { restrictedZonesChangedObservable } from "../../system/sharedObservables";
import User from "../../user/types/user";
import RestrictedZone from "../types/restrictedZone";
import VoxelQueryUtil from "./voxelQueryUtil";

// Restricted zone rules (see @docs/gameplay/restricted_zone.md), applied on client and server through
// VoxelUpdateUtil and ObjectUpdateUtil.
const RestrictedZoneUtil =
{
    // Whether a zone over this voxel blocks this user (zones span the full height, so no layer check).
    blocksVoxelBlockEdit(user: User, room: Room, row: number, col: number): boolean
    {
        if (RoomValidationUtil.isRoomSuperuser(user, room))
            return false;
        return RestrictedZoneUtil.voxelIsInAZone(room, row, col);
    },

    // Whether any zone covers this voxel, for drawing outlines (shown to everyone in edit mode).
    voxelIsInAZone(room: Room, row: number, col: number): boolean
    {
        for (const zone of room.voxelGrid.restrictedZones)
        {
            if (row >= zone.rowMin && row <= zone.rowMax && col >= zone.colMin && col <= zone.colMax)
                return true;
        }
        return false;
    },

    // Whether a zone blocks painting this face. Tested by face position, so outer boundary faces stay
    // paintable via RestrictedZone.getVolume's inset.
    blocksVoxelQuadEdit(user: User, room: Room, quadIndex: number): boolean
    {
        if (RoomValidationUtil.isRoomSuperuser(user, room))
            return false;
        if (room.voxelGrid.restrictedZones.length == 0)
            return false;

        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
        const voxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, row, col);
        if (!voxel)
            return false;

        // Visibility ignored; it doesn't affect zone membership.
        const dimensions = VoxelQueryUtil.getVoxelQuadTransformDimensions(voxel, quadIndex, true);
        const point: Vec3 = {
            x: col + 0.5 + dimensions.offsetX,
            y: dimensions.offsetY,
            z: row + 0.5 + dimensions.offsetZ,
        };

        for (const zone of room.voxelGrid.restrictedZones)
        {
            if (Geometry3DUtil.pointOverlapsAABB(point, zone.getVolume()))
                return true;
        }
        return false;
    },

    // Whether an object here would reach into a zone blocking this user. Only persistent objects are
    // checked, and the type check comes first (players pass through here constantly).
    blocksObjectEdit(user: User, room: Room, objectTypeIndex: number,
        transform: ObjectTransform): boolean
    {
        if (!ObjectTypeConfigMap.getConfigByIndex(objectTypeIndex).persistent)
            return false;
        if (room.voxelGrid.restrictedZones.length == 0)
            return false;
        if (RoomValidationUtil.isRoomSuperuser(user, room))
            return false;

        const colliderState = PhysicsColliderStateUtil.getObjectColliderState(
            objectTypeIndex, transform);
        if (!colliderState)
            return false;

        for (const zone of room.voxelGrid.restrictedZones)
        {
            if (Geometry3DUtil.AABBsOverlap(colliderState.hitbox, zone.getVolume()))
                return true;
        }
        return false;
    },

    // Whether this user may replace the zone list (the only place zones are validated).
    canSetRestrictedZones(user: User, room: Room, restrictedZones: RestrictedZone[]): boolean
    {
        if (!RoomValidationUtil.isRoomSuperuser(user, room))
            return false;
        if (restrictedZones.length > MAX_RESTRICTED_ZONES)
            return false;

        for (const zone of restrictedZones)
        {
            if (!Number.isInteger(zone.rowMin) || !Number.isInteger(zone.rowMax) ||
                !Number.isInteger(zone.colMin) || !Number.isInteger(zone.colMax))
                return false;
            if (zone.rowMin < 0 || zone.rowMax >= NUM_VOXEL_ROWS ||
                zone.colMin < 0 || zone.colMax >= NUM_VOXEL_COLS)
                return false;
            if (zone.rowMin > zone.rowMax || zone.colMin > zone.colMax)
                return false;
        }
        return true;
    },
    // validate: true for the user's own changes; false for server-relayed ones.
    setRestrictedZones(user: User, room: Room, restrictedZones: RestrictedZone[],
        validate: boolean = true): boolean
    {
        if (validate && !RestrictedZoneUtil.canSetRestrictedZones(user, room, restrictedZones))
        {
            console.error(`RestrictedZoneUtil::setRestrictedZones :: Failed ` +
                `(roomID=${room.id}, numZones=${restrictedZones.length})`);
            return false;
        }
        room.voxelGrid.restrictedZones = restrictedZones;

        // Dirty only; the periodic save persists it (zones change rapidly while dragged).
        room.dirty = true;

        restrictedZonesChangedObservable.set(room.id);
        return true;
    },
};

export default RestrictedZoneUtil;
