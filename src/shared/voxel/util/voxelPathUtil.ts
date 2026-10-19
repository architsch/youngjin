import Vec3 from "../../math/types/vec3";
import Voxel from "../types/voxel";
import VoxelVertex from "../types/voxelVertex";
import VoxelQueryUtil from "./voxelQueryUtil";
import { COLLISION_LAYER_HEIGHT, NUM_VOXEL_COLS, NUM_VOXEL_ROWS, VOXEL_CELL_SIZE } from "../../system/sharedConstants";
import { PLAYER_HEIGHT, PLAYER_RADIUS_XZ } from "../../object/types/objectTypeConfig/playerObjectTypeConfig";

// Walking paths for a player's body over the voxel grid, by A*. A path runs between grid vertices: a body narrower
// than two voxels, standing on one, covers exactly the four voxels around it, so it passes wherever a person could,
// through a corridor two voxels wide. Only blocks count; objects on the way are left to the physics.

if (PLAYER_RADIUS_XZ >= VOXEL_CELL_SIZE)
    throw new Error("VoxelPathUtil assumes a player narrower than two voxels");

const BODY_LAYERS = Math.ceil(PLAYER_HEIGHT / COLLISION_LAYER_HEIGHT);
// One layer is the most a walking body climbs (see ColliderConfig.maxClimbableHeight); a fall can be deeper.
const MAX_DROP_LAYERS = 8;
// Bounds a search in a room with no way through, which would otherwise visit every vertex.
const MAX_EXPANSIONS = 40_000;
const NUM_VERTEX_ROWS = NUM_VOXEL_ROWS + 1;
const NUM_VERTEX_COLS = NUM_VOXEL_COLS + 1;

const DIRECTIONS: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];

const VoxelPathUtil =
{
    // Whether a body can stand on the vertex: the four voxels around it clear for its whole height, and a block
    // (or the room's floor) under at least one of them.
    isStandable: (voxels: Voxel[], vertex: VoxelVertex): boolean =>
    {
        return isClear(voxels, vertex.row, vertex.col, vertex.layer, vertex.layer + BODY_LAYERS - 1)
            && isSupported(voxels, vertex.row, vertex.col, vertex.layer);
    },
    // Where a body stands on the vertex, its feet on the layer's bottom.
    toWorld: (vertex: VoxelVertex): Vec3 =>
    {
        return {x: vertex.col * VOXEL_CELL_SIZE, y: vertex.layer * COLLISION_LAYER_HEIGHT, z: vertex.row * VOXEL_CELL_SIZE};
    },
    // A standing player's feet, from its position, which is at its middle (see SpawnHotspotUtil).
    feetOf: (playerPos: Vec3): Vec3 =>
    {
        return {x: playerPos.x, y: playerPos.y - 0.5 * PLAYER_HEIGHT, z: playerPos.z};
    },
    // The standable vertex nearest a body's feet, searched out to maxRadius vertices and layers; undefined if none.
    findStandingVertexNear: (voxels: Voxel[], feet: Vec3, maxRadius: number = 3): VoxelVertex | undefined =>
    {
        const row = Math.round(feet.z / VOXEL_CELL_SIZE);
        const col = Math.round(feet.x / VOXEL_CELL_SIZE);
        const layer = Math.round(feet.y / COLLISION_LAYER_HEIGHT);
        let best: VoxelVertex | undefined = undefined;
        let bestDistance = Infinity;
        for (let dl = -maxRadius; dl <= maxRadius; ++dl)
        {
            for (let dr = -maxRadius; dr <= maxRadius; ++dr)
            {
                for (let dc = -maxRadius; dc <= maxRadius; ++dc)
                {
                    const vertex = {row: row + dr, col: col + dc, layer: layer + dl};
                    const distance = dr * dr + dc * dc + dl * dl;
                    if (distance < bestDistance && VoxelPathUtil.isStandable(voxels, vertex))
                    {
                        best = vertex;
                        bestDistance = distance;
                    }
                }
            }
        }
        return best;
    },
    // The vertices from start to goal, both included, with straight runs reduced to their ends; undefined if the
    // goal can't be reached (or not within the search's bound).
    findPath: (voxels: Voxel[], start: VoxelVertex, goal: VoxelVertex): VoxelVertex[] | undefined =>
    {
        if (!VoxelPathUtil.isStandable(voxels, start) || !VoxelPathUtil.isStandable(voxels, goal))
            return undefined;

        const startKey = toKey(start);
        const goalKey = toKey(goal);
        const costSoFar = new Map<number, number>([[startKey, 0]]);
        const cameFrom = new Map<number, number>();
        const open: {key: number, priority: number}[] = [];
        heapPush(open, {key: startKey, priority: heuristic(start, goal)});

        let expansions = 0;
        while (open.length > 0 && expansions++ < MAX_EXPANSIONS)
        {
            const currentKey = heapPop(open).key;
            if (currentKey == goalKey)
                return simplify(rebuildPath(cameFrom, goalKey));

            const current = fromKey(currentKey);
            const currentCost = costSoFar.get(currentKey)!;
            for (const [dr, dc] of DIRECTIONS)
            {
                const next = findStep(voxels, current, dr, dc);
                if (next == undefined)
                    continue;

                const stepCost = ((dr != 0 && dc != 0) ? Math.SQRT2 : 1)
                    + (next.layer > current.layer ? 0.5 : 0.25 * (current.layer - next.layer));
                const nextKey = toKey(next);
                const nextCost = currentCost + stepCost;
                if (nextCost < (costSoFar.get(nextKey) ?? Infinity))
                {
                    costSoFar.set(nextKey, nextCost);
                    cameFrom.set(nextKey, currentKey);
                    heapPush(open, {key: nextKey, priority: nextCost + heuristic(next, goal)});
                }
            }
        }
        return undefined;
    },
}

