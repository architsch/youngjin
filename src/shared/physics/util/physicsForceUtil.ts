import AABB3 from "../../math/types/aabb3";
import Vec3 from "../../math/types/vec3";
import Geometry3DUtil from "../../math/util/geometry3DUtil";
import Vector3DUtil from "../../math/util/vector3DUtil";
import ObjectTypeConfigMap from "../../object/maps/objectTypeConfigMap";
import ObjectScaleUtil from "../../object/util/objectScaleUtil";
import VoxelQueryUtil from "../../voxel/util/voxelQueryUtil";
import { COLLISION_LAYER_HEIGHT, GRAVITY_SPEED, VOXEL_CELL_SIZE } from "../../system/sharedConstants";
// Type-only: an emitter is read from the room as it stands.
import type AddObjectSignal from "../../object/types/addObjectSignal";
import type Room from "../../room/types/room";
import PhysicsObject from "../types/physicsObject";
import PhysicsRoom from "../types/physicsRoom";
import PhysicsColliderStateUtil from "./physicsColliderStateUtil";

// In front of an emitter's face by more than its stored position can be off by (see ObjectTransform).
const FACE_CLEARANCE = 0.01;
// How much of a body a stream must reach to push it in full, as a share of the most it could reach; short of that,
// it pushes by as much less.
const FULL_EXPOSURE = 0.5;

// How fast gravity takes away the upward velocity a body carries, in world units per second, each second. A body
// carrying none falls at GRAVITY_SPEED as ever, and none ever falls faster for this.
const GRAVITY_PULL = 30;
// The share of whatever else a body carries that drag takes away, each second.
const DRAG = 4;
// A stream's push thins out over this much room: the last a body has before something solid ahead of it.
const CUSHION_LENGTH = 1;
// Nearer to something solid than this, a body is against it.
const CONTACT_DISTANCE = 0.02;
// How far in from a body's sides that room is looked for, so that what it brushes past is not taken to be ahead.
const PROBE_INSET = 0.05;
// A carried velocity slower than this, with nothing pushing, is forgotten.
const MIN_CARRIED_SPEED = 0.01;

const UP: Vec3 = {x: 0, y: 1, z: 0};
const DOWN: Vec3 = {x: 0, y: -1, z: 0};

