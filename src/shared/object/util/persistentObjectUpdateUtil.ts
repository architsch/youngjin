import EncodableByteString from "../../networking/types/encodableByteString";
import Room from "../../room/types/room";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NUM_VOXEL_COLS, NUM_VOXEL_ROWS, MAX_IMAGE_URL_LENGTH, MAX_ROOM_Y } from "../../system/sharedConstants";
import { ObjectMetadataKeyEnumMap } from "../types/objectMetadataKey";
import { getVoxelQuadIndex } from "../../voxel/util/voxelQueryUtil";
import ObjectTypeConfigMap from "../maps/objectTypeConfigMap";
import { ObjectMetadata } from "../types/objectMetadata";
import PersistentObject from "../types/persistentObject";

type Direction = "+z" | "+x" | "-z" | "-x";

export function directionStringToVector(dir: Direction): {dirX: number, dirY: number, dirZ: number}
{
    switch (dir)
    {
        case "+z": return {dirX: 0, dirY: 0, dirZ: 1};
        case "+x": return {dirX: 1, dirY: 0, dirZ: 0};
        case "-z": return {dirX: 0, dirY: 0, dirZ: -1};
        case "-x": return {dirX: -1, dirY: 0, dirZ: 0};
    }
}

// Maps dx (positive = move right from viewer's perspective) to world-space offsets.
// Viewer faces the wall from the opposite side of the normal.
// +z wall: viewer faces -z, right = +x
// -z wall: viewer faces +z, right = -x
// +x wall: viewer faces -x, right = -z
// -x wall: viewer faces +x, right = +z
function wallAttachedDxToWorld(direction: Direction, dx: number): {worldDx: number, worldDz: number}
{
    switch (direction)
    {
        case "+z": return {worldDx: dx, worldDz: 0};
        case "-z": return {worldDx: -dx, worldDz: 0};
        case "+x": return {worldDx: 0, worldDz: -dx};
        case "-x": return {worldDx: 0, worldDz: dx};
    }
}

// Checks if a visible voxel quad (wall) exists at the given position and direction.
// For ±z walls: the sliding coordinate is x. For ±x walls: the sliding coordinate is z.
// At integer sliding coordinates (edge positions), BOTH adjacent voxels must have the quad
// for "full attachment". At half-integer positions (centered), only one voxel is checked.
function isWallAt(room: Room, x: number, y: number, z: number, direction: Direction): boolean
{
    const collisionLayer = Math.min(Math.max(Math.floor(y * 2), COLLISION_LAYER_MIN), COLLISION_LAYER_MAX);

    let facingAxis: "x" | "z";
    let orientation: "-" | "+";
    switch (direction)
    {
        case "+z": facingAxis = "z"; orientation = "+"; break;
        case "-z": facingAxis = "z"; orientation = "-"; break;
        case "+x": facingAxis = "x"; orientation = "+"; break;
        case "-x": facingAxis = "x"; orientation = "-"; break;
    }

    if (facingAxis == "z")
    {
        // Wall is a z-face. Row determined by direction: +z face at z means row = z - 1, -z face at z means row = z.
        const row = (orientation == "+") ? z - 1 : z;
        if (row < 0 || row >= NUM_VOXEL_ROWS) return false;

        // Sliding coordinate is x. Check if x is integer (edge) or half-integer (center).
        const isEdge = (x % 1 === 0);
        if (isEdge)
        {
            const colLeft = x - 1;
            const colRight = x;
            // At an edge, both adjacent voxels must have the wall for full attachment.
            // But at grid boundaries (x=0 or x=NUM_VOXEL_COLS), only one side exists.
            const leftValid = colLeft >= 0 && colLeft < NUM_VOXEL_COLS
                && isQuadVisible(room, row, colLeft, facingAxis, orientation, collisionLayer);
            const rightValid = colRight >= 0 && colRight < NUM_VOXEL_COLS
                && isQuadVisible(room, row, colRight, facingAxis, orientation, collisionLayer);
            return leftValid && rightValid;
        }
        else
        {
            const col = Math.floor(x);
            if (col < 0 || col >= NUM_VOXEL_COLS) return false;
            return isQuadVisible(room, row, col, facingAxis, orientation, collisionLayer);
        }
    }
    else // facingAxis == "x"
    {
        // Wall is an x-face. Col determined by direction: +x face at x means col = x - 1, -x face at x means col = x.
        const col = (orientation == "+") ? x - 1 : x;
        if (col < 0 || col >= NUM_VOXEL_COLS) return false;

        // Sliding coordinate is z. Check if z is integer (edge) or half-integer (center).
        const isEdge = (z % 1 === 0);
        if (isEdge)
        {
            const rowLeft = z - 1;
            const rowRight = z;
            const leftValid = rowLeft >= 0 && rowLeft < NUM_VOXEL_ROWS
                && isQuadVisible(room, rowLeft, col, facingAxis, orientation, collisionLayer);
            const rightValid = rowRight >= 0 && rowRight < NUM_VOXEL_ROWS
                && isQuadVisible(room, rowRight, col, facingAxis, orientation, collisionLayer);
            return leftValid && rightValid;
        }
        else
        {
            const row = Math.floor(z);
            if (row < 0 || row >= NUM_VOXEL_ROWS) return false;
            return isQuadVisible(room, row, col, facingAxis, orientation, collisionLayer);
        }
    }
}

