import Vec3 from "../../math/types/vec3";
import DirUtil from "../../math/util/dirUtil";
import Vector3DUtil from "../../math/util/vector3DUtil";
import PhysicsColliderStateUtil from "../../physics/util/physicsColliderStateUtil";
import PhysicsObjectUtil from "../../physics/util/physicsObjectUtil";
import Room from "../../room/types/room";
import { COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, MAX_ROOM_Y, NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../../system/sharedConstants";
import VoxelQueryUtil from "../../voxel/util/voxelQueryUtil";
import AddObjectSignal from "../types/addObjectSignal";
import ObjectTransform from "../types/objectTransform";
import ObjectTypeConfigMap from "../maps/objectTypeConfigMap";
import ObjectScaleUtil from "./objectScaleUtil";

const WallAttachedObjectUtil =
{
    canPlaceObject: (room: Room, objectId: string, objectTypeIndex: number,
        transform: ObjectTransform): boolean =>
    {
        const tr = getQuantizedTransform(objectTypeIndex, transform);
        const pos = tr.pos;
        const dir = tr.dir;

        if (pos.x <= 0 || pos.x >= NUM_VOXEL_COLS ||
            pos.y <= 0 || pos.y >= MAX_ROOM_Y ||
            pos.z <= 0 || pos.z >= NUM_VOXEL_ROWS)
        {
            return false;
        }

        const newColliderState = PhysicsColliderStateUtil.getObjectColliderState(objectTypeIndex, tr);
        if (!newColliderState)
            throw new Error(`new ColliderState not found (objectTypeIndex = ${objectTypeIndex})`);

        const halfHorizontal = getQuantizedColliderHorizontalHalfSize(objectTypeIndex, tr.scale);
        const halfVertical = getColliderVerticalHalfSize(objectTypeIndex, tr.scale);

        // (1) The back must be fully backed by voxel blocks. (2) The front must be at least partly open.
        // Checked over the object's Y range in collision layers.

        const objBottomY = newColliderState.hitbox.center.y - halfVertical;
        const objTopY = newColliderState.hitbox.center.y + halfVertical;
        let frontExposureFound = false;

        // Determine which direction the object faces for back/front scanning
        const absX = Math.abs(dir.x);
        const absZ = Math.abs(dir.z);
        const primaryAxis = absZ >= absX ? "z" : "x";

        // See @docs/geometry/wall_attached_object.md (placement validity).

        if (primaryAxis == "z") // object is a horizontal line on the XZ plane (X = horizontal, Z = vertical)
        {
            const backRow = Math.floor(pos.z + 0.01 * (dir.z > 0 ? -1 : +1));
            const frontRow = Math.floor(pos.z + 0.01 * (dir.z > 0 ? +1 : -1));
            const leftCol = Math.floor(pos.x - halfHorizontal + 0.01);
            const rightCol = Math.floor(pos.x + halfHorizontal - 0.01);
            for (let col = leftCol; col <= rightCol; ++col)
            {
                const backVoxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, backRow, col);
                const frontVoxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, frontRow, col);
                if (!backVoxel || !voxelCoversYRange(backVoxel.collisionLayerMask, objBottomY, objTopY))
                    return false;
                if (!frontVoxel || !voxelCoversYRange(frontVoxel.collisionLayerMask, objBottomY, objTopY))
                    frontExposureFound = true;
            }
        }
        else // object is a vertical line on the XZ plane (X = horizontal, Z = vertical)
        {
            const backCol = Math.floor(pos.x + 0.01 * (dir.x > 0 ? -1 : +1));
            const frontCol = Math.floor(pos.x + 0.01 * (dir.x > 0 ? +1 : -1));
            const leftRow = Math.floor(pos.z - halfHorizontal + 0.01);
            const rightRow = Math.floor(pos.z + halfHorizontal - 0.01);
            for (let row = leftRow; row <= rightRow; ++row)
            {
                const backVoxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, row, backCol);
                const frontVoxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, row, frontCol);
                if (!backVoxel || !voxelCoversYRange(backVoxel.collisionLayerMask, objBottomY, objTopY))
                    return false;
                if (!frontVoxel || !voxelCoversYRange(frontVoxel.collisionLayerMask, objBottomY, objTopY))
                    frontExposureFound = true;
            }
        }
        if (!frontExposureFound)
            return false;

        // The new object must not collide with any of the existing wall-attached objects.

        const collidingObjects = PhysicsObjectUtil.getObjectsCollidingWith3DVolume(room.id, newColliderState);
        for (const collidingObject of Object.values(collidingObjects))
        {
            if (collidingObject.objectId != objectId && collidingObject.colliderState.colliderConfig.colliderType == "wallAttachment")
                return false;
        }
        return true;
    },
    // Attachments whose back rests on this block (they must be refused or removed along with it).
    getObjectIdsAttachedToVoxelBlock: (room: Room, quadIndex: number): string[] =>
    {
        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);
        const voxelPos: Vec3 = {x: col + 0.5, y: 0.25 + collisionLayer*0.5, z: row + 0.5};

        const objectIds: string[] = [];
        const voxelBlockColliderState = PhysicsColliderStateUtil.getVoxelBlockColliderState(row, col, collisionLayer);
        const collidingObjects = PhysicsObjectUtil.getObjectsCollidingWith3DVolume(room.id, voxelBlockColliderState);
        for (const collidingObject of Object.values(collidingObjects))
        {
            if (collidingObject.colliderState.colliderConfig.colliderType != "wallAttachment")
                continue;
            const object = room.objectById[collidingObject.objectId];
            if (!object)
            {
                console.error(`Colliding object not found (objectId = ${collidingObject.objectId})`);
                continue;
            }
            // Attachments on this block face away from it; ones facing it hang on the far side.
            const fromVoxelToObject = Vector3DUtil.subtract(object.transform.pos, voxelPos);
            if (Vector3DUtil.dot(object.transform.dir, fromVoxelToObject) > 0)
                objectIds.push(collidingObject.objectId);
        }
        return objectIds;
    },
    // Boundary-wall attachment position: origin half a footprint above the storey floor (collider-centred),
    // centred on the cell, on the room-facing wall surface.
    getBoundaryWallAttachmentPos: (objectTypeIndex: number, col: number, row: number,
        collisionLayer: number): Vec3 =>
    {
        const floorY = (collisionLayer - COLLISION_LAYER_MIN) * COLLISION_LAYER_HEIGHT;
        const y = floorY + getBaseColliderVerticalHalfSize(objectTypeIndex);

        if (row >= NUM_VOXEL_ROWS - 1)
            return {x: col + 0.5, y, z: row};
        if (row <= 0)
            return {x: col + 0.5, y, z: row + 1};
        if (col >= NUM_VOXEL_COLS - 1)
            return {x: col, y, z: row + 0.5};
        return {x: col + 1, y, z: row + 0.5};
    },
    // Facing out of the boundary wall, into the room.
    getBoundaryWallInwardDir: (col: number, row: number): Vec3 =>
    {
        if (row >= NUM_VOXEL_ROWS - 1)
            return {x: 0, y: 0, z: -1};
        if (row <= 0)
            return {x: 0, y: 0, z: 1};
        if (col >= NUM_VOXEL_COLS - 1)
            return {x: -1, y: 0, z: 0};
        return {x: 1, y: 0, z: 0};
    },
    // The way along the wall a positive dx moves toward (see getMoveResult), for anything that lays out
    // or drags an attachment on its own axes. The facing is rounded onto its axis first: a stored one
    // decodes a little off it, enough to read an x-facing wall as a z-facing one.
    getRightDir: (dir: Vec3): Vec3 =>
    {
        const facing = {x: Math.round(dir.x), y: 0, z: Math.round(dir.z)};
        return DirUtil.dir4ToVec3(DirUtil.rotateCCW(DirUtil.vec3ToDir4(facing)));
    },
    // Where a resize puts the object when one corner is dragged to cornerPos: the nearest size its type
    // allows, with the opposite corner of anchor (the object as the drag began) held still. Positions sit
    // on a half-voxel grid, so an odd number of half-steps can hold that corner only to within a quarter
    // voxel; it gives way toward the dragged side, or behind when only that fits. Undefined if that size
    // fits neither way. cornerSignX/Y: the dragged corner, +1 toward getRightDir / up, -1 the other way.
    getResizeResult: (room: Room, obj: AddObjectSignal, anchor: ObjectTransform,
        cornerSignX: number, cornerSignY: number, cornerPos: Vec3): ObjectTransform | undefined =>
    {
        const objectTypeIndex = obj.objectTypeIndex;
        const baseHitboxSize = ObjectTypeConfigMap.getConfigByIndex(objectTypeIndex)
            .components.spawnedByAny?.collider?.baseHitboxSize;
        if (!baseHitboxSize)
            throw new Error(`ColliderConfig not found (objectTypeIndex = ${objectTypeIndex})`);

        const start = getQuantizedTransform(objectTypeIndex, anchor);
        const startSize = ObjectScaleUtil.getObjectSize(objectTypeIndex, start.scale);
        const right = WallAttachedObjectUtil.getRightDir(start.dir);

        const fixedCorner = {
            x: start.pos.x - cornerSignX * right.x * 0.5 * startSize.x,
            y: start.pos.y - cornerSignY * 0.5 * startSize.y,
            z: start.pos.z - cornerSignX * right.z * 0.5 * startSize.x,
        };
        const scale = ObjectScaleUtil.sanitize(objectTypeIndex, {
            x: cornerSignX * Vector3DUtil.dot(Vector3DUtil.subtract(cornerPos, fixedCorner), right)
                / baseHitboxSize.sizeX,
            y: cornerSignY * (cornerPos.y - fixedCorner.y) / baseHitboxSize.sizeY,
            z: start.scale.z,
        });
        const size = ObjectScaleUtil.getObjectSize(objectTypeIndex, scale);

        const alongX = right.x != 0;
        const outward = cornerSignX * (alongX ? right.x : right.z);
        const idealAlong = (alongX ? fixedCorner.x : fixedCorner.z) + outward * 0.5 * size.x;
        const bottomY = (cornerSignY > 0) ? fixedCorner.y : fixedCorner.y - size.y;

        // Both roundings coincide when the corner can be held exactly.
        for (const along of [snapToHalfVoxelToward(idealAlong, outward),
            snapToHalfVoxelToward(idealAlong, -outward)])
        {
            const candidate = getQuantizedTransform(objectTypeIndex, new ObjectTransform(
                {x: alongX ? along : start.pos.x, y: bottomY + 0.5 * size.y, z: alongX ? start.pos.z : along},
                {...start.dir}, scale));
            if (WallAttachedObjectUtil.canPlaceObject(room, obj.objectId, objectTypeIndex, candidate))
                return candidate;
        }
        return undefined;
    },
    getMoveResult(room: Room, obj: AddObjectSignal,
        dx: number, dy: number, dz: number): {newPos: Vec3, newDir: Vec3} | undefined
    {
        if (dz != 0)
            throw new Error(`Change in z-coordinate is not allowed in a wall-attached object.`);
        else if (dx != 0 && dy == 0) // For a wall-attached object, the "dx" value is interpreted as a movement along its 'local' x-axis (NOT the global x-axis).
            return getHorizontalMoveResult(room, obj, dx > 0);
        else if (dx == 0 && dy != 0)
            return getVerticalMoveResult(room, obj, dy > 0);
        throw new Error(`Diagonal movement (dx != 0 && dy != 0) or zero movement (dx == 0 && dy == 0) is not allowed in a wall-attached object.`);
    },
}