// The forces objects exert from afar (see ObjectForceConfig). An emitter's stream leaves its face along its facing,
// as wide as its footprint, and ends at its range; a block in it stops only the part of it the block lies across.
// It speeds up a body by as much of the body as it reaches: hardest at its face, by nothing at the end of its range.
// The body keeps the velocity it is given (see PhysicsObject) until gravity and drag have taken it away again.
//
// A stream blowing upward makes up for gravity too, by the same measure. So a body over one is thrown up, falls
// back where the push has thinned out, and goes on bouncing: gravity itself is never switched off.
//
// An emitter is read from the room each time, so a move or a new setting takes effect at once.
const PhysicsForceUtil =
{
    emitsForce: (objectTypeIndex: number): boolean =>
    {
        return ObjectTypeConfigMap.getConfigByIndex(objectTypeIndex).force != undefined;
    },
    // The velocity with what the object carries added, after a step of deltaTime under the room's forces.
    applyForces: (physicsRoom: PhysicsRoom, object: PhysicsObject, velocity: Vec3, deltaTime: number): Vec3 =>
    {
        if (deltaTime <= 0)
            return velocity;

        const box = object.colliderState.hitbox;
        let acceleration: Vec3 = {x: 0, y: 0, z: 0};
        let blownUpward = false;
        for (const emitter of getEmitters(physicsRoom, object))
        {
            const hold = getHold(physicsRoom.room, emitter, box);
            if (hold == undefined)
                continue;
            const upward = hold.normal.y > 0;
            blownUpward ||= upward;
            // As much as it reaches of the body, thinner the farther down its range, and where the body has little
            // room left ahead of it: nothing is pinned against a ceiling or a wall.
            const share = hold.exposure * (1 - hold.distance / hold.range)
                * getRoomAhead(physicsRoom, box, hold.normal) / CUSHION_LENGTH;
            acceleration = Vector3DUtil.add(acceleration, Vector3DUtil.scale(hold.normal,
                (hold.acceleration + (upward ? GRAVITY_PULL : 0)) * share));
        }

        const carried = {...object.carriedVelocity};
        // Standing on something in a stream from below, a body weighs nothing: it carries what cancels its fall.
        if (blownUpward && carried.y < GRAVITY_SPEED && getRoomAhead(physicsRoom, box, DOWN) <= CONTACT_DISTANCE)
            carried.y = GRAVITY_SPEED;
        // Stopped from above, it keeps no more than that.
        if (carried.y > GRAVITY_SPEED && getRoomAhead(physicsRoom, box, UP) <= CONTACT_DISTANCE)
            carried.y = GRAVITY_SPEED;

        // Sped up first and moved after (by the caller), which keeps a bounce from growing or dying of the steps
        // it is taken in. Gravity takes away what is carried upward; drag, the rest.
        const kept = Math.exp(-DRAG * deltaTime);
        const gained = (1 - kept) / DRAG;
        carried.x = carried.x * kept + acceleration.x * gained;
        carried.z = carried.z * kept + acceleration.z * gained;
        carried.y += acceleration.y * deltaTime;
        carried.y = (carried.y > 0) ? Math.max(0, carried.y - GRAVITY_PULL * deltaTime) : carried.y * kept;

        const pushed = acceleration.x != 0 || acceleration.y != 0 || acceleration.z != 0;
        object.carriedVelocity = (pushed || Vector3DUtil.length(carried) >= MIN_CARRIED_SPEED)
            ? carried : {x: 0, y: 0, z: 0};
        return Vector3DUtil.add(velocity, object.carriedVelocity);
    },
}

// The room's emitters, but for the object itself.
function getEmitters(physicsRoom: PhysicsRoom, object: PhysicsObject): AddObjectSignal[]
{
    const emitters: AddObjectSignal[] = [];
    for (const emitterId of physicsRoom.forceEmitterIds)
    {
        const emitter = physicsRoom.room.objectById[emitterId];
        if (emitter != undefined && emitterId != object.objectId)
            emitters.push(emitter);
    }
    return emitters;
}

// Where an emitter's stream has hold of a box, or undefined if it has none: the way it blows, how far it has come
// where it first meets the box, how much of the push the box takes, and its settings. It holds a box in front of
// its face and short of the end of its range, wherever any of it reaches the box.
function getHold(room: Room, emitter: AddObjectSignal, box: AABB3)
    : {normal: Vec3, distance: number, exposure: number, acceleration: number, range: number} | undefined
{
    const {pos, dir, scale} = emitter.transform;
    const {normal, right, up} = Geometry3DUtil.getAxisFacingBasis(dir);
    const force = ObjectTypeConfigMap.getConfigByIndex(emitter.objectTypeIndex).force!;
    const acceleration = force.getAcceleration(emitter.metadata, normal);
    const range = force.getRange(emitter.metadata);
    if (acceleration <= 0)
        return undefined;

    const toBox = Vector3DUtil.subtract(box.center, pos);

    const middleDistance = Vector3DUtil.dot(toBox, normal);
    const halfDepth = getHalfExtent(box, normal);
    const distance = Math.max(0, middleDistance - halfDepth);
    if (middleDistance + halfDepth <= 0 || distance >= range)
        return undefined;

    const size = ObjectScaleUtil.getObjectSize(emitter.objectTypeIndex, scale);
    const exposure = getExposure(room, pos, normal, distance,
        getOverlap(pos, box, right, size.x), getOverlap(pos, box, up, size.y));
    return (exposure > 0) ? {normal, distance, exposure, acceleration, range} : undefined;
}

