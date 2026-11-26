import AABB3 from "../../math/types/aabb3";
import Vec3 from "../../math/types/vec3";
import Geometry3DUtil from "../../math/util/geometry3DUtil";
import Vector3DUtil from "../../math/util/vector3DUtil";
import Room from "../../room/types/room";
import { COLLISION_LAYER_HEIGHT, NUM_COLLISION_LAYERS, NUM_VOXEL_COLS, NUM_VOXEL_ROWS, UNIT_VEC3,
    VOXEL_CELL_SIZE } from "../../system/sharedConstants";
import Voxel from "../../voxel/types/voxel";
import VoxelVertex from "../../voxel/types/voxelVertex";
import VoxelPathUtil from "../../voxel/util/voxelPathUtil";
import VoxelQueryUtil from "../../voxel/util/voxelQueryUtil";
import ObjectTypeConfigMap from "../maps/objectTypeConfigMap";
import AddObjectSignal from "../types/addObjectSignal";
import ObjectTransform from "../types/objectTransform";
import DoorObjectTypeConfig, { ENTERING_STRIDE_LENGTH,
    SPAWN_DIST_BEHIND_DOOR } from "../types/objectTypeConfig/doorObjectTypeConfig";
import { PLAYER_HEIGHT, PLAYER_RADIUS_XZ } from "../types/objectTypeConfig/playerObjectTypeConfig";
import ObjectObstacleUtil from "./objectObstacleUtil";

// How far from where a door puts its arrivals a player still stands there: more than a stored position is off by (see
// ObjectTransform).
const AT_DOOR_DISTANCE = 0.01;
// How far off the line of a walk out of a door a player on it may be: bodies in the doorway push one another a little.
const ON_WALK_DISTANCE = 0.3;
// A body that only touches a block isn't in it.
const CLEARANCE_MARGIN = 0.01;
const BODY_HALF_SIZE: Vec3 = {x: PLAYER_RADIUS_XZ - CLEARANCE_MARGIN, y: 0.5 * PLAYER_HEIGHT - CLEARANCE_MARGIN,
    z: PLAYER_RADIUS_XZ - CLEARANCE_MARGIN};
// Enough shells to reach every vertex of the room from any other.
const MAX_SEARCH_RADIUS = Math.max(NUM_VOXEL_ROWS, NUM_VOXEL_COLS, NUM_COLLISION_LAYERS);

const doorTypeIndex = ObjectTypeConfigMap.getIndexByType("Door");

// Where a player arriving through a door is put (see SpawnHotspotUtil): behind it, facing into the room, to walk out
// in front of it (see PlayerController, AgentBodyUtil). Where blocks or what is as solid fill the place that walk ends
// in, it would never get there, so the player is put instead on the nearest spot in front of the door where a body
// stands clear, and walks nowhere.
const DoorEntranceUtil =
{
    getArrivalTransform: (room: Room, door: AddObjectSignal): ObjectTransform =>
    {
        const behind = getTransformBehind(door);
        if (isBodyClear(room, getWalkEnd(door)))
            return behind;
        const spot = findOpenSpot(room, door);
        return (spot == undefined) ? behind : new ObjectTransform(spot, behind.dir, {...UNIT_VEC3});
    },
    // The door a player stands behind, put there to walk out of it; undefined for one put down anywhere else.
    findDoorBehind: (room: Room, pos: Vec3): AddObjectSignal | undefined =>
    {
        return Object.values(room.objectById).find(obj => obj.objectTypeIndex == doorTypeIndex
            && Vector3DUtil.distSqr(getTransformBehind(obj).pos, pos) < AT_DOOR_DISTANCE * AT_DOOR_DISTANCE);
    },
    // The walk out of a door that a player put down behind it makes, as their middle goes, wherever along it they are
    // by now (whoever asks may come to it late); undefined for one who is on no such walk.
    getWalk: (room: Room, pos: Vec3): {from: Vec3, to: Vec3} | undefined =>
    {
        let nearest: {from: Vec3, to: Vec3, distance: number} | undefined = undefined;
        for (const obj of Object.values(room.objectById))
        {
            if (obj.objectTypeIndex != doorTypeIndex)
                continue;
            const from = getTransformBehind(obj).pos;
            const to = getWalkEnd(obj);
            const distance = getDistanceToSegment(pos, from, to);
            if (distance <= ON_WALK_DISTANCE && (nearest == undefined || distance < nearest.distance))
                nearest = {from, to, distance};
        }
        return (nearest == undefined) ? undefined : {from: nearest.from, to: nearest.to};
    },
}

// Behind the door's face, on its floor, facing into the room. Door and player origins are at mid-height; the player's
// transform direction points behind them (see PlayerProximityDetector), hence the flip.
function getTransformBehind(door: AddObjectSignal): ObjectTransform
{
    const {pos, dir} = door.transform;
    const floorY = DoorObjectTypeConfig.util.getFloorY(door);
    return new ObjectTransform(
        {x: pos.x - dir.x * SPAWN_DIST_BEHIND_DOOR, y: floorY + 0.5 * PLAYER_HEIGHT, z: pos.z - dir.z * SPAWN_DIST_BEHIND_DOOR},
        {x: -dir.x, y: 0, z: -dir.z}, {...UNIT_VEC3});
}

function getDistanceToSegment(pos: Vec3, from: Vec3, to: Vec3): number
{
    const along = Vector3DUtil.subtract(to, from);
    const lengthSqr = Vector3DUtil.dot(along, along);
    const share = (lengthSqr < 1e-9) ? 0
        : Math.min(1, Math.max(0, Vector3DUtil.dot(Vector3DUtil.subtract(pos, from), along) / lengthSqr));
    return Math.sqrt(Vector3DUtil.distSqr(pos, Vector3DUtil.add(from, Vector3DUtil.scale(along, share))));
}

