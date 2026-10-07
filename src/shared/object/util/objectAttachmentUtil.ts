import Vec3 from "../../math/types/vec3";
import Geometry3DUtil from "../../math/util/geometry3DUtil";
import Vector3DUtil from "../../math/util/vector3DUtil";
import PhysicsColliderStateUtil from "../../physics/util/physicsColliderStateUtil";
import PhysicsObjectUtil from "../../physics/util/physicsObjectUtil";
import Room from "../../room/types/room";
import { COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, MAX_ROOM_Y, NUM_VOXEL_COLS,
    NUM_VOXEL_ROWS, VOXEL_BLOCK_SHAPE_WHOLE } from "../../system/sharedConstants";
import VoxelQueryUtil from "../../voxel/util/voxelQueryUtil";
import Voxel from "../../voxel/types/voxel";
import VoxelBlockShapeOverride from "../../voxel/types/voxelBlockShapeOverride";
import AddObjectSignal from "../types/addObjectSignal";
import ObjectTransform from "../types/objectTransform";
import ObjectTypeConfigMap from "../maps/objectTypeConfigMap";
import ObjectScaleUtil from "./objectScaleUtil";

// Placement of objects attached to a voxel face (see @docs/geometry/object_attachment.md). Positions across
// the face snap to a quarter voxel, so an object half a voxel across can sit flush with a block's edge; the
// face itself lies on the side of a cell or across its middle, where a shrunk block's face can be. What
// lies behind and in front of it is asked of sub-blocks, the half cells a block's shape is made of (see
// VoxelBlockShapeUtil).
const GRID_STEP = 0.25;
const FACE_PLANE_STEP = 0.5;

// Keeps a footprint edge lying on a sub-block boundary out of the sub-block beyond it.
const EDGE_EPSILON = 0.01;

