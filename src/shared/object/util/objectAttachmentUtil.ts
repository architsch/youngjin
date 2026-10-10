import Vec3 from "../../math/types/vec3";
import Geometry3DUtil from "../../math/util/geometry3DUtil";
import Vector3DUtil from "../../math/util/vector3DUtil";
import PhysicsColliderStateUtil from "../../physics/util/physicsColliderStateUtil";
import PhysicsObjectUtil from "../../physics/util/physicsObjectUtil";
import Room from "../../room/types/room";
import { COLLISION_LAYER_HEIGHT, MAX_ROOM_X, MAX_ROOM_Y, MAX_ROOM_Z,
    VOXEL_CELL_SIZE } from "../../system/sharedConstants";
import VoxelQueryUtil from "../../voxel/util/voxelQueryUtil";
import Voxel from "../../voxel/types/voxel";
import AddObjectSignal from "../types/addObjectSignal";
import ObjectTransform from "../types/objectTransform";
import ObjectTypeConfigMap from "../maps/objectTypeConfigMap";
import ObjectScaleUtil from "./objectScaleUtil";

// Placement of objects attached to a voxel face (see @docs/geometry/object_attachment.md). Positions across
// the face snap to half a block, so an object one block across can sit on a block or astride two; the face
// itself lies on the side of a block.
const GRID_STEP = 0.5 * VOXEL_CELL_SIZE;
const FACE_PLANE_STEP = VOXEL_CELL_SIZE;

// Keeps a footprint edge lying on a block boundary out of the block beyond it.
const EDGE_EPSILON = 0.01;