function isQuadVisible(room: Room, row: number, col: number,
    facingAxis: "x" | "z", orientation: "-" | "+", collisionLayer: number): boolean
{
    const quadIndex = getVoxelQuadIndex(row, col, facingAxis, orientation, collisionLayer);
    if (quadIndex < 0) return false;
    const voxel = room.voxelGrid.voxels[row * NUM_VOXEL_COLS + col];
    return (voxel.quadsMem.quads[quadIndex] & 0b10000000) !== 0;
}

// Attempts to wrap the object around a wall corner when straight movement fails.
// Returns the new position and direction, or null if no perpendicular wall exists at the corner.
function tryCornerWrap(room: Room, po: PersistentObject, dx: number, newY: number)
    : {x: number, z: number, direction: Direction} | null
{
    const movingRight = dx > 0;

    // Direction wrapping map:
    // Current dir | Move right → wrap to | Move left → wrap to
    // +z          | +x                   | -x
    // -z          | -x                   | +x
    // +x          | -z                   | +z
    // -x          | +z                   | -z
    let wrapDirection: Direction;
    switch (po.direction)
    {
        case "+z": wrapDirection = movingRight ? "+x" : "-x"; break;
        case "-z": wrapDirection = movingRight ? "-x" : "+x"; break;
        case "+x": wrapDirection = movingRight ? "-z" : "+z"; break;
        case "-x": wrapDirection = movingRight ? "+z" : "-z"; break;
    }

    // Calculate the corner position on the new (perpendicular) wall.
    // The object should appear at the edge of the new wall closest to the corner.
    let newX: number, newZ: number;

    switch (po.direction)
    {
        case "+z":
        {
            // On +z face at z = row + 1. Sliding along x.
            // Moving right: corner at right edge. Wrap to +x face.
            //   +x face of voxel(row, col): at x = col + 1, z slides from row to row+1.
            //   Corner point is at z = row + 1 (same as the +z face). Place at edge: z = row + 0.5 (half step in).
            // Moving left: corner at left edge. Wrap to -x face.
            //   -x face of voxel(row, col-1): at x = col, z slides from row to row+1.
            const row = po.z - 1;
            const col = Math.floor(po.x);
            if (movingRight)
            {
                newX = col + 1; // +x face position
                newZ = row + 0.5; // center of the perpendicular wall face
            }
            else
            {
                newX = col; // -x face position
                newZ = row + 0.5;
            }
            break;
        }
        case "-z":
        {
            // On -z face at z = row. Sliding along x.
            // Moving right (-x direction in world): corner wraps to -x face.
            // Moving left (+x direction in world): corner wraps to +x face.
            const row = po.z;
            const col = Math.floor(po.x);
            if (movingRight)
            {
                // Moving right on -z = world -x. Left edge. Wrap to -x.
                newX = col; // -x face position
                newZ = row + 0.5;
            }
            else
            {
                // Moving left on -z = world +x. Right edge. Wrap to +x.
                newX = col + 1; // +x face position
                newZ = row + 0.5;
            }
            break;
        }
        case "+x":
        {
            // On +x face at x = col + 1. Sliding along z (right = -z in world).
            const col = po.x - 1;
            const row = Math.floor(po.z);
            if (movingRight)
            {
                // Moving right on +x = world -z. Wrap to -z.
                newX = col + 0.5;
                newZ = row; // -z face position
            }
            else
            {
                // Moving left on +x = world +z. Wrap to +z.
                newX = col + 0.5;
                newZ = row + 1; // +z face position
            }
            break;
        }
        case "-x":
        {
            // On -x face at x = col. Sliding along z (right = +z in world).
            const col = po.x;
            const row = Math.floor(po.z);
            if (movingRight)
            {
                // Moving right on -x = world +z. Wrap to +z.
                newX = col + 0.5;
                newZ = row + 1; // +z face position
            }
            else
            {
                // Moving left on -x = world -z. Wrap to -z.
                newX = col + 0.5;
                newZ = row; // -z face position
            }
            break;
        }
    }

    // Check if the perpendicular wall exists at the wrapped position
    if (!isWallAt(room, newX, newY, newZ, wrapDirection))
        return null;

    return {x: newX, z: newZ, direction: wrapDirection};
}