const ObjectAttachmentUtil =
{
    // Whether the type may face this way, read by the facing's nearest axis.
    allowsFacing: (objectTypeIndex: number, dir: Vec3): boolean =>
    {
        const attachment = ObjectTypeConfigMap.getConfigByIndex(objectTypeIndex).attachment;
        if (!attachment)
            return false;
        const {normal} = Geometry3DUtil.getAxisFacingBasis(dir);
        return attachment.allowedDirections.some(allowed => Vector3DUtil.dot(allowed, normal) > 0.5);
    },
    // blockShapeOverride: a block to take as having another shape, to ask whether the object would still
    // have its place if it did.
    canPlaceObject: (room: Room, objectId: string, objectTypeIndex: number,
        transform: ObjectTransform, blockShapeOverride?: VoxelBlockShapeOverride): boolean =>
    {
        if (!ObjectAttachmentUtil.allowsFacing(objectTypeIndex, transform.dir))
            return false;
        const tr = getQuantizedTransform(objectTypeIndex, transform);
        const bounds = getFootprintBounds(objectTypeIndex, tr);

        // The whole footprint, not just its centre, since the scans below stop at the room's edge.
        // The face itself may lie on the room's floor or ceiling.
        if (bounds.min.x < 0 || bounds.max.x > NUM_VOXEL_COLS ||
            bounds.min.y < 0 || bounds.max.y > MAX_ROOM_Y ||
            bounds.min.z < 0 || bounds.max.z > NUM_VOXEL_ROWS)
        {
            return false;
        }

        // Every sub-block behind it is solid (it is supported), and at least one in front is open (it is
        // not buried). A type that needs whole blocks is supported by those alone.
        const voxels = room.voxelGrid.voxels;
        const wholeBlocksOnly = needsWholeBlocks(objectTypeIndex);
        let supported = true;
        forEachSubBlockBeside(tr, bounds, -1, (subRow, subCol, layer) => {
            supported = subBlockIsSolid(voxels, subRow, subCol, layer, wholeBlocksOnly, blockShapeOverride);
            return supported;
        });
        if (!supported)
            return false;
        let exposed = false;
        forEachSubBlockBeside(tr, bounds, 1, (subRow, subCol, layer) => {
            exposed = subBlockIsOpen(voxels, subRow, subCol, layer, blockShapeOverride);
            return !exposed;
        });
        if (!exposed)
            return false;

        // It overlaps no other attached object.
        const colliderState = PhysicsColliderStateUtil.getObjectColliderState(objectTypeIndex, tr);
        if (!colliderState)
            throw new Error(`ColliderState not found (objectTypeIndex = ${objectTypeIndex})`);
        const collidingObjects = PhysicsObjectUtil.getObjectsCollidingWith3DVolume(room.id, colliderState);
        for (const collidingObject of Object.values(collidingObjects))
        {
            if (collidingObject.objectId != objectId &&
                ObjectTypeConfigMap.getConfigByIndex(collidingObject.objectTypeIndex).attachment)
            {
                return false;
            }
        }
        return true;
    },
    // Attached objects resting on this block (they must be refused or removed along with it).
    getObjectIdsAttachedToVoxelBlock: (room: Room, quadIndex: number): string[] =>
    {
        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

        const objectIds: string[] = [];
        const voxelBlockColliderState = PhysicsColliderStateUtil.getVoxelBlockColliderState(
            room.voxelGrid.voxels, row, col, collisionLayer);
        // The block's own middle, which an object on a shrunk block's inner face is still clear of.
        const voxelPos = voxelBlockColliderState.hitbox.center;
        const collidingObjects = PhysicsObjectUtil.getObjectsCollidingWith3DVolume(room.id, voxelBlockColliderState);
        for (const collidingObject of Object.values(collidingObjects))
        {
            if (!ObjectTypeConfigMap.getConfigByIndex(collidingObject.objectTypeIndex).attachment)
                continue;
            const object = room.objectById[collidingObject.objectId];
            if (!object)
            {
                console.error(`Colliding object not found (objectId = ${collidingObject.objectId})`);
                continue;
            }
            // Objects on this block face away from it; ones facing it rest on the block beyond.
            const {normal} = Geometry3DUtil.getAxisFacingBasis(object.transform.dir);
            const fromVoxelToObject = Vector3DUtil.subtract(object.transform.pos, voxelPos);
            if (Vector3DUtil.dot(normal, fromVoxelToObject) > 0)
                objectIds.push(collidingObject.objectId);
        }
        return objectIds;
    },
    // How much of a face the attached objects lying on it cover, from 0 (none) to 1 (all of it): a block's face,
    // or the room's own floor or ceiling over a cell.
    getVoxelQuadCoverage: (room: Room, quadIndex: number): number =>
    {
        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
        const voxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, row, col);
        if (!voxel)
            return 0;
        const dims = VoxelQueryUtil.getVoxelQuadTransformDimensions(room.voxelGrid.voxels, quadIndex, true);
        const normal: Vec3 = {x: dims.dirX, y: dims.dirY, z: dims.dirZ};
        const center: Vec3 = {x: col + 0.5 + dims.offsetX, y: dims.offsetY, z: row + 0.5 + dims.offsetZ};
        // Flat on its plane, as a footprint is, and as large as the face (a shrunk block's is smaller).
        const {right, up} = Geometry3DUtil.getAxisFacingBasis(normal);
        const half: Vec3 = {
            x: 0.5 * (Math.abs(right.x) * dims.scaleX + Math.abs(up.x) * dims.scaleY),
            y: 0.5 * (Math.abs(right.y) * dims.scaleX + Math.abs(up.y) * dims.scaleY),
            z: 0.5 * (Math.abs(right.z) * dims.scaleX + Math.abs(up.z) * dims.scaleY),
        };
        const faceMin = Vector3DUtil.subtract(center, half);
        const faceMax = Vector3DUtil.add(center, half);
        const axesAcross = (["x", "y", "z"] as const).filter(axis => normal[axis] == 0);

        let coveredArea = 0;
        for (const object of Object.values(room.objectById))
        {
            if (!ObjectTypeConfigMap.getConfigByIndex(object.objectTypeIndex).attachment)
                continue;
            // On the placement grid a facing is exactly its axis and a face exactly on its plane, whatever the
            // stored transform decoded to.
            const tr = getQuantizedTransform(object.objectTypeIndex, object.transform);
            if (!Vector3DUtil.equal(tr.dir, normal) ||
                Vector3DUtil.dot(normal, Vector3DUtil.subtract(tr.pos, center)) != 0)
            {
                continue;
            }
            const bounds = getFootprintBounds(object.objectTypeIndex, tr);
            coveredArea += axesAcross.reduce((area, axis) => area * Math.max(0,
                Math.min(faceMax[axis], bounds.max[axis]) - Math.max(faceMin[axis], bounds.min[axis])), 1);
        }
        const faceArea = axesAcross.reduce((area, axis) => area * 2 * half[axis], 1);
        return Math.min(1, coveredArea / faceArea);
    },
    // Where an object of this size and facing goes when asked to be centred on center (a point on its
    // face). The spots tried, in order: that spot on the placement grid; then, given from (where the object
    // stands on the same face), the spots on the way back there; otherwise the spots within half the
    // footprint around it, nearest first. The first that accepts takes with its face wholly in the open
    // wins, else the first it takes at all, so that a spot snapped half into a neighbouring block (as at
    // the foot of a wall) gives way to a clear one nearby. Undefined if accepts takes none.
    findPlacement: (room: Room, objectTypeIndex: number, center: Vec3, dir: Vec3, scale: Vec3,
        accepts: (transform: ObjectTransform) => boolean, from?: Vec3): ObjectTransform | undefined =>
    {
        const spots: Vec3[] = [center];
        if (from)
        {
            const numSteps = Math.ceil(Math.sqrt(Vector3DUtil.distSqr(center, from)) / GRID_STEP);
            for (let step = 1; step <= numSteps; ++step)
            {
                spots.push(Vector3DUtil.add(center,
                    Vector3DUtil.scale(Vector3DUtil.subtract(from, center), step / numSteps)));
            }
        }
        else
        {
            const {right, up} = Geometry3DUtil.getAxisFacingBasis(dir);
            const size = ObjectScaleUtil.getObjectSize(objectTypeIndex, scale);
            const reachX = Math.ceil(0.5 * size.x / GRID_STEP);
            const reachY = Math.ceil(0.5 * size.y / GRID_STEP);
            const offsets: {i: number, j: number}[] = [];
            for (let i = -reachX; i <= reachX; ++i)
            {
                for (let j = -reachY; j <= reachY; ++j)
                    offsets.push({i, j});
            }
            offsets.sort((a, b) => (a.i * a.i + a.j * a.j) - (b.i * b.i + b.j * b.j));
            for (const {i, j} of offsets)
            {
                spots.push(Vector3DUtil.add(center, Vector3DUtil.add(
                    Vector3DUtil.scale(right, i * GRID_STEP), Vector3DUtil.scale(up, j * GRID_STEP))));
            }
        }

        const tried = new Set<string>();
        let partlyCovered: ObjectTransform | undefined;
        for (const spot of spots)
        {
            const candidate = getQuantizedTransform(objectTypeIndex, new ObjectTransform(spot, dir, scale));
            const key = `${candidate.pos.x},${candidate.pos.y},${candidate.pos.z}`;
            if (tried.has(key))
                continue;
            tried.add(key);
            if (!accepts(candidate))
                continue;
            if (faceIsClear(room.voxelGrid.voxels, objectTypeIndex, candidate))
                return candidate;
            partlyCovered ??= candidate;
        }
        return partlyCovered;
    },
    // Where a resize puts the object when one corner is dragged to cornerPos: the nearest size its type
    // allows, with the opposite corner of anchor (the object as the drag began) held still. Undefined if that
    // size doesn't fit there. cornerSignX/Y: the dragged corner, +1 toward the face's right / up (see
    // Geometry3DUtil.getAxisFacingBasis), -1 the other way.
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
        const {right, up} = Geometry3DUtil.getAxisFacingBasis(start.dir);
        const toFixed = Vector3DUtil.add(Vector3DUtil.scale(right, -cornerSignX * 0.5 * startSize.x),
            Vector3DUtil.scale(up, -cornerSignY * 0.5 * startSize.y));
        const fixedCorner = Vector3DUtil.add(start.pos, toFixed);

        const toDragged = Vector3DUtil.subtract(cornerPos, fixedCorner);
        const scale = ObjectScaleUtil.sanitize(objectTypeIndex, {
            x: cornerSignX * Vector3DUtil.dot(toDragged, right) / baseHitboxSize.sizeX,
            y: cornerSignY * Vector3DUtil.dot(toDragged, up) / baseHitboxSize.sizeY,
            z: start.scale.z,
        });
        const size = ObjectScaleUtil.getObjectSize(objectTypeIndex, scale);
        const ideal = Vector3DUtil.add(fixedCorner, Vector3DUtil.add(
            Vector3DUtil.scale(right, cornerSignX * 0.5 * size.x),
            Vector3DUtil.scale(up, cornerSignY * 0.5 * size.y)));

        // Every type's sizes come in half-voxel steps, so half of one is on the grid and the corner holds exactly.
        const candidate = getQuantizedTransform(objectTypeIndex, new ObjectTransform(ideal, {...start.dir}, scale));
        return ObjectAttachmentUtil.canPlaceObject(room, obj.objectId, objectTypeIndex, candidate)
            ? candidate : undefined;
    },
    // The object at another size where it stands, on the placement grid: its centre stays across the face,
    // except vertically, where the bottom edge does (the edge the grid snaps), so going back to the
    // earlier size puts it back exactly. Whether it fits there is canPlaceObject's to say.
    getResizedInPlace: (objectTypeIndex: number, transform: ObjectTransform, scale: Vec3): ObjectTransform =>
    {
        const {right, up} = Geometry3DUtil.getAxisFacingBasis(transform.dir);
        const heightOf = (size: Vec3) => Math.abs(right.y) * size.x + Math.abs(up.y) * size.y;
        const grownBy = heightOf(ObjectScaleUtil.getObjectSize(objectTypeIndex, scale))
            - heightOf(ObjectScaleUtil.getObjectSize(objectTypeIndex, transform.scale));
        return getQuantizedTransform(objectTypeIndex, new ObjectTransform(
            {...transform.pos, y: transform.pos.y + 0.5 * grownBy}, {...transform.dir}, {...scale}));
    },
    // The object at another size over where it stands, each way it may grow or shrink there, in the order to try
    // them: along each of the face's axes it holds its lower edge (a wall's bottom, and its left along the face's
    // right), then its upper edge, then its centre. On the placement grid; whether each fits is canPlaceObject's
    // to say.
    getResizeCandidates: (objectTypeIndex: number, transform: ObjectTransform, scale: Vec3): ObjectTransform[] =>
    {
        const start = getQuantizedTransform(objectTypeIndex, transform);
        const {right, up} = Geometry3DUtil.getAxisFacingBasis(start.dir);
        const fromSize = ObjectScaleUtil.getObjectSize(objectTypeIndex, start.scale);
        const toSize = ObjectScaleUtil.getObjectSize(objectTypeIndex, scale);
        const centreShifts = (from: number, to: number) => [0.5 * (to - from), -0.5 * (to - from), 0];

        const candidates: ObjectTransform[] = [];
        const seen = new Set<string>();
        for (const alongUp of centreShifts(fromSize.y, toSize.y))
        {
            for (const alongRight of centreShifts(fromSize.x, toSize.x))
            {
                const candidate = getQuantizedTransform(objectTypeIndex, new ObjectTransform(Vector3DUtil.add(start.pos,
                    Vector3DUtil.add(Vector3DUtil.scale(right, alongRight), Vector3DUtil.scale(up, alongUp))),
                    {...start.dir}, {...scale}));
                const key = `${candidate.pos.x},${candidate.pos.y},${candidate.pos.z}`;
                if (!seen.has(key))
                {
                    seen.add(key);
                    candidates.push(candidate);
                }
            }
        }
        return candidates;
    },
}