// The deepest support any type needs (see ObjectAttachmentConfig.supportDepth): how far behind its face
// a block an object rests on can lie.
let deepestSupport: number | undefined;

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
    canPlaceObject: (room: Room, objectId: string, objectTypeIndex: number,
        transform: ObjectTransform): boolean =>
    {
        if (!ObjectAttachmentUtil.allowsFacing(objectTypeIndex, transform.dir))
            return false;
        const tr = getQuantizedTransform(objectTypeIndex, transform);
        const bounds = getFootprintBounds(objectTypeIndex, tr);

        // The whole footprint, not just its centre, since the scans below stop at the room's edge.
        // The face itself may lie on the room's floor or ceiling.
        if (bounds.min.x < 0 || bounds.max.x > MAX_ROOM_X ||
            bounds.min.y < 0 || bounds.max.y > MAX_ROOM_Y ||
            bounds.min.z < 0 || bounds.max.z > MAX_ROOM_Z)
        {
            return false;
        }

        // Every block behind it is solid, as deep as its type needs (it is supported), and at least one in
        // front is open (it is not buried).
        const voxels = room.voxelGrid.voxels;
        let supported = true;
        forEachBlockBeside(tr, bounds, -1, getSupportDepthInBlocks(objectTypeIndex, tr), (row, col, layer) => {
            supported = blockIsSolid(voxels, row, col, layer);
            return supported;
        });
        if (!supported)
            return false;
        // One that stands out from its face needs every block its body reaches open instead.
        const standOutDepth = getStandOutDepthInBlocks(objectTypeIndex, tr);
        let exposed = false;
        forEachBlockBeside(tr, bounds, 1, Math.max(1, standOutDepth), (row, col, layer) => {
            exposed = blockIsOpen(voxels, row, col, layer);
            return (standOutDepth > 0) ? exposed : !exposed;
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
    // Attached objects resting on this block, to the depth their types need (they must be refused or
    // removed along with it).
    getObjectIdsAttachedToVoxelBlock: (room: Room, quadIndex: number): string[] =>
    {
        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

        // Whatever rests on the block lies within the deepest support of it, on any side.
        const reach = getDeepestSupport();
        const nearbyVolume = PhysicsColliderStateUtil.getVoxelBlockColliderState(row, col, collisionLayer);
        nearbyVolume.hitbox.halfSize.x += reach;
        nearbyVolume.hitbox.halfSize.y += reach;
        nearbyVolume.hitbox.halfSize.z += reach;

        const objectIds: string[] = [];
        const nearbyObjects = PhysicsObjectUtil.getObjectsCollidingWith3DVolume(room.id, nearbyVolume);
        for (const nearbyObject of Object.values(nearbyObjects))
        {
            if (!ObjectTypeConfigMap.getConfigByIndex(nearbyObject.objectTypeIndex).attachment)
                continue;
            const object = room.objectById[nearbyObject.objectId];
            if (!object)
            {
                console.error(`Colliding object not found (objectId = ${nearbyObject.objectId})`);
                continue;
            }
            const tr = getQuantizedTransform(object.objectTypeIndex, object.transform);
            let restsOnIt = false;
            forEachBlockBeside(tr, getFootprintBounds(object.objectTypeIndex, tr), -1,
                getSupportDepthInBlocks(object.objectTypeIndex, tr), (supportRow, supportCol, supportLayer) => {
                    restsOnIt = supportRow == row && supportCol == col && supportLayer == collisionLayer;
                    return !restsOnIt;
                });
            if (restsOnIt)
                objectIds.push(nearbyObject.objectId);
        }
        return objectIds;
    },
    // The blocks right behind an object, which its face lies on, until visit returns false. A layer past the
    // layer range is the room's own floor or ceiling over that cell.
    forEachSupportingBlock: (objectTypeIndex: number, transform: ObjectTransform,
        visit: (row: number, col: number, collisionLayer: number) => boolean): void =>
    {
        const tr = getQuantizedTransform(objectTypeIndex, transform);
        forEachBlockBeside(tr, getFootprintBounds(objectTypeIndex, tr), -1, 1, visit);
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
        const center: Vec3 = {x: VoxelQueryUtil.getWorldXAtVoxelColCenter(col) + dims.offsetX, y: dims.offsetY,
            z: VoxelQueryUtil.getWorldZAtVoxelRowCenter(row) + dims.offsetZ};
        // Flat on its plane, as a footprint is, and as large as the face.
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
    // A transform on the placement grid, where every placement here lies (see getQuantizedTransform).
    quantize: (objectTypeIndex: number, transform: ObjectTransform): ObjectTransform =>
    {
        return getQuantizedTransform(objectTypeIndex, transform);
    },
    // The scale a resize asks for when one corner is dragged to cornerPos, with the opposite corner of anchor
    // (the object as the drag began) held still: as measured, so off the type's steps and maybe past its
    // limits. cornerSignX/Y: the dragged corner, +1 toward the face's right / up (see
    // Geometry3DUtil.getAxisFacingBasis), -1 the other way.
    getResizeScale: (objectTypeIndex: number, anchor: ObjectTransform,
        cornerSignX: number, cornerSignY: number, cornerPos: Vec3): Vec3 =>
    {
        const baseHitboxSize = ObjectTypeConfigMap.getConfigByIndex(objectTypeIndex)
            .components.spawnedByAny?.collider?.baseHitboxSize;
        if (!baseHitboxSize)
            throw new Error(`ColliderConfig not found (objectTypeIndex = ${objectTypeIndex})`);

        const {start, right, up, heldCorner} = getHeldCorner(objectTypeIndex, anchor, cornerSignX, cornerSignY);
        const toDragged = Vector3DUtil.subtract(cornerPos, heldCorner);
        return {
            x: cornerSignX * Vector3DUtil.dot(toDragged, right) / baseHitboxSize.sizeX,
            y: cornerSignY * Vector3DUtil.dot(toDragged, up) / baseHitboxSize.sizeY,
            z: start.scale.z,
        };
    },
    // The object at the nearest size its type allows to a scale, with the same corner of anchor held still. On
    // the placement grid; whether it fits there is canPlaceObject's to say.
    getResizedFromCorner: (objectTypeIndex: number, anchor: ObjectTransform,
        cornerSignX: number, cornerSignY: number, scale: Vec3): ObjectTransform =>
    {
        const {start, right, up, heldCorner} = getHeldCorner(objectTypeIndex, anchor, cornerSignX, cornerSignY);
        const size = ObjectScaleUtil.getObjectSize(objectTypeIndex, scale);
        const ideal = Vector3DUtil.add(heldCorner, Vector3DUtil.add(
            Vector3DUtil.scale(right, cornerSignX * 0.5 * size.x),
            Vector3DUtil.scale(up, cornerSignY * 0.5 * size.y)));

        // Every type's sizes come in steps of a block's width, so half of one is on the grid and the corner
        // holds exactly.
        return getQuantizedTransform(objectTypeIndex, new ObjectTransform(ideal, {...start.dir}, scale));
    },
    // Where a resize puts the object when one corner is dragged to cornerPos (see getResizeScale and
    // getResizedFromCorner). Undefined if that size doesn't fit there.
    getResizeResult: (room: Room, obj: AddObjectSignal, anchor: ObjectTransform,
        cornerSignX: number, cornerSignY: number, cornerPos: Vec3): ObjectTransform | undefined =>
    {
        const objectTypeIndex = obj.objectTypeIndex;
        const candidate = ObjectAttachmentUtil.getResizedFromCorner(objectTypeIndex, anchor, cornerSignX, cornerSignY,
            ObjectAttachmentUtil.getResizeScale(objectTypeIndex, anchor, cornerSignX, cornerSignY, cornerPos));
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
    // The object turned a quarter over where it stands (its width and height swapped), each way to try it, in
    // order: in place (see getResizedInPlace); then along the face's up, where turning it about its centre
    // puts it and a grid step to either side of that; then in place again, a grid step to either side across.
    // On the placement grid; whether each fits is canPlaceObject's to say.
    getQuarterTurnCandidates: (objectTypeIndex: number, transform: ObjectTransform): ObjectTransform[] =>
    {
        const start = getQuantizedTransform(objectTypeIndex, transform);
        const scale = {x: start.scale.y, y: start.scale.x, z: start.scale.z};
        const {right, up} = Geometry3DUtil.getAxisFacingBasis(start.dir);
        const inPlace = ObjectAttachmentUtil.getResizedInPlace(objectTypeIndex, start, scale);

        const spots: Vec3[] = [inPlace.pos];
        for (const step of [0, -GRID_STEP, GRID_STEP])
            spots.push(Vector3DUtil.add(start.pos, Vector3DUtil.scale(up, step)));
        for (const step of [-GRID_STEP, GRID_STEP])
            spots.push(Vector3DUtil.add(inPlace.pos, Vector3DUtil.scale(right, step)));

        const candidates: ObjectTransform[] = [];
        const seen = new Set<string>();
        for (const spot of spots)
        {
            const candidate = getQuantizedTransform(objectTypeIndex, new ObjectTransform(spot, {...start.dir}, {...scale}));
            const key = `${candidate.pos.x},${candidate.pos.y},${candidate.pos.z}`;
            if (!seen.has(key))
            {
                seen.add(key);
                candidates.push(candidate);
            }
        }
        return candidates;
    },
}

// The corner of anchor that a resize by the corner across from it holds still (see
// ObjectAttachmentUtil.getResizeScale), with anchor on the placement grid and its face's axes.
function getHeldCorner(objectTypeIndex: number, anchor: ObjectTransform, cornerSignX: number, cornerSignY: number):
    {start: ObjectTransform, right: Vec3, up: Vec3, heldCorner: Vec3}
{
    const start = getQuantizedTransform(objectTypeIndex, anchor);
    const startSize = ObjectScaleUtil.getObjectSize(objectTypeIndex, start.scale);
    const {right, up} = Geometry3DUtil.getAxisFacingBasis(start.dir);
    const heldCorner = Vector3DUtil.add(start.pos, Vector3DUtil.add(
        Vector3DUtil.scale(right, -cornerSignX * 0.5 * startSize.x),
        Vector3DUtil.scale(up, -cornerSignY * 0.5 * startSize.y)));
    return {start, right, up, heldCorner};
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

    // A wall's face lies on the side of a voxel; a floor's or a ceiling's lies on a whole layer.
    const snapToWallPlane = (value: number) => FACE_PLANE_STEP * Math.round(value / FACE_PLANE_STEP);

    return new ObjectTransform(
        {
            x: (normal.x != 0) ? snapToWallPlane(pos.x) : snapToGrid(pos.x),
            y: (normal.y != 0) ? COLLISION_LAYER_HEIGHT * Math.round(pos.y / COLLISION_LAYER_HEIGHT)
                : snapToGrid(pos.y - halfHeight) + halfHeight,
            z: (normal.z != 0) ? snapToWallPlane(pos.z) : snapToGrid(pos.z),
        },
        normal, scale);
}

// How many blocks deep behind its face an object of this type needs solid: one, or as many as its type's
// support depth comes to along the facing.
function getSupportDepthInBlocks(objectTypeIndex: number, tr: ObjectTransform): number
{
    const supportDepth = ObjectTypeConfigMap.getConfigByIndex(objectTypeIndex).attachment?.supportDepth ?? 0;
    const {normal} = Geometry3DUtil.getAxisFacingBasis(tr.dir);
    return Math.max(1, Math.ceil(supportDepth / ((normal.y != 0) ? COLLISION_LAYER_HEIGHT : VOXEL_CELL_SIZE)));
}

// How many blocks deep in front of its face an object reaches, if its type stands out from it (see
// ObjectAttachmentConfig.standsOut); none for one that lies flat.
function getStandOutDepthInBlocks(objectTypeIndex: number, tr: ObjectTransform): number
{
    if (!ObjectTypeConfigMap.getConfigByIndex(objectTypeIndex).attachment?.standsOut)
        return 0;
    const depth = ObjectScaleUtil.getObjectSize(objectTypeIndex, tr.scale).z;
    const {normal} = Geometry3DUtil.getAxisFacingBasis(tr.dir);
    return Math.ceil(depth / ((normal.y != 0) ? COLLISION_LAYER_HEIGHT : VOXEL_CELL_SIZE) - EDGE_EPSILON);
}

function getDeepestSupport(): number
{
    deepestSupport ??= Math.max(0, ...ObjectTypeConfigMap.getAllConfigs()
        .map(config => config.attachment?.supportDepth ?? 0));
    return deepestSupport;
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

// Visits the cell layers to the given side of the face (+1: in front, -1: behind) across the footprint,
// as many deep as asked, until visit returns false. Coordinates are unclamped, so cell layers beyond the
// room are visited too.
function forEachBlockBeside(tr: ObjectTransform, bounds: {min: Vec3, max: Vec3}, side: number, depth: number,
    visit: (row: number, col: number, layer: number) => boolean): void
{
    const {normal} = Geometry3DUtil.getAxisFacingBasis(tr.dir);
    const range = (toIndex: (v: number) => number, facing: number, pos: number, min: number, max: number) =>
    {
        if (facing == 0)
            return {first: toIndex(min + EDGE_EPSILON), last: toIndex(max - EDGE_EPSILON)};
        const nearest = toIndex(pos + side * facing * EDGE_EPSILON);
        const furthest = nearest + side * facing * (depth - 1);
        return {first: Math.min(nearest, furthest), last: Math.max(nearest, furthest)};
    };

    const cols = range(VoxelQueryUtil.getVoxelColFromWorldX, normal.x, tr.pos.x, bounds.min.x, bounds.max.x);
    const layers = range(VoxelQueryUtil.getVoxelCollisionLayerFromWorldY, normal.y, tr.pos.y,
        bounds.min.y, bounds.max.y);
    const rows = range(VoxelQueryUtil.getVoxelRowFromWorldZ, normal.z, tr.pos.z, bounds.min.z, bounds.max.z);

    for (let row = rows.first; row <= rows.last; ++row)
    {
        for (let col = cols.first; col <= cols.last; ++col)
        {
            for (let layer = layers.first; layer <= layers.last; ++layer)
            {
                if (!visit(row, col, layer))
                    return;
            }
        }
    }
}

// Whether every cell layer in front of a (quantized) placement is open, not just one.
function faceIsClear(voxels: Voxel[], objectTypeIndex: number, tr: ObjectTransform): boolean
{
    let clear = true;
    forEachBlockBeside(tr, getFootprintBounds(objectTypeIndex, tr), 1, 1, (row, col, layer) => {
        clear = blockIsOpen(voxels, row, col, layer);
        return clear;
    });
    return clear;
}

// Whether a cell layer holds a block. Beyond the layer range is the room's own floor or ceiling; beyond
// the grid is nothing to rest on.
function blockIsSolid(voxels: Voxel[], row: number, col: number, layer: number): boolean
{
    const voxel = VoxelQueryUtil.getVoxel(voxels, row, col);
    return voxel != undefined && VoxelQueryUtil.isVoxelBlockPresent(voxel, layer);
}

// Inside the room and holding no block.
function blockIsOpen(voxels: Voxel[], row: number, col: number, layer: number): boolean
{
    const voxel = VoxelQueryUtil.getVoxel(voxels, row, col);
    return voxel != undefined && !VoxelQueryUtil.isVoxelBlockPresent(voxel, layer);
}

function snapToGrid(value: number): number
{
    return GRID_STEP * Math.round(value / GRID_STEP);
}

export default ObjectAttachmentUtil;
