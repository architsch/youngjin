import Vec3 from "../../../shared/math/types/vec3";
import Vector3DUtil from "../../../shared/math/util/vector3DUtil";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import ObjectTransform from "../../../shared/object/types/objectTransform";
import SetObjectTransformSignal from "../../../shared/object/types/setObjectTransformSignal";
import { ENTERING_MAX_DURATION, ENTERING_SPEED,
    ENTERING_STRIDE_LENGTH } from "../../../shared/object/types/objectTypeConfig/doorObjectTypeConfig";
import { PLAYER_MAX_TURN_INPUT, PLAYER_MAX_WALK_INPUT, PLAYER_TURN_RATE_PER_INPUT,
    PLAYER_WALK_SPEED_PER_INPUT } from "../../../shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import PhysicsManager from "../../../shared/physics/physicsManager";
import Room from "../../../shared/room/types/room";
import VoxelVertex from "../../../shared/voxel/types/voxelVertex";
import VoxelPathUtil from "../../../shared/voxel/util/voxelPathUtil";
import ErrorUtil from "../../../shared/system/util/errorUtil";
import ServerRoomManager from "../../room/serverRoomManager";
import ServerUserManager from "../../user/serverUserManager";
import AgentMotion from "../types/agentMotion";
import AgentUserContext from "../types/agentUserContext";
import AgentWalkOutcome from "../types/agentWalkOutcome";
import AgentSignalUtil from "./agentSignalUtil";

// An agent's body, walked by the server as a browser walks its person's (see PlayerController, Rigidbody): the
// shared step at the browser's frame rate, run from SocketsServer's flush, and the result sent once a flush as a
// browser's transform emitter sends it, so everyone else sees an ordinary player.

const SUB_STEP_SECONDS = 1 / 60;
// Bounds the catch-up after a slow flush.
const MAX_SUB_STEPS = 30;
// A person's full steering, which is how an agent always walks and turns.
const WALK_SPEED = PLAYER_WALK_SPEED_PER_INPUT * PLAYER_MAX_WALK_INPUT;
const TURN_RATE = PLAYER_TURN_RATE_PER_INPUT * PLAYER_MAX_TURN_INPUT;
// Walks forward only while facing roughly the right way, so a sharp turn is made on the spot.
const FACING_TOLERANCE = Math.PI / 4;
// A turn to face something ends square on, for what its camera sees (the last step lands on the angle exactly).
const FACED_TOLERANCE = 0.001;
const WAYPOINT_REACHED_DISTANCE = 0.15;
const WALK_TIMEOUT_MS = 30_000;
const STUCK_AFTER_MS = 1500;
const MAX_REPATHS = 2;
// Further than this off the way to its next waypoint, a walker was pushed off it, and finds a new way.
const OFF_PATH_DISTANCE = 1.5;
const SETTLED_DISTANCE = 1e-4;
// Smaller moves and turns than these aren't worth sending.
const SEND_DISTANCE = 1e-3;
const SEND_TURN = 1e-3;

const ZERO: Vec3 = {x: 0, y: 0, z: 0};

const AgentBodyUtil =
{
    // Moves every present agent's body on by the time since the last flush. Called just before the flush, so the
    // transforms go out with it.
    stepAll: (elapsedSeconds: number): void =>
    {
        for (const ctx of Object.values(ServerUserManager.socketUserContexts))
        {
            if (!(ctx instanceof AgentUserContext))
                continue;
            try
            {
                stepAgent(ctx, elapsedSeconds);
            }
            catch (err)
            {
                console.error(`AgentBodyUtil.stepAll :: (userID = ${ctx.user.id}) Error: ${ErrorUtil.getErrorMessage(err)}`);
            }
        }
    },
    // Walks the agent to a vertex it can stand on, replacing any walk under way. Resolves with how the walk ended.
    // arriveWithin and target: arrived once that near the target, which stands on the goal (a person to meet).
    // faceToward: turned toward once there (a door to go through).
    walk: (ctx: AgentUserContext, goal: VoxelVertex,
        options: {arriveWithin?: number, target?: Vec3, faceToward?: Vec3} = {}): Promise<AgentWalkOutcome> =>
    {
        AgentBodyUtil.stop(ctx);
        const body = getBody(ctx);
        if (body == undefined)
            return Promise.resolve("interrupted");

        const motion = getMotion(ctx, body.player);
        const waypoints = planPath(body.room, VoxelPathUtil.feetOf(body.player.transform.pos), goal);
        if (waypoints == undefined)
            return Promise.resolve("noPath");

        return new Promise(resolve => {
            const now = Date.now();
            motion.walk = {waypoints, next: 0, goal, ...options, deadline: now + WALK_TIMEOUT_MS, repaths: 0,
                nearest: Infinity, nearestAt: now, finish: resolve};
            motion.settled = false;
        });
    },
    // Turns the agent where it stands toward a point, replacing any walk under way: a walk to where it is. Resolves with
    // how the turn ended.
    face: (ctx: AgentUserContext, point: Vec3): Promise<AgentWalkOutcome> =>
    {
        AgentBodyUtil.stop(ctx);
        const body = getBody(ctx);
        if (body == undefined)
            return Promise.resolve("interrupted");
        const feet = VoxelPathUtil.feetOf(body.player.transform.pos);
        const here = VoxelPathUtil.findStandingVertexNear(body.room.voxelGrid.voxels, feet);
        if (here == undefined)
            return Promise.resolve("noPath");

        const motion = getMotion(ctx, body.player);
        return new Promise(resolve => {
            const now = Date.now();
            motion.walk = {waypoints: [], next: 0, goal: here, faceToward: point, deadline: now + WALK_TIMEOUT_MS,
                repaths: 0, nearest: Infinity, nearestAt: now, finish: resolve};
            motion.settled = false;
        });
    },
    // Ends the agent's walk, if it is on one.
    stop: (ctx: AgentUserContext, outcome: AgentWalkOutcome = "interrupted"): void =>
    {
        if (ctx.motion != undefined)
            finishWalk(ctx.motion, outcome);
    },
}

