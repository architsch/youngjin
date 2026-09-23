import Vec3 from "../../math/types/vec3";
import Geometry3DUtil from "../../math/util/geometry3DUtil";
import Vector3DUtil from "../../math/util/vector3DUtil";
import PhysicsColliderStateUtil from "../../physics/util/physicsColliderStateUtil";
import PhysicsObjectUtil from "../../physics/util/physicsObjectUtil";
import Room from "../../room/types/room";
import { COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, MAX_ROOM_Y, NUM_VOXEL_COLS,
    NUM_VOXEL_ROWS } from "../../system/sharedConstants";
import VoxelQueryUtil from "../../voxel/util/voxelQueryUtil";
import Voxel from "../../voxel/types/voxel";
import AddObjectSignal from "../types/addObjectSignal";
import ObjectTransform from "../types/objectTransform";
import ObjectTypeConfigMap from "../maps/objectTypeConfigMap";
import ObjectScaleUtil from "./objectScaleUtil";

// Placement of objects attached to a voxel face (see @docs/geometry/object_attachment.md). Positions snap
// to half a voxel on X/Z and to one collision layer on Y, which is the same distance.
const GRID_STEP = COLLISION_LAYER_HEIGHT;

// Keeps a footprint edge lying on a block boundary out of the block beyond it.
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
    canPlaceObject: (room: Room, objectId: string, objectTypeIndex: number,
        transform: ObjectTransform): boolean =>
    {
        if (!ObjectAttachmentUtil.allowsFacing(objectTypeIndex, transform.dir))
            return false;
        const tr = getQuantizedTransform(objectTypeIndex, transform);
        const bounds = getFootprintBounds(objectTypeIndex, tr);

        // The whole footprint, not just its centre, since the block scans below stop at the room's edge.
        // The face itself may lie on the room's floor or ceiling.
        if (bounds.min.x < 0 || bounds.max.x > NUM_VOXEL_COLS ||
            bounds.min.y < 0 || bounds.max.y > MAX_ROOM_Y ||
            bounds.min.z < 0 || bounds.max.z > NUM_VOXEL_ROWS)
        {
            return false;
        }

        // Every block behind it is solid (it is supported), and at least one in front is open (it is not
        // buried).
        const voxels = room.voxelGrid.voxels;
        let supported = true;
        forEachBlockBeside(tr, bounds, -1, (row, col, layer) => {
            supported = blockIsSolid(voxels, row, col, layer);
            return supported;
        });
        if (!supported)
            return false;
        let exposed = false;
        forEachBlockBeside(tr, bounds, 1, (row, col, layer) => {
            exposed = blockIsOpen(voxels, row, col, layer);
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
        const voxelPos: Vec3 = {x: col + 0.5, y: 0.25 + collisionLayer*0.5, z: row + 0.5};

        const objectIds: string[] = [];
        const voxelBlockColliderState = PhysicsColliderStateUtil.getVoxelBlockColliderState(row, col, collisionLayer);
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
    // allows, with the opposite corner of anchor (the object as the drag began) held still. Centres sit on
    // a half-voxel grid along X and Z, so there an odd number of half-steps can hold that corner only to
    // within a quarter voxel; it gives way toward the dragged side, or behind when only that fits. Undefined
    // if that size fits no way. cornerSignX/Y: the dragged corner, +1 toward the face's right / up (see
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

        // Per axis of the face, where its centre may go. Along Y the bottom edge snaps instead, and heights
        // are whole layers, so it holds exactly. Both roundings coincide when the corner can be held.
        const candidatesAlong = (axis: Vec3, cornerSign: number): {component: "x" | "y" | "z", values: number[]} =>
        {
            const component = (axis.x != 0) ? "x" : (axis.y != 0) ? "y" : "z";
            if (component == "y")
                return {component, values: [ideal.y]};
            const outward = cornerSign * axis[component];
            return {component, values: [snapToGridToward(ideal[component], outward),
                snapToGridToward(ideal[component], -outward)]};
        };
        const alongRight = candidatesAlong(right, cornerSignX);
        const alongUp = candidatesAlong(up, cornerSignY);
        for (const u of alongUp.values)
        {
            for (const r of alongRight.values)
            {
                const pos = {...ideal};
                pos[alongRight.component] = r;
                pos[alongUp.component] = u;
                const candidate = getQuantizedTransform(objectTypeIndex,
                    new ObjectTransform(pos, {...start.dir}, scale));
                if (ObjectAttachmentUtil.canPlaceObject(room, obj.objectId, objectTypeIndex, candidate))
                    return candidate;
            }
        }
        return undefined;
    },
}

// Onto the placement grid: the face on its plane, the centre on the grid along X and Z, and the bottom edge
// on it along Y (snapping the centre would float odd-height objects off the floor). The facing snaps onto
// its axis and the scale onto its steps, since both decide where the edges are.
function getQuantizedTransform(objectTypeIndex: number, transform: ObjectTransform): ObjectTransform
{
    const scale = ObjectScaleUtil.sanitize(objectTypeIndex, transform.scale);
    const {normal, right, up} = Geometry3DUtil.getAxisFacingBasis(transform.dir);
    const size = ObjectScaleUtil.getObjectSize(objectTypeIndex, scale);
    const halfHeight = 0.5 * (Math.abs(right.y) * size.x + Math.abs(up.y) * size.y);
    const pos = transform.pos;

    return new ObjectTransform(
        {
            // Walls stand on whole cells, floors and ceilings on whole layers.
            x: (normal.x != 0) ? Math.round(pos.x) : snapToGrid(pos.x),
            y: (normal.y != 0) ? snapToGrid(pos.y) : snapToGrid(pos.y - halfHeight) + halfHeight,
            z: (normal.z != 0) ? Math.round(pos.z) : snapToGrid(pos.z),
        },
        normal, scale);
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

// Visits the blocks one step to the given side of the face (+1: in front, -1: behind) across the footprint,
// until visit returns false. Coordinates are unclamped, so blocks beyond the room are visited too.
function forEachBlockBeside(tr: ObjectTransform, bounds: {min: Vec3, max: Vec3}, side: number,
    visit: (row: number, col: number, layer: number) => boolean): void
{
    const {normal} = Geometry3DUtil.getAxisFacingBasis(tr.dir);
    const reach = side * EDGE_EPSILON;
    const range = (toIndex: (v: number) => number, facing: number, pos: number, min: number, max: number) =>
        (facing != 0)
            ? {first: toIndex(pos + reach * facing), last: toIndex(pos + reach * facing)}
            : {first: toIndex(min + EDGE_EPSILON), last: toIndex(max - EDGE_EPSILON)};

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

// Whether every block in front of a (quantized) placement is open, not just one.
function faceIsClear(voxels: Voxel[], objectTypeIndex: number, tr: ObjectTransform): boolean
{
    let clear = true;
    forEachBlockBeside(tr, getFootprintBounds(objectTypeIndex, tr), 1, (row, col, layer) => {
        clear = blockIsOpen(voxels, row, col, layer);
        return clear;
    });
    return clear;
}

// Beyond the layer range is the room's own floor or ceiling; beyond the grid is nothing to rest on.
function blockIsSolid(voxels: Voxel[], row: number, col: number, layer: number): boolean
{
    const voxel = VoxelQueryUtil.getVoxel(voxels, row, col);
    if (!voxel)
        return false;
    if (layer < COLLISION_LAYER_MIN || layer > COLLISION_LAYER_MAX)
        return true;
    return VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, layer);
}

// Inside the room and empty.
function blockIsOpen(voxels: Voxel[], row: number, col: number, layer: number): boolean
{
    const voxel = VoxelQueryUtil.getVoxel(voxels, row, col);
    if (!voxel || layer < COLLISION_LAYER_MIN || layer > COLLISION_LAYER_MAX)
        return false;
    return !VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, layer);
}

function snapToGrid(value: number): number
{
    return GRID_STEP * Math.round(value / GRID_STEP);
}

// Onto the grid, rounding toward direction's side. The allowance keeps a value that is already on the grid,
// give or take float error, where it is.
function snapToGridToward(value: number, direction: number): number
{
    return GRID_STEP * (direction > 0
        ? Math.ceil(value / GRID_STEP - 1e-6) : Math.floor(value / GRID_STEP + 1e-6));
}

export default ObjectAttachmentUtil;