// Snaps to half a voxel along the wall and one layer vertically, measured from the bottom edge (snapping
// the centre would float odd-height objects off the floor). The scale is snapped too, since it decides
// where that bottom edge is.
function getQuantizedTransform(objectTypeIndex: number, transform: ObjectTransform): ObjectTransform
{
    const pos = transform.pos;
    const dir = transform.dir;
    const scale = ObjectScaleUtil.sanitize(objectTypeIndex, transform.scale);

    const halfVertical = 0.5 * ObjectScaleUtil.getObjectSize(objectTypeIndex, scale).y;
    const bottomY = COLLISION_LAYER_HEIGHT * Math.round((pos.y - halfVertical) / COLLISION_LAYER_HEIGHT);

    return new ObjectTransform(
        { // wall-attached object's position is always an integer multiple of 0.5.
            x: 0.5*Math.round(2*pos.x),
            y: bottomY + halfVertical,
            z: 0.5*Math.round(2*pos.z),
        },
        { // wall-attached object's direction only consists of -1, 0, or 1 coordinate values.
            x: Math.round(dir.x),
            y: Math.round(dir.y),
            z: Math.round(dir.z),
        },
        scale);
}

function getVerticalMoveResult(room: Room, obj: AddObjectSignal,
    moveUp: boolean): {newPos: Vec3, newDir: Vec3} | undefined
{
    const tr = getQuantizedTransform(obj.objectTypeIndex, obj.transform);

    const newPos = {x: tr.pos.x, y: tr.pos.y + (moveUp ? 0.5 : -0.5), z: tr.pos.z};
    const newDir = tr.dir;

    if (WallAttachedObjectUtil.canPlaceObject(room, obj.objectId, obj.objectTypeIndex,
        new ObjectTransform(newPos, newDir, tr.scale)))
    {
        return {newPos, newDir};
    }
    return undefined;
}