// Onto the placement grid: the face on its plane, the centre on the grid along X and Z, and the bottom edge
// on it along Y (so an object stands on the grid whatever its height). The facing snaps onto its axis and the
// scale onto its steps, since both decide where the edges are.
function getQuantizedTransform(objectTypeIndex: number, transform: ObjectTransform): ObjectTransform
{
    const scale = ObjectScaleUtil.sanitize(objectTypeIndex, transform.scale);
    const {normal, right, up} = Geometry3DUtil.getAxisFacingBasis(transform.dir);
    const size = ObjectScaleUtil.getObjectSize(objectTypeIndex, scale);
    const halfHeight = 0.5 * (Math.abs(right.y) * size.x + Math.abs(up.y) * size.y);
    const pos = transform.pos;

    // A wall's face lies on the side of a cell or across its middle (only on the side, for a type that
    // needs whole blocks); a floor's or a ceiling's lies on a whole layer.
    const planeStep = needsWholeBlocks(objectTypeIndex) ? 1 : FACE_PLANE_STEP;
    const snapToWallPlane = (value: number) => planeStep * Math.round(value / planeStep);

    return new ObjectTransform(
        {
            x: (normal.x != 0) ? snapToWallPlane(pos.x) : snapToGrid(pos.x),
            y: (normal.y != 0) ? COLLISION_LAYER_HEIGHT * Math.round(pos.y / COLLISION_LAYER_HEIGHT)
                : snapToGrid(pos.y - halfHeight) + halfHeight,
            z: (normal.z != 0) ? snapToWallPlane(pos.z) : snapToGrid(pos.z),
        },
        normal, scale);
}

