import Vec3 from "../../math/types/vec3";
import DirUtil from "../../math/util/dirUtil";
import Vector3DUtil from "../../math/util/vector3DUtil";
import { ColliderState } from "../../physics/types/colliderState";
import PhysicsColliderStateUtil from "../../physics/util/physicsColliderStateUtil";
import PhysicsObjectUtil from "../../physics/util/physicsObjectUtil";
import Room from "../../room/types/room";
import { COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, MAX_ROOM_Y, NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../../system/sharedConstants";
import VoxelQueryUtil from "../../voxel/util/voxelQueryUtil";
import AddObjectSignal from "../types/addObjectSignal";
import ObjectTypeConfigMap from "../maps/objectTypeConfigMap";

const WallAttachedObjectUtil =
{
    canPlaceObject: (room: Room, objectId: string, objectTypeIndex: number,
        pos: Vec3, dir: Vec3): boolean =>
    {
        const tr = getQuantizedTransform(objectTypeIndex, pos, dir);
        pos = tr.pos;
        dir = tr.dir;

        // Object's center position must not be out of the room's boundaries.

        if (pos.x < 1 || pos.x > NUM_VOXEL_COLS-1 ||
            pos.y <= 0 || pos.y >= MAX_ROOM_Y ||
            pos.z < 1 || pos.z > NUM_VOXEL_ROWS-1)
        {
            return false;
        }

        // Object should not be able to penetrate halfway through the room's boundary wall.

        if (((pos.x <= 1 || pos.x >= NUM_VOXEL_COLS-1) && dir.z != 0) ||
            ((pos.z <= 1 || pos.z >= NUM_VOXEL_ROWS-1) && dir.x != 0))
        {
            return false;
        }

        const newColliderState = PhysicsColliderStateUtil.getObjectColliderState(objectTypeIndex, pos, dir);
        if (!newColliderState)
            throw new Error(`new ColliderState not found (objectTypeIndex = ${objectTypeIndex})`);

        const halfHorizontal = getQuantizedColliderHorizontalHalfSize(newColliderState);
        const halfVertical = getColliderVerticalHalfSize(newColliderState);

        // (1) The object's back side must be fully covered (by voxel blocks).
        // (2) The object's front side must be at least partially exposed.
        // We check voxel occupancy using the object's Y range against collision layers.

        const objBottomY = newColliderState.hitbox.center.y - halfVertical;
        const objTopY = newColliderState.hitbox.center.y + halfVertical;
        let frontExposureFound = false;

        // Determine which direction the object faces for back/front scanning
        const absX = Math.abs(dir.x);
        const absZ = Math.abs(dir.z);
        const primaryAxis = absZ >= absX ? "z" : "x";

        // NOTE:
        // See the section called "Finding the Front/Back-Facing Voxels of a Wall-Attached Object"
        // in @docs/geometry/wall_attached_object.md for technical details.

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
    // The wall-attached objects that the given voxel block is holding up: those whose back side
    // rests against it. Nothing else keeps them on the wall, so taking the block away has to
    // account for them — either by refusing, or by taking them down along with it.
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
            // An object hanging on this block stands in front of it, and so faces away from it. One
            // that faces towards it is merely overlapping it from the far side, and hangs elsewhere.
            const fromVoxelToObject = Vector3DUtil.subtract(object.transform.pos, voxelPos);
            if (Vector3DUtil.dot(object.transform.dir, fromVoxelToObject) > 0)
                objectIds.push(collidingObject.objectId);
        }
        return objectIds;
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

// Snaps a wall attachment onto the grid it hangs on: half a voxel along the wall, and one collision
// layer up it.
//
// The vertical step is measured from the object's bottom edge rather than from its centre. An object
// standing an odd number of layers tall — a door does — has its centre half a layer off that grid, so
// snapping the centre would shift it a quarter of a layer off the floor it stands on every time it
// was nudged, while an object of even height is unaffected either way.
function getQuantizedTransform(objectTypeIndex: number, pos: Vec3, dir: Vec3): {pos: Vec3, dir: Vec3}
{
    const halfVertical = getColliderVerticalHalfSizeByType(objectTypeIndex);
    const bottomY = COLLISION_LAYER_HEIGHT * Math.round((pos.y - halfVertical) / COLLISION_LAYER_HEIGHT);

    return {
        pos: { // wall-attached object's position is always an integer multiple of 0.5.
            x: 0.5*Math.round(2*pos.x),
            y: bottomY + halfVertical,
            z: 0.5*Math.round(2*pos.z),
        },
        dir: { // wall-attached object's direction only consists of -1, 0, or 1 coordinate values.
            x: Math.round(dir.x),
            y: Math.round(dir.y),
            z: Math.round(dir.z),
        },
    };
}

function getVerticalMoveResult(room: Room, obj: AddObjectSignal,
    moveUp: boolean): {newPos: Vec3, newDir: Vec3} | undefined
{
    const tr = getQuantizedTransform(obj.objectTypeIndex, obj.transform.pos, obj.transform.dir);

    const newPos = {x: tr.pos.x, y: tr.pos.y + (moveUp ? 0.5 : -0.5), z: tr.pos.z};
    const newDir = tr.dir;

    if (WallAttachedObjectUtil.canPlaceObject(room, obj.objectId, obj.objectTypeIndex, newPos, newDir))
        return {newPos, newDir};
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
    const tr = getQuantizedTransform(obj.objectTypeIndex, obj.transform.pos, obj.transform.dir);

    const dir4 = DirUtil.vec3ToDir4(tr.dir);
    const dir4CCW = DirUtil.rotateCCW(dir4);
    const dirCCW = DirUtil.dir4ToVec3(dir4CCW);

    const offset = Vector3DUtil.scale(dirCCW, moveRight ? 0.5 : -0.5);
    const newPos = Vector3DUtil.add(tr.pos, offset);
    const newDir = tr.dir;

    if (WallAttachedObjectUtil.canPlaceObject(room, obj.objectId, obj.objectTypeIndex, newPos, newDir))
        return {newPos, newDir};
    return undefined;
}

// NOTE:
// See the section called "Computing Corner-Wrapped Movement of a Wall-Attached Object"
// in @docs/geometry/wall_attached_object.md for technical details.

function getCornerWrappedHorizontalMoveResult(room: Room, obj: AddObjectSignal,
    moveRight: boolean, tryConcaveWrap: boolean): {newPos: Vec3, newDir: Vec3} | undefined
{
    const tr = getQuantizedTransform(obj.objectTypeIndex, obj.transform.pos, obj.transform.dir);

    const dir4 = DirUtil.vec3ToDir4(tr.dir);
    const dir4CCW = DirUtil.rotateCCW(dir4);
    const dirCCW = DirUtil.dir4ToVec3(dir4CCW);

    const colliderState = PhysicsColliderStateUtil.getObjectColliderState(obj.objectTypeIndex, tr.pos, tr.dir);
    if (!colliderState)
        throw new Error(`ColliderState not found (objectTypeIndex = ${obj.objectTypeIndex})`);

    const halfHorizontal = getQuantizedColliderHorizontalHalfSize(colliderState);
    const offset1 = Vector3DUtil.scale(tr.dir, (tryConcaveWrap ? 1 : -1) * halfHorizontal);
    const offset2 = Vector3DUtil.scale(dirCCW, (moveRight ? 1 : -1) * halfHorizontal);

    const newPos = Vector3DUtil.add(Vector3DUtil.add(tr.pos, offset1), offset2);
    const newDir = Vector3DUtil.scale(dirCCW, (tryConcaveWrap != moveRight) ? 1 : -1);

    if (WallAttachedObjectUtil.canPlaceObject(room, obj.objectId, obj.objectTypeIndex, newPos, newDir))
        return {newPos, newDir};
    return undefined;
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

function getQuantizedColliderHorizontalHalfSize(colliderState: ColliderState): number
{
    // ColliderConfig's sizeX is not being affected by the collider's
    // current orientation (i.e. whether is aligned with x-axis or z-axis),
    // unlike ColliderState's halfSizeX which varies depending on the
    // collider's orientation.
    const hitboxSize = colliderState.colliderConfig.hitboxSize;
    return 0.5*Math.round(hitboxSize.sizeX);
}

// Unlike the horizontal half size above, this one is exact. The horizontal rounding is what makes an
// attachment claim whole voxel columns of wall; vertically there is nothing to round to, since the
// collision layers an attachment is checked against are already finer than the object itself, and
// rounding here would make a door that stands seven layers tall demand eight layers of wall behind
// it — and, worse, land a quarter of a layer off the floor whenever it was quantized.
function getColliderVerticalHalfSize(colliderState: ColliderState): number
{
    return 0.5 * colliderState.colliderConfig.hitboxSize.sizeY;
}

// The same figure read straight off the object's type, for use before a collider state exists — the
// height of a hitbox does not depend on which way the object is turned.
function getColliderVerticalHalfSizeByType(objectTypeIndex: number): number
{
    const colliderConfig = ObjectTypeConfigMap.getConfigByIndex(objectTypeIndex)
        .components.spawnedByAny?.collider;
    if (!colliderConfig)
        throw new Error(`ColliderConfig not found (objectTypeIndex = ${objectTypeIndex})`);
    return 0.5 * colliderConfig.hitboxSize.sizeY;
}

export default WallAttachedObjectUtil;