function getHorizontalMoveResult(room: Room, obj: AddObjectSignal,
    moveRight: boolean): {newPos: Vec3, newDir: Vec3} | undefined
{
    let result: {newPos: Vec3, newDir: Vec3} | undefined;
    // Try concave wrap first.
    result = getCornerWrappedHorizontalMoveResult(room, obj, moveRight, true);
    if (result)
        return result;
    // If failed, try straight move next.
    result = getStraightHorizontalMoveResult(room, obj, moveRight);
    if (result)
        return result;
    // If failed, try convex wrap next.
    return getCornerWrappedHorizontalMoveResult(room, obj, moveRight, false);
}

function getStraightHorizontalMoveResult(room: Room, obj: AddObjectSignal,
    moveRight: boolean): {newPos: Vec3, newDir: Vec3} | undefined
{
    const tr = getQuantizedTransform(obj.objectTypeIndex, obj.transform);
    const dirCCW = WallAttachedObjectUtil.getRightDir(tr.dir);

    const offset = Vector3DUtil.scale(dirCCW, moveRight ? 0.5 : -0.5);
    const newPos = Vector3DUtil.add(tr.pos, offset);
    const newDir = tr.dir;

    if (WallAttachedObjectUtil.canPlaceObject(room, obj.objectId, obj.objectTypeIndex,
        new ObjectTransform(newPos, newDir, tr.scale)))
    {
        return {newPos, newDir};
    }
    return undefined;
}