function needsWholeBlocks(objectTypeIndex: number): boolean
{
    return ObjectTypeConfigMap.getConfigByIndex(objectTypeIndex).attachment?.wholeBlocksOnly === true;
}

// The footprint's extent in the world: its face, flat on its plane.
function getFootprintBounds(objectTypeIndex: number, tr: ObjectTransform): {min: Vec3, max: Vec3}
{
    const size = ObjectScaleUtil.getObjectSize(objectTypeIndex, tr.scale);
    const {right, up} = Geometry3DUtil.getAxisFacingBasis(tr.dir);
    const half: Vec3 = {
        x: 0.5 * (Math.abs(right.x) * size.x + Math.abs(up.x) * size.y),
        y: 0.5 * (Math.abs(right.y) * size.x + Math.abs(up.y) * size.y),
        z: 0.5 * (Math.abs(right.z) * size.x + Math.abs(up.z) * size.y),
    };
    return {min: Vector3DUtil.subtract(tr.pos, half), max: Vector3DUtil.add(tr.pos, half)};
}

// Visits the sub-blocks one step to the given side of the face (+1: in front, -1: behind) across the
// footprint, until visit returns false. A sub-block is named by its half cell along z and x, and its layer.
// Coordinates are unclamped, so sub-blocks beyond the room are visited too.
function forEachSubBlockBeside(tr: ObjectTransform, bounds: {min: Vec3, max: Vec3}, side: number,
    visit: (subRow: number, subCol: number, layer: number) => boolean): void
{
    const {normal} = Geometry3DUtil.getAxisFacingBasis(tr.dir);
    const reach = side * EDGE_EPSILON;
    const range = (toIndex: (v: number) => number, facing: number, pos: number, min: number, max: number) =>
        (facing != 0)
            ? {first: toIndex(pos + reach * facing), last: toIndex(pos + reach * facing)}
            : {first: toIndex(min + EDGE_EPSILON), last: toIndex(max - EDGE_EPSILON)};
    const toHalfCell = (v: number) => Math.floor(2 * v);

    const subCols = range(toHalfCell, normal.x, tr.pos.x, bounds.min.x, bounds.max.x);
    const layers = range(VoxelQueryUtil.getVoxelCollisionLayerFromWorldY, normal.y, tr.pos.y,
        bounds.min.y, bounds.max.y);
    const subRows = range(toHalfCell, normal.z, tr.pos.z, bounds.min.z, bounds.max.z);

    for (let subRow = subRows.first; subRow <= subRows.last; ++subRow)
    {
        for (let subCol = subCols.first; subCol <= subCols.last; ++subCol)
        {
            for (let layer = layers.first; layer <= layers.last; ++layer)
            {
                if (!visit(subRow, subCol, layer))
                    return;
            }
        }
    }
}

