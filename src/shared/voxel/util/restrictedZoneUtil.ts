import Geometry3DUtil from "../../math/util/geometry3DUtil";
import Vec3 from "../../math/types/vec3";
import ObjectTypeConfigMap from "../../object/maps/objectTypeConfigMap";
import PhysicsColliderStateUtil from "../../physics/util/physicsColliderStateUtil";
import Room from "../../room/types/room";
import RoomValidationUtil from "../../room/util/roomValidationUtil";
import { MAX_RESTRICTED_ZONES, NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../../system/sharedConstants";
import { restrictedZonesChangedObservable } from "../../system/sharedObservables";
import User from "../../user/types/user";
import RestrictedZone from "../types/restrictedZone";
import VoxelQueryUtil from "./voxelQueryUtil";

// Which parts of a room are the superuser's alone, and what that keeps everybody else from doing to
// them. See @docs/gameplay/restricted_zone.md for what a zone is for.
//
// Every question here is asked of the client and of the server alike, through the same two update
// utilities every other edit goes through (VoxelUpdateUtil and ObjectUpdateUtil), so a client that
// has been talked into ignoring a zone is turned away by the server on the same grounds.
const RestrictedZoneUtil =
{
    // Whether the room holds a zone standing over this voxel, closing it to this user.
    //
    // Blocks are asked about by voxel rather than by volume because a zone reaches the whole height
    // of the room: every layer of a voxel inside one is inside it, so there is no height to test.
    blocksVoxelBlockEdit(user: User, room: Room, row: number, col: number): boolean
    {
        if (RoomValidationUtil.isRoomSuperuser(user, room))
            return false;
        return RestrictedZoneUtil.voxelIsInAZone(room, row, col);
    },

    // Whether a zone stands over this voxel at all, whoever is asking. This is what the room is drawn
    // by — the outlines laid over a zone's faces are shown to everybody in edit mode, the superuser
    // whose zones they are included, since he is the one placing them.
    voxelIsInAZone(room: Room, row: number, col: number): boolean
    {
        for (const zone of room.voxelGrid.restrictedZones)
        {
            if (row >= zone.rowMin && row <= zone.rowMax && col >= zone.colMin && col <= zone.colMax)
                return true;
        }
        return false;
    },

    // Whether the room holds a zone closing this one face to this user.
    //
    // A face is asked about by where it lies rather than by which voxel it belongs to, because the
    // faces along a zone's outermost edge are deliberately left out: they are the surface the room
    // is seen through from outside the zone, and painting them changes nothing about the wall's
    // shape. That exception is expressed once, as the margin RestrictedZone.getVolume draws its
    // sides in by, rather than written out a second time as a rule about edges.
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

        // Where the face sits in the world. Asked with the face's visibility ignored, because whether
        // a face happens to be drawn says nothing about whether the wall it belongs to is in a zone.
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

    // Whether the room holds a zone that an object standing here would reach into, closing it to
    // this user.
    //
    // Only objects the room keeps answer to a zone. Everything else that carries a collider —
    // a player above all — passes through here at the rate it moves, so the kind of object is
    // settled before any geometry is done.
    blocksObjectEdit(user: User, room: Room, objectTypeIndex: number,
        position: Vec3, direction: Vec3): boolean
    {
        if (!ObjectTypeConfigMap.getConfigByIndex(objectTypeIndex).persistent)
            return false;
        if (room.voxelGrid.restrictedZones.length == 0)
            return false;
        if (RoomValidationUtil.isRoomSuperuser(user, room))
            return false;

        const colliderState = PhysicsColliderStateUtil.getObjectColliderState(
            objectTypeIndex, position, direction);
        if (!colliderState)
            return false;

        for (const zone of room.voxelGrid.restrictedZones)
        {
            if (Geometry3DUtil.AABBsOverlap(colliderState.hitbox, zone.getVolume()))
                return true;
        }
        return false;
    },

    // Whether this user may replace the room's zones with the ones given.
    //
    // The zones arrive as a whole list rather than one at a time, so this is the one place a zone
    // is checked at all: drawing one, moving one, resizing one and taking one away are all the same
    // request, and all of them are refused here on the same grounds.
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
    // Replaces the room's zones. "validate" says whether the change has to be checked against what
    // the user is allowed to do, and so also says who asked for it: a change the user made himself is
    // checked, while one arriving from the server has been checked there already.
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

        // Marked dirty and left at that. A zone is a handful of bytes and is dragged about while it
        // is being placed, so writing the room out on every change would spend a whole room's worth
        // of storage traffic on it; the periodic save that carries every other edit carries this one
        // too.
        room.dirty = true;

        restrictedZonesChangedObservable.set(room.id);
        return true;
    },
};

export default RestrictedZoneUtil;