// See @docs/geometry/wall_attached_object.md (corner wrapping).

function getCornerWrappedHorizontalMoveResult(room: Room, obj: AddObjectSignal,
    moveRight: boolean, tryConcaveWrap: boolean): {newPos: Vec3, newDir: Vec3} | undefined
{
    const tr = getQuantizedTransform(obj.objectTypeIndex, obj.transform);
    const dirCCW = WallAttachedObjectUtil.getRightDir(tr.dir);

    const halfHorizontal = getQuantizedColliderHorizontalHalfSize(obj.objectTypeIndex, tr.scale);
    const offset1 = Vector3DUtil.scale(tr.dir, (tryConcaveWrap ? 1 : -1) * halfHorizontal);
    const offset2 = Vector3DUtil.scale(dirCCW, (moveRight ? 1 : -1) * halfHorizontal);

    const newPos = Vector3DUtil.add(Vector3DUtil.add(tr.pos, offset1), offset2);
    const newDir = Vector3DUtil.scale(dirCCW, (tryConcaveWrap != moveRight) ? 1 : -1);

    if (WallAttachedObjectUtil.canPlaceObject(room, obj.objectId, obj.objectTypeIndex,
        new ObjectTransform(newPos, newDir, tr.scale)))
    {
        return {newPos, newDir};
    }
    return undefined;
}

// Onto the half-voxel grid, rounding toward direction's side. The allowance keeps a value that is already
// on the grid, give or take float error, where it is.
function snapToHalfVoxelToward(value: number, direction: number): number
{
    return 0.5 * (direction > 0 ? Math.ceil(2 * value - 1e-6) : Math.floor(2 * value + 1e-6));
}

// The layers a wall attachment of the given height stands among, clamped to the room.
function getCollisionLayerRange(bottomY: number, topY: number): {minLayer: number, maxLayer: number}
{
    return {
        minLayer: Math.max(COLLISION_LAYER_MIN,
            VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(bottomY)),
        maxLayer: Math.min(COLLISION_LAYER_MAX,
            VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(topY - 0.001)),
    };
}

// Whether the voxel's occupied collision layers fully cover the given Y range.
function voxelCoversYRange(collisionLayerMask: number, bottomY: number, topY: number): boolean
{
    const {minLayer, maxLayer} = getCollisionLayerRange(bottomY, topY);
    for (let layer = minLayer; layer <= maxLayer; ++layer)
    {
        if ((collisionLayerMask & (1 << layer)) === 0)
            return false;
    }
    return true;
}

// Rounded to a half-voxel, and orientation-independent (unlike ColliderState.halfSize.x). Corner wraps
// step by this distance, so a value off the half-voxel grid would land the object between cells.
function getQuantizedColliderHorizontalHalfSize(objectTypeIndex: number, scale: Vec3): number
{
    return 0.5*Math.round(ObjectScaleUtil.getObjectSize(objectTypeIndex, scale).x);
}

// Exact (not rounded like the horizontal half size): rounding would demand an extra layer of wall and
// misalign the bottom edge.
function getColliderVerticalHalfSize(objectTypeIndex: number, scale: Vec3): number
{
    return 0.5 * ObjectScaleUtil.getObjectSize(objectTypeIndex, scale).y;
}

// At unit scale, for an attachment that doesn't exist yet (height is orientation-independent).
function getBaseColliderVerticalHalfSize(objectTypeIndex: number): number
{
    const colliderConfig = ObjectTypeConfigMap.getConfigByIndex(objectTypeIndex)
        .components.spawnedByAny?.collider;
    if (!colliderConfig)
        throw new Error(`ColliderConfig not found (objectTypeIndex = ${objectTypeIndex})`);
    return 0.5 * colliderConfig.baseHitboxSize.sizeY;
}

export default WallAttachedObjectUtil;