// Whether every sub-block in front of a (quantized) placement is open, not just one.
function faceIsClear(voxels: Voxel[], objectTypeIndex: number, tr: ObjectTransform): boolean
{
    let clear = true;
    forEachSubBlockBeside(tr, getFootprintBounds(objectTypeIndex, tr), 1, (subRow, subCol, layer) => {
        clear = subBlockIsOpen(voxels, subRow, subCol, layer);
        return clear;
    });
    return clear;
}

// Whether a sub-block is part of a block (of a whole one, if only those count). Beyond the layer range is
// the room's own floor or ceiling; beyond the grid is nothing to rest on.
function subBlockIsSolid(voxels: Voxel[], subRow: number, subCol: number, layer: number,
    wholeBlocksOnly: boolean, blockShapeOverride?: VoxelBlockShapeOverride): boolean
{
    const voxel = VoxelQueryUtil.getVoxel(voxels, subRow >> 1, subCol >> 1);
    if (!voxel)
        return false;
    if (layer < COLLISION_LAYER_MIN || layer > COLLISION_LAYER_MAX)
        return true;
    const shape = getBlockShape(voxel, layer, blockShapeOverride);
    return wholeBlocksOnly ? (shape == VOXEL_BLOCK_SHAPE_WHOLE) : shapeFillsSubBlock(shape, subRow, subCol);
}