function stepAgent(ctx: AgentUserContext, elapsedSeconds: number): void
{
    const body = getBody(ctx);
    if (body == undefined)
    {
        AgentBodyUtil.stop(ctx);
        return;
    }
    const {room, player} = body;
    const motion = getMotion(ctx, player);
    if (motion.heldForArrival)
    {
        motion.heldForArrival = false;
        return;
    }

    const active = motion.entering != undefined || motion.walk != undefined || !motion.settled;
    const steps = active ? Math.max(1, Math.min(MAX_SUB_STEPS, Math.round(elapsedSeconds / SUB_STEP_SECONDS))) : 1;
    const startPos = {...player.transform.pos};
    const startYaw = motion.yaw;
    let pos = {...startPos};
    let moved = 0;
    let underForce = false;
    for (let i = 0; i < steps; ++i)
    {
        const steering = steer(motion, pos, SUB_STEP_SECONDS);
        const step = PhysicsManager.getStepVelocity(room.id, player.objectId, steering, SUB_STEP_SECONDS);
        const target = new ObjectTransform(Vector3DUtil.add(pos, Vector3DUtil.scale(step.velocity, SUB_STEP_SECONDS)),
            toDir(motion.yaw), player.transform.scale);
        const resolved = PhysicsManager.setObjectTransform(room.id, player.objectId, target, false).transform.pos;
        moved += Math.sqrt(Vector3DUtil.distSqr(pos, resolved));
        pos = {...resolved};
        underForce = underForce || step.underForce;
    }

    if (motion.walk != undefined)
        checkWalk(motion, room, pos);
    if (motion.walk == undefined && motion.entering == undefined)
        motion.settled = moved < SETTLED_DISTANCE && !underForce;

    if (Vector3DUtil.distSqr(pos, startPos) > SEND_DISTANCE * SEND_DISTANCE
        || Math.abs(wrapAngle(motion.yaw - startYaw)) > SEND_TURN)
    {
        void AgentSignalUtil.send(ctx, "setObjectTransformSignal", new SetObjectTransformSignal(room.id, player.objectId,
            new ObjectTransform(pos, toDir(motion.yaw), player.transform.scale), false));
    }
}

// The agent's room and its player in it, as the room holds them; undefined while it is in no room.
function getBody(ctx: AgentUserContext): {room: Room, player: AddObjectSignal} | undefined
{
    const roomID = ServerRoomManager.currentRoomIDByUserID[ctx.user.id];
    const room = roomID == undefined ? undefined : ServerRoomManager.roomRuntimeMemories[roomID]?.room;
    const playerObjectId = ServerUserManager.getPlayerObject(ctx.user.id)?.objectId;
    const player = (room == undefined || playerObjectId == undefined) ? undefined : room.objectById[playerObjectId];
    return (room == undefined || player == undefined) ? undefined : {room, player};
}

// The agent's motion for its player, started over on each arrival: walking out of the doorway, as PlayerController
// does (arrivals stand behind a door, facing in; see SpawnHotspotUtil).
function getMotion(ctx: AgentUserContext, player: AddObjectSignal): AgentMotion
{
    if (ctx.motion != undefined && ctx.motion.playerObjectId == player.objectId)
        return ctx.motion;

    AgentBodyUtil.stop(ctx);
    const yaw = toYaw(player.transform.dir);
    ctx.motion = {playerObjectId: player.objectId, yaw, settled: false, heldForArrival: true, entering: {dirX: Math.sin(yaw),
        dirZ: Math.cos(yaw), fromX: player.transform.pos.x, fromZ: player.transform.pos.z, timeLeft: ENTERING_MAX_DURATION}};
    return ctx.motion;
}