// Attempts to wrap the object around a concave (inner) wall corner when convex wrapping fails.
// Concave corners occur when a protruding block creates an inside corner.
// The wrap direction is OPPOSITE to the convex case, and the position shifts one row/col past the corner.
function tryConcaveCornerWrap(room: Room, po: PersistentObject, dx: number, newY: number)
    : {x: number, z: number, direction: Direction} | null
{
    const movingRight = dx > 0;

    // Concave direction wrapping (opposite of convex):
    // Current dir | Move right → wrap to | Move left → wrap to
    // +z          | -x                   | +x
    // -z          | +x                   | -x
    // +x          | +z                   | -z
    // -x          | -z                   | +z
    let wrapDirection: Direction;
    switch (po.direction)
    {
        case "+z": wrapDirection = movingRight ? "-x" : "+x"; break;
        case "-z": wrapDirection = movingRight ? "+x" : "-x"; break;
        case "+x": wrapDirection = movingRight ? "+z" : "-z"; break;
        case "-x": wrapDirection = movingRight ? "-z" : "+z"; break;
    }

    let newX: number, newZ: number;

    switch (po.direction)
    {
        case "+z":
        {
            const row = po.z - 1;
            const col = Math.floor(po.x);
            if (movingRight)
            {
                newX = col + 1;
                newZ = row + 1 + 0.5; // one row past the corner
            }
            else
            {
                newX = col;
                newZ = row + 1 + 0.5;
            }
            break;
        }
        case "-z":
        {
            const row = po.z;
            const col = Math.floor(po.x);
            if (movingRight)
            {
                newX = col;
                newZ = row - 1 + 0.5;
            }
            else
            {
                newX = col + 1;
                newZ = row - 1 + 0.5;
            }
            break;
        }
        case "+x":
        {
            const col = po.x - 1;
            const row = Math.floor(po.z);
            if (movingRight)
            {
                newX = col + 1 + 0.5;
                newZ = row;
            }
            else
            {
                newX = col + 1 + 0.5;
                newZ = row + 1;
            }
            break;
        }
        case "-x":
        {
            const col = po.x;
            const row = Math.floor(po.z);
            if (movingRight)
            {
                newX = col - 1 + 0.5;
                newZ = row + 1;
            }
            else
            {
                newX = col - 1 + 0.5;
                newZ = row;
            }
            break;
        }
    }

    if (!isWallAt(room, newX, newY, newZ, wrapDirection))
        return null;

    return {x: newX, z: newZ, direction: wrapDirection};
}

//-------------------------------------------------------------------------------------
// CRUD Operations
//-------------------------------------------------------------------------------------

export function addPersistentObject(room: Room, objectTypeIndex: number,
    direction: Direction, x: number, y: number, z: number,
    metadata: ObjectMetadata = {}, objectId?: string): PersistentObject | null
{
    if (!isPersistentObjectPositionInBound(x, y, z))
    {
        console.error(`addPersistentObject :: Position out of bounds (x=${x}, y=${y}, z=${z})`);
        return null;
    }

    if (!objectId)
        objectId = `p${++room.persistentObjectGroup.lastPersistentObjectId}`;

    const po = new PersistentObject(objectId, objectTypeIndex, direction, x, y, z, metadata);
    room.persistentObjectGroup.persistentObjectById[objectId] = po;
    return po;
}

export function removePersistentObject(room: Room, objectId: string): PersistentObject | null
{
    const removed = room.persistentObjectGroup.persistentObjectById[objectId];
    if (!removed)
    {
        console.error(`removePersistentObject :: Object not found (objectId=${objectId})`);
        return null;
    }
    delete room.persistentObjectGroup.persistentObjectById[objectId];
    return removed;
}