// Where a step from the vertex in a direction lands: on the same layer, else one up, else the highest of a few
// below (a fall). A diagonal step also needs both vertices beside it clear, so no corner is cut.
function findStep(voxels: Voxel[], from: VoxelVertex, dr: number, dc: number): VoxelVertex | undefined
{
    const row = from.row + dr;
    const col = from.col + dc;
    if (row < 1 || row >= NUM_VERTEX_ROWS - 1 || col < 1 || col >= NUM_VERTEX_COLS - 1)
        return undefined;

    let layer: number | undefined = undefined;
    if (VoxelPathUtil.isStandable(voxels, {row, col, layer: from.layer}))
        layer = from.layer;
    // Climbing needs the head room above where the body is.
    else if (VoxelPathUtil.isStandable(voxels, {row, col, layer: from.layer + 1})
        && isClear(voxels, from.row, from.col, from.layer + BODY_LAYERS, from.layer + BODY_LAYERS))
        layer = from.layer + 1;
    else
    {
        for (let below = from.layer - 1; below >= Math.max(0, from.layer - MAX_DROP_LAYERS); --below)
        {
            // The body passes down through everything over where it lands.
            if (!isClear(voxels, row, col, below, from.layer + BODY_LAYERS - 1))
                break;
            if (isSupported(voxels, row, col, below))
            {
                layer = below;
                break;
            }
        }
    }
    if (layer == undefined)
        return undefined;

    if (dr != 0 && dc != 0)
    {
        const low = Math.min(from.layer, layer);
        const high = Math.max(from.layer, layer) + BODY_LAYERS - 1;
        if (!isClear(voxels, from.row + dr, from.col, low, high) || !isClear(voxels, from.row, from.col + dc, low, high))
            return undefined;
    }
    return {row, col, layer};
}