// How much of the push a box takes: as much of it as the stream reaches, in full from FULL_EXPOSURE of the most it
// could. Their overlap is cut along the blocks' cells into lanes, each reaching the box unless a block lies in it
// first. (The emitter's particles stop at the first block on its middle line alone, see ParticleEmitter.)
function getExposure(room: Room, pos: Vec3, normal: Vec3, distance: number,
    across: ReturnType<typeof getOverlap>, upward: ReturnType<typeof getOverlap>): number
{
    // Looked for from just in front of the face, and only as far as the box: a block beyond it shelters nothing.
    const lane = Vector3DUtil.add(pos, Vector3DUtil.scale(normal, FACE_CLEARANCE));
    const reach = distance - FACE_CLEARANCE;
    let reached = 0;
    for (const a of across.pieces)
    {
        lane[across.axis] = a.middle;
        for (const b of upward.pieces)
        {
            lane[upward.axis] = b.middle;
            if (VoxelQueryUtil.getDistanceToOccupiedBlock(room.voxelGrid.voxels, lane, normal, reach) == Infinity)
                reached += a.length * b.length;
        }
    }
    return (reached > 0) ? Math.min(1, reached / (FULL_EXPOSURE * across.most * upward.most)) : 0;
}

// How far a box could go along one of the world's axes before something solid stops it, as far as CUSHION_LENGTH.
function getRoomAhead(physicsRoom: PhysicsRoom, box: AABB3, direction: Vec3): number
{
    const reach = getHalfExtent(box, direction);
    const across = (axis: "x" | "y" | "z") => (direction[axis] != 0)
        ? 0.5 * CUSHION_LENGTH : Math.max(0, box.halfSize[axis] - PROBE_INSET);
    const probe: AABB3 = {
        center: Vector3DUtil.add(box.center, Vector3DUtil.scale(direction, reach + 0.5 * CUSHION_LENGTH)),
        halfSize: {x: across("x"), y: across("y"), z: across("z")},
    };

    let roomAhead = CUSHION_LENGTH;
    for (const solid of PhysicsColliderStateUtil.findOverlappingColliderStates(physicsRoom, probe))
    {
        if (!solid.colliderConfig.applyHardCollisionToOthers)
            continue;
        const gap = Vector3DUtil.dot(Vector3DUtil.subtract(solid.hitbox.center, box.center), direction)
            - getHalfExtent(solid.hitbox, direction) - reach;
        roomAhead = Math.min(roomAhead, Math.max(0, gap));
    }
    return roomAhead;
}

// Where a box and a stream overlap along one axis of the stream's face (which lies along one of the world's), in
// pieces cut where the blocks' cells meet, so that each lies within one row of them; and the most they could
// overlap along it: all of the narrower one.
function getOverlap(pos: Vec3, box: AABB3, faceAxis: Vec3, streamWidth: number)
{
    const axis: "x" | "y" | "z" = (faceAxis.x != 0) ? "x" : (faceAxis.y != 0) ? "y" : "z";
    const cellSize = (axis === "y") ? COLLISION_LAYER_HEIGHT : VOXEL_CELL_SIZE;
    const from = Math.max(pos[axis] - 0.5 * streamWidth, box.center[axis] - box.halfSize[axis]);
    const to = Math.min(pos[axis] + 0.5 * streamWidth, box.center[axis] + box.halfSize[axis]);
    const pieces: {middle: number, length: number}[] = [];
    for (let cell = Math.floor(from / cellSize); cell * cellSize < to; ++cell)
    {
        const start = Math.max(from, cell * cellSize), end = Math.min(to, (cell + 1) * cellSize);
        if (end > start)
            pieces.push({middle: 0.5 * (start + end), length: end - start});
    }
    return {axis, pieces, most: Math.min(streamWidth, 2 * box.halfSize[axis])};
}

// Half of a box's size along one of the world's axes.
function getHalfExtent(box: AABB3, axis: Vec3): number
{
    return Math.abs(axis.x) * box.halfSize.x + Math.abs(axis.y) * box.halfSize.y + Math.abs(axis.z) * box.halfSize.z;
}

export default PhysicsForceUtil;