// Inside the room and no part of a block.
function subBlockIsOpen(voxels: Voxel[], subRow: number, subCol: number, layer: number,
    blockShapeOverride?: VoxelBlockShapeOverride): boolean
{
    const voxel = VoxelQueryUtil.getVoxel(voxels, subRow >> 1, subCol >> 1);
    if (!voxel || layer < COLLISION_LAYER_MIN || layer > COLLISION_LAYER_MAX)
        return false;
    return !shapeFillsSubBlock(getBlockShape(voxel, layer, blockShapeOverride), subRow, subCol);
}

function getBlockShape(voxel: Voxel, layer: number, blockShapeOverride?: VoxelBlockShapeOverride): number
{
    if (blockShapeOverride != undefined && blockShapeOverride.row == voxel.row &&
        blockShapeOverride.col == voxel.col && blockShapeOverride.collisionLayer == layer)
    {
        return blockShapeOverride.shape;
    }
    return VoxelQueryUtil.getVoxelBlockShape(voxel, layer);
}

// A shape's bit for a sub-block is its half along x plus twice its half along z (see VOXEL_BLOCK_SHAPE_EMPTY).
function shapeFillsSubBlock(shape: number, subRow: number, subCol: number): boolean
{
    return (shape & (1 << ((subCol & 1) + 2 * (subRow & 1)))) != 0;
}

function snapToGrid(value: number): number
{
    return GRID_STEP * Math.round(value / GRID_STEP);
}

export default ObjectAttachmentUtil;