// The steering for one step, turning the agent on the way: out of the doorway first, then along its walk.
function steer(motion: AgentMotion, pos: Vec3, deltaTime: number): Vec3
{
    const entering = motion.entering;
    if (entering != undefined)
    {
        entering.timeLeft -= deltaTime;
        if (Math.hypot(pos.x - entering.fromX, pos.z - entering.fromZ) < ENTERING_STRIDE_LENGTH && entering.timeLeft > 0)
            return {x: entering.dirX * ENTERING_SPEED, y: 0, z: entering.dirZ * ENTERING_SPEED};
        motion.entering = undefined;
    }

    const walk = motion.walk;
    if (walk == undefined)
        return ZERO;

    const nearTarget = walk.arriveWithin != undefined && walk.target != undefined
        && flatDistance(pos, walk.target) <= walk.arriveWithin;
    while (walk.next < walk.waypoints.length && (nearTarget
        || flatDistance(pos, walk.waypoints[walk.next]) < WAYPOINT_REACHED_DISTANCE))
    {
        walk.next = nearTarget ? walk.waypoints.length : walk.next + 1;
        walk.nearest = Infinity;
        walk.nearestAt = Date.now();
    }

    if (walk.next >= walk.waypoints.length)
    {
        if (walk.faceToward == undefined || Math.abs(turnToward(motion, pos, walk.faceToward, deltaTime)) <= FACED_TOLERANCE)
            finishWalk(motion, "arrived");
        return ZERO;
    }

    const waypoint = walk.waypoints[walk.next];
    if (Math.abs(turnToward(motion, pos, waypoint, deltaTime)) > FACING_TOLERANCE)
        return ZERO;
    const speed = Math.min(WALK_SPEED, flatDistance(pos, waypoint) / deltaTime);
    return {x: Math.sin(motion.yaw) * speed, y: 0, z: Math.cos(motion.yaw) * speed};
}

// Turns as far toward the point as a step allows; returns the angle still left.
function turnToward(motion: AgentMotion, pos: Vec3, point: Vec3, deltaTime: number): number
{
    const wanted = Math.atan2(point.x - pos.x, point.z - pos.z);
    const difference = wrapAngle(wanted - motion.yaw);
    const turn = Math.max(-TURN_RATE * deltaTime, Math.min(TURN_RATE * deltaTime, difference));
    motion.yaw = wrapAngle(motion.yaw + turn);
    return difference - turn;
}

// Once a flush: a walk that has run too long ends, and one that stopped getting anywhere, or was pushed off its way,
// finds a new way a few times before giving up.
function checkWalk(motion: AgentMotion, room: Room, pos: Vec3): void
{
    const walk = motion.walk!;
    const now = Date.now();
    if (now > walk.deadline)
    {
        finishWalk(motion, "timedOut");
        return;
    }
    // Arrived, and only turning to face something.
    if (walk.next >= walk.waypoints.length)
        return;

    const distance = flatDistance(pos, walk.waypoints[walk.next]);
    if (distance < walk.nearest - 0.05)
    {
        walk.nearest = distance;
        walk.nearestAt = now;
    }
    // On the way to the first waypoint, there is no leg yet to be pushed off.
    const pushedOff = walk.next > 0
        && distance > flatDistance(walk.waypoints[walk.next - 1], walk.waypoints[walk.next]) + OFF_PATH_DISTANCE;
    if (now - walk.nearestAt <= STUCK_AFTER_MS && !pushedOff)
        return;

    const waypoints = walk.repaths < MAX_REPATHS ? planPath(room, VoxelPathUtil.feetOf(pos), walk.goal) : undefined;
    if (waypoints == undefined)
    {
        finishWalk(motion, "blocked");
        return;
    }
    walk.waypoints = waypoints;
    walk.next = 0;
    walk.repaths++;
    walk.nearest = Infinity;
    walk.nearestAt = now;
}

function finishWalk(motion: AgentMotion, outcome: AgentWalkOutcome): void
{
    const walk = motion.walk;
    if (walk == undefined)
        return;
    motion.walk = undefined;
    motion.settled = false;
    walk.finish(outcome);
}

// Feet positions from the vertex nearest the feet to the goal; undefined if there's no way.
function planPath(room: Room, feet: Vec3, goal: VoxelVertex): Vec3[] | undefined
{
    const voxels = room.voxelGrid.voxels;
    const start = VoxelPathUtil.findStandingVertexNear(voxels, feet);
    const path = start == undefined ? undefined : VoxelPathUtil.findPath(voxels, start, goal);
    return path?.map(VoxelPathUtil.toWorld);
}

function flatDistance(a: Vec3, b: Vec3): number
{
    return Math.hypot(a.x - b.x, a.z - b.z);
}

// A player's transform direction points behind it (see SpawnHotspotUtil), so it faces the other way.
function toYaw(dir: Vec3): number
{
    return Math.atan2(-dir.x, -dir.z);
}

function toDir(yaw: number): Vec3
{
    return {x: -Math.sin(yaw), y: 0, z: -Math.cos(yaw)};
}

function wrapAngle(angle: number): number
{
    return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export default AgentBodyUtil;