// Where the middle of a body walking out of the door gets to.
function getWalkEnd(door: AddObjectSignal): Vec3
{
    return Vector3DUtil.add(getTransformBehind(door).pos, Vector3DUtil.scale(getInward(door), ENTERING_STRIDE_LENGTH));
}

function getInward(door: AddObjectSignal): Vec3
{
    return Geometry3DUtil.getAxisFacingBasis(door.transform.dir).normal;
}

// Whether a body with its middle there meets no block, nor anything as solid.
function isBodyClear(room: Room, center: Vec3): boolean
{
    const box: AABB3 = {center, halfSize: BODY_HALF_SIZE};
    return !meetsBlock(room.voxelGrid.voxels, box) && ObjectObstacleUtil.isBoxClear(room.objectById, box);
}

// Whether a box reaches into a block, or past the room's sides, floor or ceiling, which count as blocks (see
// VoxelQueryUtil).
function meetsBlock(voxels: Voxel[], box: AABB3): boolean
{
    const {center, halfSize} = box;
    const lastRow = VoxelQueryUtil.getVoxelRowFromWorldZ(center.z + halfSize.z);
    const lastCol = VoxelQueryUtil.getVoxelColFromWorldX(center.x + halfSize.x);
    const lastLayer = VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(center.y + halfSize.y);
    for (let row = VoxelQueryUtil.getVoxelRowFromWorldZ(center.z - halfSize.z); row <= lastRow; ++row)
    {
        for (let col = VoxelQueryUtil.getVoxelColFromWorldX(center.x - halfSize.x); col <= lastCol; ++col)
        {
            for (let layer = VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(center.y - halfSize.y); layer <= lastLayer; ++layer)
            {
                if (VoxelQueryUtil.isVoxelBlockPresentAt(voxels, row, col, layer))
                    return true;
            }
        }
    }
    return false;
}

// The middle of a body standing on the vertex nearest where the walk out of the door ends that is clear of blocks and of
// what is as solid, with the body wholly in front of the door; failing that, anywhere in the room. Undefined in a room
// with no such vertex at all.
function findOpenSpot(room: Room, door: AddObjectSignal): Vec3 | undefined
{
    const voxels = room.voxelGrid.voxels;
    const end = VoxelPathUtil.feetOf(getWalkEnd(door));
    const face = door.transform.pos;
    const inward = getInward(door);
    const isOpen = ObjectObstacleUtil.getClearance(room.objectById);
    const inFront = (vertex: VoxelVertex) =>
        Vector3DUtil.dot(Vector3DUtil.subtract(VoxelPathUtil.toWorld(vertex), face), inward) >= PLAYER_RADIUS_XZ;
    const vertex = findNearestStandable(voxels, end, vertex => inFront(vertex) && isOpen(vertex))
        ?? findNearestStandable(voxels, end, isOpen);
    if (vertex == undefined)
        return undefined;
    const feet = VoxelPathUtil.toWorld(vertex);
    return {x: feet.x, y: feet.y + 0.5 * PLAYER_HEIGHT, z: feet.z};
}

// The standable vertex nearest a point that `accepts`, searched shell by shell outward from the vertex nearest the point,
// until no shell left could hold a nearer one.
function findNearestStandable(voxels: Voxel[], point: Vec3,
    accepts: (vertex: VoxelVertex) => boolean): VoxelVertex | undefined
{
    const from: VoxelVertex = {row: Math.round(point.z / VOXEL_CELL_SIZE), col: Math.round(point.x / VOXEL_CELL_SIZE),
        layer: Math.round(point.y / COLLISION_LAYER_HEIGHT)};
    const step = Math.min(VOXEL_CELL_SIZE, COLLISION_LAYER_HEIGHT);
    let best: VoxelVertex | undefined = undefined;
    let bestDistanceSqr = Infinity;
    const consider = (row: number, col: number, layer: number) => {
        const vertex = {row, col, layer};
        const distanceSqr = Vector3DUtil.distSqr(VoxelPathUtil.toWorld(vertex), point);
        if (distanceSqr < bestDistanceSqr && VoxelPathUtil.isStandable(voxels, vertex) && accepts(vertex))
        {
            best = vertex;
            bestDistanceSqr = distanceSqr;
        }
    };

    for (let radius = 0; radius <= MAX_SEARCH_RADIUS; ++radius)
    {
        // The point lies within half a step of the shells' middle along each axis.
        const nearest = (radius - 0.5) * step;
        if (nearest > 0 && nearest * nearest > bestDistanceSqr)
            break;
        // Vertices on the room's outer edge have a voxel outside it under them, and never stand clear.
        const firstCol = Math.max(1, from.col - radius);
        const lastCol = Math.min(NUM_VOXEL_COLS - 1, from.col + radius);
        for (let layer = Math.max(0, from.layer - radius); layer <= Math.min(NUM_COLLISION_LAYERS - 1, from.layer + radius); ++layer)
        {
            const onCap = Math.abs(layer - from.layer) == radius;
            for (let row = Math.max(1, from.row - radius); row <= Math.min(NUM_VOXEL_ROWS - 1, from.row + radius); ++row)
            {
                if (onCap || Math.abs(row - from.row) == radius)
                {
                    for (let col = firstCol; col <= lastCol; ++col)
                        consider(row, col, layer);
                }
                else
                {
                    if (from.col - radius >= firstCol)
                        consider(row, from.col - radius, layer);
                    if (from.col + radius <= lastCol)
                        consider(row, from.col + radius, layer);
                }
            }
        }
    }
    return best;
}

export default DoorEntranceUtil;