export function movePersistentObject(room: Room, objectId: string,
    dx: number, dy: number, dz: number): PersistentObject | null
{
    const po = room.persistentObjectGroup.persistentObjectById[objectId];
    if (!po)
    {
        console.error(`movePersistentObject :: Object not found (objectId=${objectId})`);
        return null;
    }

    const config = ObjectTypeConfigMap.getConfigByIndex(po.objectTypeIndex);
    let newX = po.x + dx;
    let newY = po.y + dy;
    let newZ = po.z + dz;
    let newDirection = po.direction;

    if (config.isWallAttached)
    {
        // Wall-attached movement: dx means "slide along wall surface", with corner wrapping.
        const {worldDx, worldDz} = wallAttachedDxToWorld(po.direction, dx);
        newX = po.x + worldDx;
        newZ = po.z + worldDz;
        newDirection = po.direction;

        if (!isPersistentObjectPositionInBound(newX, newY, newZ) ||
            !isWallAt(room, newX, newY, newZ, po.direction))
        {
            // Target is either out of bound or there is no wall at the straight path.
            // Try corner wrap instead.
            let wrapped = tryCornerWrap(room, po, dx, newY);
            if (!wrapped)
                wrapped = tryConcaveCornerWrap(room, po, dx, newY);
            if (!wrapped)
                return null;
            newX = wrapped.x;
            newZ = wrapped.z;
            newDirection = wrapped.direction;
        }
    }

    // Check if the new position is out of bound
    if (!isPersistentObjectPositionInBound(newX, newY, newZ))
        return null;

    po.x = newX;
    po.y = newY;
    po.z = newZ;
    po.direction = newDirection;
    return po;
}

export function setPersistentObjectMetadata(room: Room, objectId: string,
    metadataKey: number, metadataValue: string): PersistentObject | null
{
    const po = room.persistentObjectGroup.persistentObjectById[objectId];
    if (!po)
    {
        console.error(`setPersistentObjectMetadata :: Object not found (objectId=${objectId})`);
        return null;
    }

    if (metadataKey === ObjectMetadataKeyEnumMap.ImageURL
        && metadataValue.length > MAX_IMAGE_URL_LENGTH)
    {
        console.error(`setPersistentObjectMetadata :: ImageURL exceeds max length (${metadataValue.length} > ${MAX_IMAGE_URL_LENGTH})`);
        return null;
    }

    po.metadata[metadataKey] = new EncodableByteString(metadataValue);
    return po;
}

//-------------------------------------------------------------------------------------
// Block Removal Guard
//-------------------------------------------------------------------------------------

// Returns true if removing the voxel block at (row, col, collisionLayer) would cause
// any wall-attached persistent object to lose its wall support.
export function wouldBlockRemovalBreakPersistentObject(
    room: Room, row: number, col: number, collisionLayer: number): boolean
{
    for (const po of Object.values(room.persistentObjectGroup.persistentObjectById))
    {
        const config = ObjectTypeConfigMap.getConfigByIndex(po.objectTypeIndex);
        if (!config.isWallAttached) continue;

        // The mesh surface spans vertically from po.y to po.y + 1 (1 unit tall).
        // Collision layers are 0.5 units each (layer = floor(y * 2)).
        // Check all collision layers that the mesh overlaps.
        const meshBottomLayer = Math.min(
            Math.max(Math.floor(po.y * 2), COLLISION_LAYER_MIN),
            COLLISION_LAYER_MAX
        );
        const meshTopLayer = Math.min(
            Math.max(Math.floor((po.y + 1) * 2 - 0.001), COLLISION_LAYER_MIN),
            COLLISION_LAYER_MAX
        );
        if (collisionLayer < meshBottomLayer || collisionLayer > meshTopLayer) continue;

        if (doesBlockSupportPersistentObject(po, row, col))
            return true;
    }
    return false;
}

function doesBlockSupportPersistentObject(
    po: PersistentObject, blockRow: number, blockCol: number): boolean
{
    switch (po.direction)
    {
        case "+z":
        {
            const wallRow = po.z - 1;
            if (blockRow !== wallRow) return false;
            return isBlockInSlidingRange(po.x, blockCol);
        }
        case "-z":
        {
            const wallRow = po.z;
            if (blockRow !== wallRow) return false;
            return isBlockInSlidingRange(po.x, blockCol);
        }
        case "+x":
        {
            const wallCol = po.x - 1;
            if (blockCol !== wallCol) return false;
            return isBlockInSlidingRange(po.z, blockRow);
        }
        case "-x":
        {
            const wallCol = po.x;
            if (blockCol !== wallCol) return false;
            return isBlockInSlidingRange(po.z, blockRow);
        }
    }
}

function isBlockInSlidingRange(slidingCoord: number, blockIndex: number): boolean
{
    // The mesh surface spans ±0.5 from the center along the sliding axis.
    // Any block whose face overlaps with [center - 0.5, center + 0.5] must be protected.
    const meshMin = slidingCoord - 0.5;
    const meshMax = slidingCoord + 0.5;
    // A block at index i covers [i, i+1]. It overlaps the mesh range if i < meshMax && i+1 > meshMin.
    return blockIndex < meshMax && (blockIndex + 1) > meshMin;
}

function isPersistentObjectPositionInBound(x: number, y: number, z: number): boolean
{
    return x >= 1 && x <= NUM_VOXEL_COLS-1 &&
        y > 0 && y < MAX_ROOM_Y &&
        z >= 1 && z <= NUM_VOXEL_ROWS-1;
}