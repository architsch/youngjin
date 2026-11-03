import AABB3 from "../../../shared/math/types/aabb3";
import Vec3 from "../../../shared/math/types/vec3";
import PlayerObjectTypeConfig, { PLAYER_HEIGHT, PLAYER_MAX_WALK_INPUT, PLAYER_RADIUS_XZ,
    PLAYER_WALK_SPEED_PER_INPUT } from "../../../shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import PhysicsManager from "../../../shared/physics/physicsManager";
import PhysicsColliderStateUtil from "../../../shared/physics/util/physicsColliderStateUtil";
import Room from "../../../shared/room/types/room";
import { GRAVITY_SPEED } from "../../../shared/system/sharedConstants";
import Voxel from "../../../shared/voxel/types/voxel";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";
import UserContext from "../../sockets/types/userContext";
import PlayerMotionState from "../types/playerMotionState";

// How far across the room a player may go that walking doesn't explain, in world units, and how fast that comes back per
// second: a walk with some to spare, others' bodies pushing too, and a moment's walk at once, for moves that arrive
// together after the connection stalls. While a fan's stream reaches them, as fast as the strongest throws one, and
// farther at once, for what they carry out of it.
const WALK_SPEED = PLAYER_WALK_SPEED_PER_INPUT * PLAYER_MAX_WALK_INPUT;
export const ALLOWANCE = {capacity: 1.25 * WALK_SPEED, refillPerSecond: 1.25 * WALK_SPEED};
const FORCED_ALLOWANCE = {capacity: 3 * WALK_SPEED, refillPerSecond: 25};
// How far over where they were last held up (by something under them, or a stream) a player with nothing under them may
// be, in world units: a step's climb. A stream tosses nobody higher than it reaches. Past a moment unheld, they must be
// falling, if more slowly than gravity has them fall.
const MAX_STEP_UP = PlayerObjectTypeConfig.components.spawnedByAny.collider.maxClimbableHeight;
const FALL_GRACE_MS = 500;
const MIN_FALL_SPEED = 0.5 * GRAVITY_SPEED;
// How far under a player's feet something solid holds them up, in world units, and how far from their sides a block
// touches them.
const SUPPORT_DEPTH = 0.15;
const LEAN_REACH = 0.05;
// How long a player stays distrusted after a move they couldn't have made, besides the time for walking to have taken
// them as far.
export const DISTRUST_MS = 3000;

const states = new WeakMap<UserContext, PlayerMotionState>();

// Whether the moves a user's player is reported making are ones a player can make: walking, climbing a step, falling, or
// carried by a fan's stream. What a browser reports is otherwise taken as told (see ServerObjectManager), within its
// budgets (see USER_BUDGETS), so this is what keeps a forged run, leap or hover from what only a player who got there
// can have: a bill collected (see DollarBillUtil). Agents' bodies, which the server walks, pass it as browsers' do.
const PlayerMotionCheckUtil =
{
    // From where the room had them to where it has them now, as each move is made. A new room starts over, but for a
    // distrust under way.
    noteMove: (ctx: UserContext, room: Room, from: Vec3, to: Vec3, now: number = Date.now()): void =>
    {
        let state = states.get(ctx);
        if (state == undefined || state.roomID != room.id)
        {
            state = {roomID: room.id, at: now, allowance: ALLOWANCE.capacity, forced: false, heldFeetY: getFeetY(from),
                heldAt: now, distrustedUntil: state?.distrustedUntil ?? 0};
            states.set(ctx, state);
        }

        const forced = isInStream(room.id, from) || isInStream(room.id, to);
        const rate = (forced || state.forced) ? FORCED_ALLOWANCE : ALLOWANCE;
        state.allowance = refill(state.allowance, rate, now - state.at) - Math.hypot(to.x - from.x, to.z - from.z);
        state.at = now;
        state.forced = forced;
        if (state.allowance < 0)
        {
            distrust(state, now + DISTRUST_MS + 1000 * -state.allowance / rate.refillPerSecond);
            state.allowance = 0;
        }

        const feetY = getFeetY(to);
        if (forced || isStanding(room.id, to))
        {
            state.heldFeetY = feetY;
            state.heldAt = now;
            return;
        }
        // Pressed against a block it could step up onto, a body is held where it is for as long as it presses (see
        // PhysicsCollisionUtil), so it needn't be falling; but that is no footing to rise from.
        if (isLeaning(room.voxelGrid.voxels, to))
            state.heldAt = now;
        if (feetY > state.heldFeetY + MAX_STEP_UP
            - MIN_FALL_SPEED * Math.max(0, now - state.heldAt - FALL_GRACE_MS) / 1000)
            distrust(state, now + DISTRUST_MS);
    },
    // Whether all the user's player has done lately is believable. One whose moves were never noted has done nothing.
    isTrusted: (ctx: UserContext, now: number = Date.now()): boolean =>
    {
        const state = states.get(ctx);
        return state == undefined || now >= state.distrustedUntil;
    },
}

// What has come back over a while, never taking from what a stream gave beyond the usual.
function refill(allowance: number, rate: {capacity: number, refillPerSecond: number}, ms: number): number
{
    return (allowance >= rate.capacity) ? allowance : Math.min(rate.capacity, allowance + rate.refillPerSecond * ms / 1000);
}

function distrust(state: PlayerMotionState, until: number): void
{
    state.distrustedUntil = Math.max(state.distrustedUntil, until);
}

function getFeetY(pos: Vec3): number
{
    return pos.y - 0.5 * PLAYER_HEIGHT;
}

// Whether anything solid holds up a player in the middle of a place, under any part of their feet however little, as
// their physics finds it.
function isStanding(roomID: string, pos: Vec3): boolean
{
    const underFeet: AABB3 = {center: {x: pos.x, y: getFeetY(pos) - 0.5 * SUPPORT_DEPTH, z: pos.z},
        halfSize: {x: PLAYER_RADIUS_XZ, y: 0.5 * SUPPORT_DEPTH, z: PLAYER_RADIUS_XZ}};
    return PhysicsColliderStateUtil.boxOverlapsHardCollider(PhysicsManager.physicsRooms[roomID], underFeet);
}

// Whether a block they could step up onto touches a player's side.
function isLeaning(voxels: Voxel[], pos: Vec3): boolean
{
    const feetY = getFeetY(pos);
    const reach = PLAYER_RADIUS_XZ + LEAN_REACH;
    const lastRow = VoxelQueryUtil.getVoxelRowFromWorldZ(pos.z + reach);
    const lastCol = VoxelQueryUtil.getVoxelColFromWorldX(pos.x + reach);
    const lastLayer = VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(feetY + MAX_STEP_UP);
    for (let row = VoxelQueryUtil.getVoxelRowFromWorldZ(pos.z - reach); row <= lastRow; ++row)
    {
        for (let col = VoxelQueryUtil.getVoxelColFromWorldX(pos.x - reach); col <= lastCol; ++col)
        {
            for (let layer = VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(feetY + LEAN_REACH); layer <= lastLayer; ++layer)
            {
                if (VoxelQueryUtil.isVoxelBlockPresentAt(voxels, row, col, layer))
                    return true;
            }
        }
    }
    return false;
}

function isInStream(roomID: string, pos: Vec3): boolean
{
    const body: AABB3 = {center: pos, halfSize: {x: PLAYER_RADIUS_XZ, y: 0.5 * PLAYER_HEIGHT, z: PLAYER_RADIUS_XZ}};
    return PhysicsManager.getStrongestStream(roomID, body) != undefined;
}

export default PlayerMotionCheckUtil;