// Whether the four voxels around the vertex hold no block from one layer to another, both included. Outside the grid
// and its layers counts as solid (see VoxelQueryUtil).
function isClear(voxels: Voxel[], row: number, col: number, fromLayer: number, toLayer: number): boolean
{
    for (let layer = fromLayer; layer <= toLayer; ++layer)
    {
        if (VoxelQueryUtil.isVoxelBlockPresentAt(voxels, row - 1, col - 1, layer)
            || VoxelQueryUtil.isVoxelBlockPresentAt(voxels, row - 1, col, layer)
            || VoxelQueryUtil.isVoxelBlockPresentAt(voxels, row, col - 1, layer)
            || VoxelQueryUtil.isVoxelBlockPresentAt(voxels, row, col, layer))
            return false;
    }
    return true;
}

// Whether something is under any of the four voxels around the vertex: a block, or the room's floor (the layer below
// the lowest counts as solid).
function isSupported(voxels: Voxel[], row: number, col: number, layer: number): boolean
{
    return VoxelQueryUtil.isVoxelBlockPresentAt(voxels, row - 1, col - 1, layer - 1)
        || VoxelQueryUtil.isVoxelBlockPresentAt(voxels, row - 1, col, layer - 1)
        || VoxelQueryUtil.isVoxelBlockPresentAt(voxels, row, col - 1, layer - 1)
        || VoxelQueryUtil.isVoxelBlockPresentAt(voxels, row, col, layer - 1);
}

// The octile distance over the floor plan, which no path can beat.
function heuristic(a: VoxelVertex, b: VoxelVertex): number
{
    const dr = Math.abs(a.row - b.row);
    const dc = Math.abs(a.col - b.col);
    return Math.max(dr, dc) + (Math.SQRT2 - 1) * Math.min(dr, dc);
}

function toKey(vertex: VoxelVertex): number
{
    return (vertex.layer * NUM_VERTEX_ROWS + vertex.row) * NUM_VERTEX_COLS + vertex.col;
}

function fromKey(key: number): VoxelVertex
{
    return {
        col: key % NUM_VERTEX_COLS,
        row: Math.floor(key / NUM_VERTEX_COLS) % NUM_VERTEX_ROWS,
        layer: Math.floor(key / (NUM_VERTEX_COLS * NUM_VERTEX_ROWS)),
    };
}

function rebuildPath(cameFrom: Map<number, number>, goalKey: number): VoxelVertex[]
{
    const keys = [goalKey];
    while (cameFrom.has(keys[keys.length - 1]))
        keys.push(cameFrom.get(keys[keys.length - 1])!);
    return keys.reverse().map(fromKey);
}

// Keeps the ends of each straight run on one layer, which is all a walker steering between them needs.
function simplify(path: VoxelVertex[]): VoxelVertex[]
{
    if (path.length <= 2)
        return path;
    const kept = [path[0]];
    for (let i = 1; i < path.length - 1; ++i)
    {
        const prev = path[i - 1], here = path[i], next = path[i + 1];
        const straight = here.row - prev.row == next.row - here.row && here.col - prev.col == next.col - here.col
            && prev.layer == here.layer && here.layer == next.layer;
        if (!straight)
            kept.push(here);
    }
    kept.push(path[path.length - 1]);
    return kept;
}

// A binary min-heap on priority, as plain functions over an array.
function heapPush(heap: {key: number, priority: number}[], item: {key: number, priority: number}): void
{
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0)
    {
        const parent = (i - 1) >> 1;
        if (heap[parent].priority <= heap[i].priority)
            break;
        [heap[parent], heap[i]] = [heap[i], heap[parent]];
        i = parent;
    }
}

function heapPop(heap: {key: number, priority: number}[]): {key: number, priority: number}
{
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0)
    {
        heap[0] = last;
        let i = 0;
        while (true)
        {
            const left = 2 * i + 1, right = left + 1;
            let smallest = i;
            if (left < heap.length && heap[left].priority < heap[smallest].priority)
                smallest = left;
            if (right < heap.length && heap[right].priority < heap[smallest].priority)
                smallest = right;
            if (smallest == i)
                break;
            [heap[smallest], heap[i]] = [heap[i], heap[smallest]];
            i = smallest;
        }
    }
    return top;
}

export default VoxelPathUtil;
