/**
 * Integration tests: cannons and their balls (see @docs/gameplay/cannon.md) — a cannon's state under its one key
 * (decoded from anything, kept through its encoding, its switch its user's and the rest the server's, whichever
 * comes last); a ball's, past the room too, with its bounces counted; where a barrel points on each face it may
 * stand on, and how it turns; its counters, round its pillar on a floor, and on its plate and its pillar's two
 * sides on a wall; a sphere swept against a box, an upright
 * cylinder and another sphere, held to a slow walk along the same way; what a ball strikes in a room (a player and
 * an NPC as round bodies, a mirror and an NPC only as it closes on them, a cannon as its box) and what its blast
 * reaches; who may add, move, switch and remove a cannon, and what it costs; and, through the real server modules: a
 * cannon resting, waiting, picking whom to fire at, turning, staying on them until it is aimed (never, on whoever
 * outruns it, and on someone behind an NPC or another cannon all the same), standing aimed and firing, a row of shots
 * and then switching itself off, the row started over by any throw of its switch, emptied and gone, switched off and
 * on, kept by the room's saves; and a ball flying straight, pushed by a fan, bouncing off
 * another, off a mirror, off an NPC and off a cannon, each bounce counted and leaving it faster, up to the most a
 * ball goes, bursting on blocks, players and the room's own floor, breaking what anybody could remove and nothing
 * else, a cannon and the blocks it hangs on never, throwing whoever its blast reaches, the one it struck off its side
 * where the two met, leaving a bill where it threw nobody, and going out of the room without a word; and the ways
 * planned over the grid for bodies the server walks, which lead round a cannon as round a block.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fc from "fast-check";
import { harness, ConnectedUser } from "../helpers/serverHarness";
import { getPendingSignals } from "../helpers/invariants";
import { addRestrictedZone } from "../helpers/restrictedZone";
import DBInventoryUtil from "../../../src/server/db/util/dbInventoryUtil";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ServerObjectManager from "../../../src/server/object/serverObjectManager";
import CannonUtil from "../../../src/server/object/util/cannonUtil";
import CannonBallUtil from "../../../src/server/object/util/cannonBallUtil";
import DollarBillUtil, { SPAWN_INTERVAL_MS } from "../../../src/server/inventory/util/dollarBillUtil";
import DollarBillFlightUtil from "../../../src/server/inventory/util/dollarBillFlightUtil";
import PlayerMotionCheckUtil, { ALLOWANCE, BLAST_GRACE_MS } from "../../../src/server/user/util/playerMotionCheckUtil";
import { InventoryItemTypeEnumMap } from "../../../src/shared/inventory/types/inventoryItemType";
import InventorySignal from "../../../src/shared/inventory/types/inventorySignal";
import SignalTypeConfigMap from "../../../src/shared/networking/maps/signalTypeConfigMap";
import EncodableByteString from "../../../src/shared/networking/types/encodableByteString";
import ObjectCategoryConfigMap from "../../../src/shared/object/maps/objectCategoryConfigMap";
import ObjectMetadataEntryMap from "../../../src/shared/object/maps/objectMetadataEntryMap";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import CannonAim from "../../../src/shared/object/types/cannonAim";
import { CannonPhaseEnumMap } from "../../../src/shared/object/types/cannonPhase";
import CannonState from "../../../src/shared/object/types/cannonState";
import { ObjectMetadata } from "../../../src/shared/object/types/objectMetadata";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import CannonBallObjectTypeConfig, { CANNON_BALL_BLAST_RADIUS, CANNON_BALL_BOUNCE_BOOST, CANNON_BALL_MAX_SPEED,
    CANNON_BALL_MAX_WIND_SPEED, CANNON_BALL_RADIUS, CANNON_BALL_SPEED, CANNON_BALL_VANISH_DISTANCE, CANNON_BALL_WIND_SHARE,
    CANNON_BLAST_LIFT_SPEED, CANNON_BLAST_PUSH_SPEED }
    from "../../../src/shared/object/types/objectTypeConfig/cannonBallObjectTypeConfig";
import CannonObjectTypeConfig, { CANNON_AIM_TOLERANCE, CANNON_BALL_COUNT, CANNON_FIRE_INTERVAL_SECONDS, CANNON_LOCK_SECONDS,
    CANNON_MAX_PITCH, CANNON_MAX_RANGE, CANNON_MIN_PITCH, CANNON_MIN_RANGE, CANNON_READY_SECONDS, CANNON_REST_SECONDS,
    CANNON_SHOTS_IN_A_ROW, CANNON_SLEEP_PITCH, CANNON_SPENT_SECONDS, CANNON_TURN_RATE }
    from "../../../src/shared/object/types/objectTypeConfig/cannonObjectTypeConfig";
import DollarBillObjectTypeConfig, { DOLLAR_BILL_REST_HEIGHT, DOLLAR_BILL_SPAWN_CAP }
    from "../../../src/shared/object/types/objectTypeConfig/dollarBillObjectTypeConfig";
import FanObjectTypeConfig, { FAN_SETTINGS } from "../../../src/shared/object/types/objectTypeConfig/fanObjectTypeConfig";
import { PLAYER_HEIGHT, PLAYER_MAX_WALK_INPUT, PLAYER_RADIUS_XZ, PLAYER_WALK_SPEED_PER_INPUT }
    from "../../../src/shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import RemoveObjectSignal from "../../../src/shared/object/types/removeObjectSignal";
import SetObjectMetadataSignal from "../../../src/shared/object/types/setObjectMetadataSignal";
import SetObjectTransformSignal from "../../../src/shared/object/types/setObjectTransformSignal";
import AdminPrefsUtil from "../../../src/shared/object/util/adminPrefsUtil";
import CannonAimUtil from "../../../src/shared/object/util/cannonAimUtil";
import CannonBallMotionUtil from "../../../src/shared/object/util/cannonBallMotionUtil";
import CannonBallStateUtil from "../../../src/shared/object/util/cannonBallStateUtil";
import CannonBlastUtil from "../../../src/shared/object/util/cannonBlastUtil";
import CannonStateUtil from "../../../src/shared/object/util/cannonStateUtil";
import ObjectAttachmentUtil from "../../../src/shared/object/util/objectAttachmentUtil";
import ObjectCompositionUtil from "../../../src/shared/object/util/objectCompositionUtil";
import ObjectIdUtil from "../../../src/shared/object/util/objectIdUtil";
import ObjectObstacleUtil from "../../../src/shared/object/util/objectObstacleUtil";
import ObjectUpdateUtil from "../../../src/shared/object/util/objectUpdateUtil";
import CannonCompositionConstants from "../../../src/shared/graphics/mesh/composition/types/compositionConstants/cannonCompositionConstants";
import CannonCompositionUtil from "../../../src/shared/graphics/mesh/composition/util/cannonCompositionUtil";
import InstancedMeshCompositionPart from "../../../src/shared/graphics/mesh/composition/types/instancedMeshCompositionPart";
import PhysicsManager from "../../../src/shared/physics/physicsManager";
import PhysicsColliderStateUtil from "../../../src/shared/physics/util/physicsColliderStateUtil";
import PhysicsForceUtil from "../../../src/shared/physics/util/physicsForceUtil";
import AABB3 from "../../../src/shared/math/types/aabb3";
import Vec3 from "../../../src/shared/math/types/vec3";
import Geometry3DUtil from "../../../src/shared/math/util/geometry3DUtil";
import StringUtil from "../../../src/shared/math/util/stringUtil";
import Vector3DUtil from "../../../src/shared/math/util/vector3DUtil";
import Room from "../../../src/shared/room/types/room";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import { ATTACHMENT_HITBOX_INSET, CANNON_PRICE_DOLLARS, COLLISION_LAYER_HEIGHT, GENERATED_WALL_THICKNESS, MAX_ROOM_X,
    MAX_ROOM_Y, MAX_ROOM_Z, RELIEF_STEP,
    SIGNAL_BATCH_SEND_INTERVAL, STOREY_FLOOR_COLLISION_LAYER, UNIT_VEC3,
    VOXEL_CELL_SIZE } from "../../../src/shared/system/sharedConstants";
import User from "../../../src/shared/user/types/user";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";
import VoxelVertex from "../../../src/shared/voxel/types/voxelVertex";
import VoxelPathUtil from "../../../src/shared/voxel/util/voxelPathUtil";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import VoxelUpdateUtil from "../../../src/shared/voxel/util/voxelUpdateUtil";

const HUB_ID = "hubAAAAAAAAAAAAAAAAA";
const CANNON_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType(CannonObjectTypeConfig.objectType);
const BALL_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType(CannonBallObjectTypeConfig.objectType);
const BILL_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType(DollarBillObjectTypeConfig.objectType);
const FAN_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType(FanObjectTypeConfig.objectType);
const LABEL_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType("Label");
const MIRROR_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType("Mirror");
const NPC_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType("Npc");
const STATE_KEY = ObjectMetadataKeyEnumMap.CannonState;
const DOLLAR = InventoryItemTypeEnumMap.Dollar;
const MAX_BALLS = ObjectCategoryConfigMap.getMaxCountPerRoom(CannonBallObjectTypeConfig.category);
const MAX_BILLS = ObjectCategoryConfigMap.getMaxCountPerRoom(DollarBillObjectTypeConfig.category);
const FLUSH_SECONDS = SIGNAL_BATCH_SEND_INTERVAL / 1000;
const ADMIN = new User("an-admin", "Admin", UserTypeEnumMap.Admin, "", "");
const MEMBER = new User("a-member", "Member", UserTypeEnumMap.Member, "", "");
const GUEST = new User("a-guest", "Guest", UserTypeEnumMap.Guest, "", "");

// A cannon that stores nothing: as one just installed.
const NEW: CannonState = CannonStateUtil.decode("");
// How finely an aim's angles, a cannon's time, a ball's place and its speed are kept, with room for rounding.
const ANGLE_STEP = 2 * Math.PI / 8835 + 0.000001;
const PLACE_STEP = (MAX_ROOM_X + 2 * (CANNON_BALL_VANISH_DISTANCE + 4)) / 8835 + 0.000001;
const SPEED_STEP = 2 * (CANNON_BALL_MAX_SPEED + 2) / 8835 + 0.000001;

// The lower storey: its floor is the room's own, and the slab over it the upper storey's floor.
const FLOOR_FACING: Vec3 = {x: 0, y: 1, z: 0};
const CEILING_FACING: Vec3 = {x: 0, y: -1, z: 0};
const WALL_FACINGS: Vec3[] = [{x: 1, y: 0, z: 0}, {x: -1, y: 0, z: 0}, {x: 0, y: 0, z: 1}, {x: 0, y: 0, z: -1}];
const SLAB_UNDERSIDE_Y = STOREY_FLOOR_COLLISION_LAYER * COLLISION_LAYER_HEIGHT;
const STANDING_Y = 0.5 * PLAYER_HEIGHT;
// Where the cannon of most scenes stands, on the floor, and where someone stands for it to fire at: well within
// its range, and clear of its near limit.
const CANNON_SPOT: Vec3 = {x: 10.5, y: 0, z: 16.5};
const TARGET_SPOT: Vec3 = {x: 18.5, y: STANDING_Y, z: 16.5};
// The height a ball flies at in the scenes that fly one across the lower storey, clear of its floor and its slab.
const FLIGHT_Y = 2;

function getRoom(): Room
{
    return ServerRoomManager.roomRuntimeMemories[HUB_ID].room;
}

function getObjects(objectTypeIndex: number): AddObjectSignal[]
{
    return Object.values(getRoom().objectById).filter(obj => obj.objectTypeIndex == objectTypeIndex);
}

function getBalls(): AddObjectSignal[] { return getObjects(BALL_TYPE_INDEX); }
function getBills(): AddObjectSignal[] { return getObjects(BILL_TYPE_INDEX); }

// The clock moved on, then a flush, as SocketsServer's interval makes them.
function flush(): void
{
    vi.setSystemTime(Date.now() + SIGNAL_BATCH_SEND_INTERVAL);
    DollarBillUtil.stepAll(FLUSH_SECONDS);
    CannonBallUtil.stepAll(FLUSH_SECONDS);
    CannonUtil.stepAll(FLUSH_SECONDS);
}

function flushFor(seconds: number): void
{
    for (let i = 0; i < Math.round(seconds / FLUSH_SECONDS); ++i)
        flush();
}

function flushUntil(done: () => boolean, withinSeconds: number): void
{
    for (let elapsed = 0; !done(); elapsed += FLUSH_SECONDS)
    {
        if (elapsed >= withinSeconds)
            throw new Error(`Still waiting after ${withinSeconds} seconds`);
        flush();
    }
}

async function join(id: string, at: Vec3 = TARGET_SPOT, overrides: {userType?: number,
    playerMetadata?: {[key: string]: string}} = {}): Promise<ConnectedUser>
{
    const user = harness.connectUser({id, userName: id, ...overrides});
    await harness.joinRoom(user, HUB_ID);
    moveTo(user, at);
    return user;
}

// Where the room keeps their player, as the moves they send leave it, their body's box with it.
function moveTo(user: ConnectedUser, pos: Vec3): void
{
    const player = harness.getPlayerObject(user.user.id)!;
    Object.assign(player.transform.pos, pos);
    PhysicsManager.setObjectTransform(HUB_ID, player.objectId, player.transform, true);
}

function cannonSignal(owner: User, objectId: string, pos: Vec3 = CANNON_SPOT, dir: Vec3 = FLOOR_FACING,
    state: string = CannonStateUtil.encodeSwitch(true), roomID: string = HUB_ID): AddObjectSignal
{
    return new AddObjectSignal(roomID, owner.id, owner.userName, CANNON_TYPE_INDEX, objectId,
        new ObjectTransform({...pos}, {...dir}, {...UNIT_VEC3}), {[STATE_KEY]: new EncodableByteString(state)});
}

// A cannon as the room keeps one, with whatever state: taken up by the server as it finds it.
function placeCannon(state: Partial<CannonState> = {}, pos: Vec3 = CANNON_SPOT, dir: Vec3 = FLOOR_FACING,
    objectId: string = "a-cannon"): AddObjectSignal
{
    const cannon = cannonSignal(ADMIN, objectId, pos, dir, CannonStateUtil.encode({...NEW, ...state}));
    expect(ServerObjectManager.addObjectAsServer(getRoom(), ADMIN, cannon)).toBe(true);
    return getRoom().objectById[objectId];
}

function stateOf(cannon: AddObjectSignal): CannonState
{
    return CannonStateUtil.getObjectState(cannon);
}

function placeBlock(x: number, y: number, z: number): {row: number, col: number, layer: number}
{
    const row = VoxelQueryUtil.getVoxelRowFromWorldZ(z), col = VoxelQueryUtil.getVoxelColFromWorldX(x);
    const layer = VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(y);
    expect(VoxelUpdateUtil.addVoxelBlock(ADMIN, getRoom().voxelGrid.voxels,
        VoxelQueryUtil.getVoxelQuadIndex(row, col, "y", "-", layer), undefined, getRoom())).toBe(true);
    return {row, col, layer};
}

function hasBlock(block: {row: number, col: number, layer: number}): boolean
{
    return VoxelQueryUtil.isVoxelBlockPresent(VoxelQueryUtil.getVoxel(getRoom().voxelGrid.voxels, block.row, block.col)!,
        block.layer);
}

// A wall a block thick across the lower storey at one x, from wall to wall and floor to slab, but for a gap.
function placeWallAcross(x: number, exceptZ?: number): void
{
    for (let z = 0.5 * VOXEL_CELL_SIZE; z < MAX_ROOM_Z; z += VOXEL_CELL_SIZE)
    {
        for (let y = 0.5 * COLLISION_LAYER_HEIGHT; y < SLAB_UNDERSIDE_Y; y += COLLISION_LAYER_HEIGHT)
        {
            const row = VoxelQueryUtil.getVoxelRowFromWorldZ(z), col = VoxelQueryUtil.getVoxelColFromWorldX(x);
            const voxel = VoxelQueryUtil.getVoxel(getRoom().voxelGrid.voxels, row, col)!;
            if (exceptZ == undefined || Math.abs(z - exceptZ) > 1)
                voxel.blockLayerMask |= 1 << VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(y);
        }
    }
}

// That wall taken away again, the room's own walls at its ends left standing.
function removeWallAcross(x: number): void
{
    const ends = GENERATED_WALL_THICKNESS * VOXEL_CELL_SIZE;
    for (let z = ends + 0.5 * VOXEL_CELL_SIZE; z < MAX_ROOM_Z - ends; z += VOXEL_CELL_SIZE)
    {
        for (let y = 0.5 * COLLISION_LAYER_HEIGHT; y < SLAB_UNDERSIDE_Y; y += COLLISION_LAYER_HEIGHT)
        {
            VoxelQueryUtil.getVoxel(getRoom().voxelGrid.voxels, VoxelQueryUtil.getVoxelRowFromWorldZ(z),
                VoxelQueryUtil.getVoxelColFromWorldX(x))!.blockLayerMask &= ~(1 << VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(y));
        }
    }
}

// Where the mirror of the scenes that hang one is: in the middle of the west side of a wall of blocks three units
// wide and two high, a block thick, standing free in the lower storey.
const MIRROR_SPOT: Vec3 = {x: 16, y: 1.5, z: 16.5};

// That wall, and the mirror on it, a unit square, as the room keeps one. Its box, as physics has it.
function hangMirror(): {mirror: AddObjectSignal, box: AABB3}
{
    for (let z = MIRROR_SPOT.z - 1.25; z < MIRROR_SPOT.z + 1.5; z += VOXEL_CELL_SIZE)
    {
        for (let y = MIRROR_SPOT.y - 0.75; y < MIRROR_SPOT.y + 1; y += COLLISION_LAYER_HEIGHT)
            placeBlock(MIRROR_SPOT.x + 0.5 * VOXEL_CELL_SIZE, y, z);
    }
    const transform = ObjectAttachmentUtil.findPlacement(getRoom(), MIRROR_TYPE_INDEX, MIRROR_SPOT, {x: -1, y: 0, z: 0},
        {...UNIT_VEC3}, () => true)!;
    expect(transform, "the scene's wall takes a mirror").toBeDefined();
    expect(ServerObjectManager.addObjectAsServer(getRoom(), ADMIN, new AddObjectSignal(HUB_ID, ADMIN.id, ADMIN.userName,
        MIRROR_TYPE_INDEX, "a-mirror", transform))).toBe(true);
    const mirror = getRoom().objectById["a-mirror"];
    expect(dist(mirror.transform.pos, MIRROR_SPOT)).toBeLessThan(0.000001);
    return {mirror, box: PhysicsManager.physicsRooms[HUB_ID].objectById[mirror.objectId].colliderState.hitbox};
}

// An NPC on the lower storey's floor, as the room keeps one, near a spot. Its box, as physics has it.
function standNpc(near: {x: number, z: number}, objectId: string = "an-npc"): {npc: AddObjectSignal, box: AABB3}
{
    const transform = ObjectAttachmentUtil.findPlacement(getRoom(), NPC_TYPE_INDEX, {x: near.x, y: 0, z: near.z},
        FLOOR_FACING, {...UNIT_VEC3}, () => true)!;
    expect(transform, "the scene's floor takes an NPC").toBeDefined();
    expect(ServerObjectManager.addObjectAsServer(getRoom(), ADMIN, new AddObjectSignal(HUB_ID, ADMIN.id, ADMIN.userName,
        NPC_TYPE_INDEX, objectId, transform, {[ObjectMetadataKeyEnumMap.Label]: new EncodableByteString("Mira")}))).toBe(true);
    const npc = getRoom().objectById[objectId];
    return {npc, box: PhysicsManager.physicsRooms[HUB_ID].objectById[objectId].colliderState.hitbox};
}

// A level direction, by its angle from x toward z, in degrees.
function levelWay(degrees: number): Vec3
{
    return {x: Math.cos(degrees * Math.PI / 180), y: 0, z: Math.sin(degrees * Math.PI / 180)};
}

// The types of what is queued for a user, in order.
function signalTypesSentTo(user: ConnectedUser): string[]
{
    return (user.socketUserContext as any).pendingSignalsToUser.runs.flatMap((run: {typeIndex: number, signals: any[]}) =>
        run.signals.map(() => SignalTypeConfigMap.getConfigByIndex(run.typeIndex).signalType));
}

function forget(user: ConnectedUser): void
{
    (user.socketUserContext as any).pendingSignalsToUser.runs.length = 0;
}

function statesToldTo(user: ConnectedUser, objectId: string): string[]
{
    return getPendingSignals(user, "setObjectMetadataSignal")
        .filter((signal: SetObjectMetadataSignal) => signal.objectId == objectId && signal.metadataKey == STATE_KEY)
        .map((signal: SetObjectMetadataSignal) => signal.metadataValue);
}

function removalsSentTo(user: ConnectedUser): string[]
{
    return getPendingSignals(user, "removeObjectSignal").map((signal: RemoveObjectSignal) => signal.objectId);
}

function distanceToBox(point: Vec3, box: AABB3): number
{
    const gap = (p: number, c: number, h: number) => Math.max(0, Math.abs(p - c) - h);
    return Math.hypot(gap(point.x, box.center.x, box.halfSize.x), gap(point.y, box.center.y, box.halfSize.y),
        gap(point.z, box.center.z, box.halfSize.z));
}

function dist(a: Vec3, b: Vec3): number
{
    return Math.sqrt(Vector3DUtil.distSqr(a, b));
}

// A direction along an axis, whichever zero its other parts are written as.
function expectAxis(direction: Vec3 | undefined, axis: Vec3): void
{
    expect(direction).toBeDefined();
    expect(dist(direction!, axis)).toBeLessThan(0.000001);
}

function along(from: Vec3, to: Vec3, share: number): Vec3
{
    return Vector3DUtil.add(from, Vector3DUtil.scale(Vector3DUtil.subtract(to, from), share));
}

function angleBetween(a: Vec3, b: Vec3): number
{
    return Math.acos(Math.max(-1, Math.min(1, Vector3DUtil.dot(Vector3DUtil.normalize(a), Vector3DUtil.normalize(b)))));
}

// Whole numbers scaled into a range, which spread evenly where fc.double clusters at zero.
function scaled(min: number, max: number, steps: number = 2000): fc.Arbitrary<number>
{
    return fc.integer({min: 0, max: steps}).map(n => min + (max - min) * n / steps);
}

const vec3In = (min: number, max: number) => fc.record({x: scaled(min, max), y: scaled(min, max), z: scaled(min, max)});
// (Short of its limits by a hair, which rounding would put it past.)
const aimArb: fc.Arbitrary<CannonAim> = fc.record({yaw: scaled(0, 2 * Math.PI - 0.001),
    pitch: scaled(CANNON_MIN_PITCH + 0.001, CANNON_MAX_PITCH - 0.001)});
const stateArb: fc.Arbitrary<CannonState> = fc.record({on: fc.boolean(),
    phase: fc.constantFrom(...Object.values(CannonPhaseEnumMap)), ballsLeft: fc.integer({min: 0, max: CANNON_BALL_COUNT}),
    aim: aimArb, timeLeft: scaled(0, 15), shotsInARow: fc.integer({min: 0, max: CANNON_SHOTS_IN_A_ROW})});

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    // Only the clock: promises and the harness's own timers run as usual.
    vi.useFakeTimers({toFake: ["Date"]});
    harness.reset();
    harness.seedHub(HUB_ID);
    // No bill comes by itself, nor is blown about, in a scene about something else.
    vi.spyOn(DollarBillFlightUtil, "planGust").mockReturnValue([]);
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe("a cannon's state", () => {
    it("reads from nothing as a cannon just installed: on, resting, with every ball and none of its row fired", () => {
        expect(NEW).toMatchObject({on: true, phase: CannonPhaseEnumMap.Resting, ballsLeft: CANNON_BALL_COUNT,
            timeLeft: CANNON_REST_SECONDS, shotsInARow: 0});
        expect(NEW.aim.yaw).toBe(0);
        expect(NEW.aim.pitch).toBeGreaterThan(0);
        expect(NEW.aim.pitch).toBeLessThan(CANNON_MAX_PITCH);
        // As does its switch alone, which is all a user adds one with.
        expect(CannonStateUtil.decode(CannonStateUtil.encodeSwitch(true))).toEqual(NEW);
        expect(CannonStateUtil.decode(CannonStateUtil.encodeSwitch(false))).toEqual({...NEW, on: false});
    });

    it("reads from anything at all as some state a cannon can be in", () => {
        fc.assert(fc.property(fc.string({maxLength: 40}), text => {
            const state = CannonStateUtil.decode(text);
            expect(Object.values(CannonPhaseEnumMap)).toContain(state.phase);
            expect(Number.isInteger(state.ballsLeft)).toBe(true);
            expect(state.ballsLeft).toBeGreaterThanOrEqual(0);
            expect(state.ballsLeft).toBeLessThanOrEqual(CANNON_BALL_COUNT);
            expect(state.aim.yaw).toBeGreaterThanOrEqual(0);
            expect(state.aim.yaw).toBeLessThanOrEqual(2 * Math.PI);
            expect(state.aim.pitch).toBeGreaterThanOrEqual(CANNON_MIN_PITCH);
            expect(state.aim.pitch).toBeLessThanOrEqual(CANNON_MAX_PITCH);
            expect(state.timeLeft).toBeGreaterThanOrEqual(0);
            expect(Number.isInteger(state.shotsInARow)).toBe(true);
            expect(state.shotsInARow).toBeGreaterThanOrEqual(0);
            expect(state.shotsInARow).toBeLessThanOrEqual(CANNON_SHOTS_IN_A_ROW);
            // And is kept as read.
            const kept = CannonStateUtil.decode(CannonStateUtil.encode(state));
            expect(kept).toMatchObject({on: state.on, phase: state.phase, ballsLeft: state.ballsLeft,
                shotsInARow: state.shotsInARow});
            expect(CannonAimUtil.getAngleBetween(kept.aim, state.aim)).toBeLessThan(ANGLE_STEP);
            expect(Math.abs(kept.timeLeft - state.timeLeft)).toBeLessThan(0.002);
        }));
    });

    it("keeps its switch, its phase, its balls and its row exactly, and its aim and its time to a fine step", () => {
        fc.assert(fc.property(stateArb, state => {
            const encoded = CannonStateUtil.encode(state);
            const kept = CannonStateUtil.decode(encoded);
            expect(kept).toMatchObject({on: state.on, phase: state.phase, ballsLeft: state.ballsLeft,
                shotsInARow: state.shotsInARow});
            expect(Math.abs(kept.aim.yaw - state.aim.yaw)).toBeLessThan(ANGLE_STEP);
            expect(Math.abs(kept.aim.pitch - state.aim.pitch)).toBeLessThan(ANGLE_STEP);
            expect(Math.abs(kept.timeLeft - state.timeLeft)).toBeLessThan(0.002);
            // In few enough characters that every one of them is visible ASCII.
            expect(encoded.length).toBeLessThanOrEqual(10);
            expect(encoded).toMatch(/^[\x21-\x7e]*$/);
        }));
    });

    it("takes a single character for its switch alone, and anything longer for all but its switch", () => {
        fc.assert(fc.property(stateArb, stateArb, (current, told) => {
            const stored = CannonStateUtil.encode(current);
            // A user's throw of the switch leaves the rest as the server has it.
            for (const on of [false, true])
            {
                const thrown = CannonStateUtil.merge(CannonStateUtil.encodeSwitch(on), stored);
                expect(CannonStateUtil.decode(thrown)).toEqual({...CannonStateUtil.decode(stored), on});
            }
            // The server's word leaves the switch as its user has it.
            const kept = CannonStateUtil.merge(CannonStateUtil.encode(told), stored);
            expect(CannonStateUtil.decode(kept)).toEqual({...CannonStateUtil.decode(CannonStateUtil.encode(told)),
                on: current.on});
        }));
        // With nothing kept yet (as it is added), a value is taken as it comes.
        const whole = CannonStateUtil.encode({...NEW, on: false, ballsLeft: 3});
        expect(CannonStateUtil.merge(whole)).toBe(whole);
        expect(CannonStateUtil.merge(CannonStateUtil.encodeSwitch(false))).toBe(CannonStateUtil.encodeSwitch(false));
    });

    it("leaves a switch just thrown as it is, whichever of the two words about it comes last", () => {
        const before = CannonStateUtil.encode({...NEW, phase: CannonPhaseEnumMap.Waiting, ballsLeft: 7});
        const servers = CannonStateUtil.encode({...NEW, phase: CannonPhaseEnumMap.Aiming, ballsLeft: 7,
            aim: {yaw: 1, pitch: 0.2}});
        const off = CannonStateUtil.encodeSwitch(false);
        const oneWay = CannonStateUtil.merge(servers, CannonStateUtil.merge(off, before));
        const theOther = CannonStateUtil.merge(off, CannonStateUtil.merge(servers, before));
        expect(oneWay).toBe(theOther);
        expect(CannonStateUtil.decode(oneWay)).toMatchObject({on: false, phase: CannonPhaseEnumMap.Aiming, ballsLeft: 7});
    });

    it("is what the key's values are stored as, on a cannon as on anything", () => {
        const stored = CannonStateUtil.encode({...NEW, ballsLeft: 5});
        expect(ObjectMetadataEntryMap.preprocess(STATE_KEY, CannonStateUtil.encodeSwitch(false), stored))
            .toBe(CannonStateUtil.merge(CannonStateUtil.encodeSwitch(false), stored));
        expect(ObjectMetadataEntryMap.preprocess(STATE_KEY, "x".repeat(500)).length).toBeLessThanOrEqual(128);
    });

    it("shows all of the server's part but the time left and the row's count, which are counted and never told", () => {
        const state = {...NEW, phase: CannonPhaseEnumMap.Waiting, timeLeft: 5};
        const later = {...state, timeLeft: 1.3, shotsInARow: CANNON_SHOTS_IN_A_ROW};
        expect(CannonStateUtil.getShownPart(CannonStateUtil.encode(later)))
            .toBe(CannonStateUtil.getShownPart(CannonStateUtil.encode(state)));
        expect(CannonStateUtil.getShownPart(CannonStateUtil.encode({...state, on: false})))
            .toBe(CannonStateUtil.getShownPart(CannonStateUtil.encode(state)));
        for (const change of [{phase: CannonPhaseEnumMap.Aiming}, {ballsLeft: 19}, {aim: {yaw: 0.5, pitch: NEW.aim.pitch}},
            {aim: {yaw: 0, pitch: 0.9}}])
        {
            expect(CannonStateUtil.getShownPart(CannonStateUtil.encode({...state, ...change})))
                .not.toBe(CannonStateUtil.getShownPart(CannonStateUtil.encode(state)));
        }
    });

    it("shows its barrel hanging down while it is switched off, and where it aims again once on", () => {
        const aim = {yaw: 2, pitch: 0.6};
        for (const facing of [FLOOR_FACING, ...WALL_FACINGS])
            expect(CannonStateUtil.getShownAim({...NEW, aim}, facing)).toEqual(aim);
        // On a floor, tipped toward it the way it was turned.
        expect(CannonStateUtil.getShownAim({...NEW, aim, on: false}, FLOOR_FACING))
            .toEqual({yaw: aim.yaw, pitch: CANNON_SLEEP_PITCH});
        expect(CANNON_SLEEP_PITCH).toBeLessThan(0);
        expect(CANNON_SLEEP_PITCH).toBeGreaterThanOrEqual(CANNON_MIN_PITCH);
        // On a wall, straight down along it.
        for (const facing of WALL_FACINGS)
        {
            const asleep = CannonStateUtil.getShownAim({...NEW, aim, on: false}, facing);
            expect(dist(CannonAimUtil.getDirection(facing, asleep), {x: 0, y: -1, z: 0})).toBeLessThan(0.000001);
        }
    });

    it("is spent with no ball left, which nothing that is no cannon ever reads as", () => {
        expect(CannonStateUtil.isSpent(cannonSignal(ADMIN, "c", CANNON_SPOT, FLOOR_FACING,
            CannonStateUtil.encode({...NEW, ballsLeft: 0})))).toBe(true);
        expect(CannonStateUtil.isSpent(cannonSignal(ADMIN, "c", CANNON_SPOT, FLOOR_FACING,
            CannonStateUtil.encode({...NEW, ballsLeft: 1})))).toBe(false);
        expect(CannonStateUtil.isSpent(new AddObjectSignal(HUB_ID, "", "", FAN_TYPE_INDEX, "f",
            new ObjectTransform({...CANNON_SPOT}, {...FLOOR_FACING}, {...UNIT_VEC3})))).toBe(false);
    });
});

describe("a cannon ball's state", () => {
    // The most a character of it counts to: what the highest character there is reads as.
    const MOST_COUNTED = StringUtil.convertVisibleASCIIToRawNumber(String.fromCharCode(0xffff), 0);
    const placeArb = fc.record({x: scaled(-CANNON_BALL_VANISH_DISTANCE, MAX_ROOM_X + CANNON_BALL_VANISH_DISTANCE),
        y: scaled(-CANNON_BALL_VANISH_DISTANCE, MAX_ROOM_Y + CANNON_BALL_VANISH_DISTANCE),
        z: scaled(-CANNON_BALL_VANISH_DISTANCE, MAX_ROOM_Z + CANNON_BALL_VANISH_DISTANCE)});

    it("keeps where it is and how it moves to a fine step, as far past the room as a ball ever flies, and how many " +
        "times it has bounced", () => {
        fc.assert(fc.property(placeArb, vec3In(-CANNON_BALL_MAX_SPEED, CANNON_BALL_MAX_SPEED), fc.nat({max: MOST_COUNTED}),
            (pos, vel, bounces) => {
                const encoded = CannonBallStateUtil.encode({pos, vel, exploded: false, hitObjectIds: [], bounces});
                const kept = CannonBallStateUtil.decode(encoded);
                expect(kept.exploded).toBe(false);
                expect(kept.hitObjectIds).toEqual([]);
                expect(kept.struck).toBeUndefined();
                expect(kept.bounces).toBe(bounces);
                for (const axis of ["x", "y", "z"] as const)
                {
                    expect(Math.abs(kept.pos[axis] - pos[axis])).toBeLessThan(PLACE_STEP);
                    expect(Math.abs(kept.vel[axis] - vel[axis])).toBeLessThan(SPEED_STEP);
                }
                expect(encoded.length).toBeLessThanOrEqual(15);
                expect(encoded).toMatch(/^[\x21-\x7e]*$/);
                // One that ends before its bounces is of a ball that never bounced, going the same way.
                expect(CannonBallStateUtil.decode(encoded.slice(0, -1))).toEqual({...kept, bounces: 0});
            }));
    });

    it("counts its bounces round, as far as a character holds, and tells which of two counts is ahead", () => {
        const flying = {pos: {x: 1, y: 1, z: 1}, vel: {x: 1, y: 0, z: 0}, exploded: false, hitObjectIds: []};
        const counts = new Set<number>();
        let bounces = 0;
        for (let i = 0; i <= MOST_COUNTED; ++i)
        {
            counts.add(bounces);
            const next = CannonBallStateUtil.countBounce(bounces);
            expect(CannonBallStateUtil.isBounceCountAhead(next, bounces)).toBe(true);
            expect(CannonBallStateUtil.isBounceCountAhead(bounces, next)).toBe(false);
            expect(CannonBallStateUtil.isBounceCountAhead(bounces, bounces)).toBe(false);
            expect(CannonBallStateUtil.decode(CannonBallStateUtil.encode({...flying, bounces: next})).bounces).toBe(next);
            bounces = next;
        }
        // Every count a character holds, once, and then the first again.
        expect(counts.size).toBe(MOST_COUNTED + 1);
        expect(bounces).toBe(0);
        // A few more is ahead, though the count started over in between.
        expect(CannonBallStateUtil.isBounceCountAhead(2, MOST_COUNTED - 1)).toBe(true);
        expect(CannonBallStateUtil.isBounceCountAhead(MOST_COUNTED - 1, 2)).toBe(false);
    });

    it("keeps where it burst, whom its blast threw, and which of them it struck, thrown which way to a fine step", () => {
        fc.assert(fc.property(placeArb, fc.array(fc.stringMatching(/^[A-Za-z0-9#@]{1,12}$/), {maxLength: 6}), fc.nat(),
            scaled(-Math.PI, Math.PI), (pos, ids, pick, heading) => {
                // It struck any one of them, or none of them.
                const struckId: string | undefined = ids[pick % (ids.length + 1)];
                const struck = (struckId == undefined) ? undefined : {objectId: struckId, heading};
                const kept = CannonBallStateUtil.decode(CannonBallStateUtil.encode({pos, vel: {x: 1, y: 2, z: 3},
                    exploded: true, hitObjectIds: ids, struck, bounces: 5}));
                expect(kept.exploded).toBe(true);
                expect(kept.hitObjectIds).toEqual(ids);
                expect(kept.vel).toEqual({x: 0, y: 0, z: 0});
                expect(kept.bounces).toBe(0);
                for (const axis of ["x", "y", "z"] as const)
                    expect(Math.abs(kept.pos[axis] - pos[axis])).toBeLessThan(PLACE_STEP);
                expect(kept.struck?.objectId).toBe(struckId);
                if (struck != undefined)
                    expect(Math.abs(kept.struck!.heading - heading)).toBeLessThan(ANGLE_STEP);
            }));
        // One it didn't throw is none it struck.
        const burst = {pos: {x: 1, y: 1, z: 1}, vel: {x: 0, y: 0, z: 0}, exploded: true, bounces: 0};
        expect(CannonBallStateUtil.decode(CannonBallStateUtil.encode({...burst, hitObjectIds: ["someone"],
            struck: {objectId: "another", heading: 1}}))).toMatchObject({hitObjectIds: ["someone"], struck: undefined});
        // Nor is one farther down a list than a character counts to, a list longer than any blast makes: nobody else
        // is taken for them, and what is stored stays text.
        const crowd = Array.from({length: MOST_COUNTED + 30}, (_, i) => `body${i}`);
        for (const struckIndex of [MOST_COUNTED - 2, MOST_COUNTED - 1, MOST_COUNTED, MOST_COUNTED + 1, crowd.length - 1])
        {
            const encoded = CannonBallStateUtil.encode({...burst, hitObjectIds: crowd,
                struck: {objectId: crowd[struckIndex], heading: 1}});
            expect(encoded).toMatch(/^[\x21-\x7e]*$/);
            const kept = CannonBallStateUtil.decode(encoded);
            expect(kept.hitObjectIds).toEqual(crowd);
            expect(kept.struck?.objectId).toBe((struckIndex < MOST_COUNTED) ? crowd[struckIndex] : undefined);
        }
    });

    it("reads from anything at all, and never as a switch alone", () => {
        fc.assert(fc.property(fc.string({maxLength: 40}), text => {
            const state = CannonBallStateUtil.decode(text);
            expect(Number.isFinite(state.pos.x + state.pos.y + state.pos.z + state.vel.x + state.vel.y + state.vel.z)).toBe(true);
            // Whoever it says it struck is one of those it says it threw.
            if (state.struck != undefined)
            {
                expect(state.hitObjectIds).toContain(state.struck.objectId);
                expect(Math.abs(state.struck.heading)).toBeLessThanOrEqual(Math.PI);
            }
        }));
        const flying = CannonBallStateUtil.encode({pos: {x: 1, y: 1, z: 1}, vel: {x: 0, y: 0, z: 0}, exploded: false,
            hitObjectIds: [], bounces: 3});
        const burst = CannonBallStateUtil.encode({pos: {x: 1, y: 1, z: 1}, vel: {x: 0, y: 0, z: 0}, exploded: true,
            hitObjectIds: [], bounces: 0});
        for (const value of [flying, burst])
        {
            expect(CannonStateUtil.isSwitch(value)).toBe(false);
            // So that what is told of a ball replaces what was kept of it (see CannonStateUtil.merge).
            expect(CannonBallStateUtil.decode(CannonStateUtil.merge(value, flying))).toEqual(CannonBallStateUtil.decode(value));
        }
    });
});

describe("where a cannon's barrel points", () => {
    const facings = [FLOOR_FACING, ...WALL_FACINGS];

    it("is told in the frame of the face it stands on, and read back from any way it can tilt to", () => {
        fc.assert(fc.property(fc.constantFrom(...facings), aimArb, (facing, aim) => {
            const direction = CannonAimUtil.getDirection(facing, aim);
            expect(Vector3DUtil.length(direction)).toBeCloseTo(1, 9);
            // How far out of the face it points is its pitch.
            expect(Math.asin(Vector3DUtil.dot(direction, facing))).toBeCloseTo(aim.pitch, 9);
            const back = CannonAimUtil.getAim(facing, direction);
            expect(back.reachable).toBe(true);
            expect(CannonAimUtil.getAngleBetween(back.aim, aim)).toBeLessThan(0.000001);
        }));
    });

    it("can't be turned further into its face than its lowest tilt, and says so", () => {
        for (const facing of facings)
        {
            const {right} = Geometry3DUtil.getAxisFacingBasis(facing);
            const steep = Vector3DUtil.add(Vector3DUtil.scale(right, Math.cos(CANNON_MIN_PITCH - 0.2)),
                Vector3DUtil.scale(facing, Math.sin(CANNON_MIN_PITCH - 0.2)));
            const {aim, reachable} = CannonAimUtil.getAim(facing, steep);
            expect(reachable).toBe(false);
            expect(aim.pitch).toBe(CANNON_MIN_PITCH);
            // Straight out of the face, and anywhere above its lowest tilt, it can.
            expect(CannonAimUtil.getAim(facing, facing).reachable).toBe(true);
            expect(CannonAimUtil.getAim(facing, right).reachable).toBe(true);
        }
        expect(CANNON_MAX_PITCH).toBeCloseTo(0.5 * Math.PI, 12);
    });

    it("turns the shorter way round, by no more than it is let, and comes to rest exactly where it was sent", () => {
        fc.assert(fc.property(aimArb, aimArb, scaled(0.01, 0.6), (from, to, most) => {
            let aim = from;
            let turns = 0;
            while (aim.yaw != to.yaw || aim.pitch != to.pitch)
            {
                const next = CannonAimUtil.turnToward(aim, to, most);
                const yawTurn = Math.abs(Math.atan2(Math.sin(next.yaw - aim.yaw), Math.cos(next.yaw - aim.yaw)));
                expect(yawTurn).toBeLessThanOrEqual(most + 0.000001);
                expect(Math.abs(next.pitch - aim.pitch)).toBeLessThanOrEqual(most + 0.000001);
                aim = next;
                // Never the long way round: half a turn at most, and the whole of the tilt.
                expect(++turns).toBeLessThanOrEqual(Math.ceil(Math.PI / most) + 2);
            }
        }));
    });

    it("has its pivot over the middle of its face and its mouth half a barrel on, the way it points", () => {
        fc.assert(fc.property(fc.constantFrom(...facings), aimArb, (facing, aim) => {
            const pivot = CannonAimUtil.getPivot(CANNON_SPOT, facing);
            expect(pivot).toEqual(Vector3DUtil.add(CANNON_SPOT, Vector3DUtil.scale(facing, CannonCompositionConstants.pivotHeight)));
            const muzzle = CannonAimUtil.getMuzzle(CANNON_SPOT, facing, aim);
            expect(dist(pivot, muzzle)).toBeCloseTo(0.5 * CannonCompositionConstants.barrelLength, 9);
            expect(angleBetween(Vector3DUtil.subtract(muzzle, pivot), CannonAimUtil.getDirection(facing, aim))).toBeLessThan(0.000001);
        }));
        // All of it within the cube a cannon stands in, however it points.
        const {pivotHeight, barrelLength, barrelDiameter} = CannonCompositionConstants;
        expect(Math.hypot(0.5 * barrelLength, 0.5 * barrelDiameter)).toBeLessThanOrEqual(0.5);
        expect(pivotHeight + 0.5 * barrelLength).toBeLessThanOrEqual(1);
    });
});

describe("a cannon's counters", () => {
    const C = CannonCompositionConstants;
    const SEGMENTS_PER_COUNTER = C.digitsPerCounter * C.segmentsPerDigit;
    // A digital display's digits, by the segments each lights: the top bar (a), upper right (b), lower right (c), bottom
    // bar (d), lower left (e), upper left (f) and middle bar (g).
    const DISPLAY_DIGITS: {[segments: string]: string} = {abcdef: "0", bc: "1", abdeg: "2", abcdg: "3", bcfg: "4",
        acdfg: "5", acdefg: "6", abc: "7", abcdefg: "8", abcdfg: "9"};

    function posed(facing: Vec3, ballsLeft: number): InstancedMeshCompositionPart[]
    {
        const parts = CannonCompositionUtil.buildParts();
        CannonCompositionUtil.pose(parts, facing, CannonAimUtil.getLocalDirection({yaw: 0, pitch: 0}), ballsLeft);
        return parts;
    }

    // A direction in the frame of the face a cannon stands on, as it lies in the room.
    function inRoom(facing: Vec3, direction: Vec3): Vec3
    {
        const face = Geometry3DUtil.getAxisFacingBasis(facing);
        return Vector3DUtil.add(Vector3DUtil.add(Vector3DUtil.scale(face.right, direction.x),
            Vector3DUtil.scale(face.up, direction.y)), Vector3DUtil.scale(face.normal, direction.z));
    }

    // A counter's panel's own axes in the face's frame, as a square facing its way is turned in the room (see
    // Geometry3DUtil.getFacingBasis): its right and up, as seen from in front of it.
    function panelAxes(facing: Vec3, way: Vec3): {right: Vec3, up: Vec3}
    {
        const face = Geometry3DUtil.getAxisFacingBasis(facing);
        const own = Geometry3DUtil.getFacingBasis(inRoom(facing, way));
        const toFace = (v: Vec3): Vec3 => ({x: Vector3DUtil.dot(v, face.right), y: Vector3DUtil.dot(v, face.up),
            z: Vector3DUtil.dot(v, face.normal)});
        return {right: toFace(own.right), up: toFace(own.up)};
    }

    function segmentsOf(parts: InstancedMeshCompositionPart[], counter: number): InstancedMeshCompositionPart[]
    {
        return parts.slice(C.firstSegmentIndex + counter * SEGMENTS_PER_COUNTER,
            C.firstSegmentIndex + (counter + 1) * SEGMENTS_PER_COUNTER);
    }

    // Nothing of a counter is drawn: neither its panel nor any segment of its digits.
    function isUnseen(parts: InstancedMeshCompositionPart[], counter: number): boolean
    {
        return [parts[C.firstCounterIndex + counter], ...segmentsOf(parts, counter)]
            .every(part => part.scale.x == 0 && part.scale.y == 0);
    }

    // Every segment of a counter showing 88, lit, just proud of its panel, facing the same way, and inside it.
    function expectDigitsOnPanel(parts: InstancedMeshCompositionPart[], facing: Vec3, counter: number): void
    {
        const panel = parts[C.firstCounterIndex + counter];
        const {right, up} = panelAxes(facing, panel.dir);
        for (const part of segmentsOf(parts, counter))
        {
            const relative = Vector3DUtil.subtract(part.offset, panel.offset);
            expect(part.dir).toEqual(panel.dir);
            expect(part.scale.x * part.scale.y).toBeGreaterThan(0);
            expect(Vector3DUtil.dot(relative, panel.dir)).toBeCloseTo(RELIEF_STEP, 9);
            expect(Math.abs(Vector3DUtil.dot(relative, right)) + 0.5 * part.scale.x).toBeLessThanOrEqual(0.5 * C.counterSize);
            expect(Math.abs(Vector3DUtil.dot(relative, up)) + 0.5 * part.scale.y).toBeLessThanOrEqual(0.5 * C.counterSize);
        }
    }

    // What a counter shows, as someone in front of it reads it: its lit segments, each where it lies across and up its
    // panel, one digit in the middle unless some lie past a digit's half width, then two side by side, and each named
    // by where it lies in its digit.
    function readCounter(parts: InstancedMeshCompositionPart[], facing: Vec3, counter: number): string
    {
        const panel = parts[C.firstCounterIndex + counter];
        const {right, up} = panelAxes(facing, panel.dir);
        const lit = segmentsOf(parts, counter)
            .filter(part => part.scale.x > 0 && part.scale.y > 0)
            .map(part => {
                const relative = Vector3DUtil.subtract(part.offset, panel.offset);
                return {across: Vector3DUtil.dot(relative, right), up: Vector3DUtil.dot(relative, up),
                    isBar: part.scale.x > part.scale.y};
            });
        const twoDigits = lit.some(segment => Math.abs(segment.across) > 0.5 * C.digitWidth);
        const spacing = 0.5 * (C.digitWidth + C.digitGap);
        const digits = twoDigits ? [{middle: -spacing, segments: lit.filter(segment => segment.across < 0)},
            {middle: spacing, segments: lit.filter(segment => segment.across > 0)}] : [{middle: 0, segments: lit}];
        return digits.map(({middle, segments}) => DISPLAY_DIGITS[segments.map(segment => {
            const across = segment.across - middle;
            if (segment.isBar)
                return (segment.up > 0.25 * C.digitHeight) ? "a" : (segment.up < -0.25 * C.digitHeight) ? "d" : "g";
            return (across > 0) ? ((segment.up > 0) ? "b" : "c") : ((segment.up > 0) ? "f" : "e");
        }).sort().join("")] ?? "?").join("");
    }

    it("stand on every side of its pillar on a floor, a little over its plate and under its barrel lying level, each " +
        "digit on its panel", () => {
        const middleZ = C.plateSize.z + C.counterBottom + 0.5 * C.counterSize;
        expect(middleZ - 0.5 * C.counterSize).toBeGreaterThan(C.plateSize.z);
        expect(middleZ + 0.5 * C.counterSize).toBeLessThan(C.pivotHeight - 0.5 * C.barrelDiameter);
        expect(C.counterSize).toBeLessThan(Math.min(C.pillarSize.x, C.pillarSize.y));
        expect(2 * C.digitWidth + C.digitGap).toBeLessThan(C.counterSize);
        expect(C.digitHeight).toBeLessThan(C.counterSize);

        const parts = posed(FLOOR_FACING, 88);
        const sides = new Set<string>();
        for (let counter = 0; counter < C.numCounters; ++counter)
        {
            const panel = parts[C.firstCounterIndex + counter];
            sides.add(JSON.stringify(panel.dir));
            const reach = 0.5 * ((panel.dir.x != 0) ? C.pillarSize.x : C.pillarSize.y);
            expect(panel.dir.z).toBe(0);
            expect(Vector3DUtil.dot(panel.offset, panel.dir)).toBeCloseTo(reach + RELIEF_STEP, 9);
            expect(panel.offset.z).toBeCloseTo(middleZ, 9);
            expect(panel.scale).toEqual({x: C.counterSize, y: C.counterSize, z: 1});
            expectDigitsOnPanel(parts, FLOOR_FACING, counter);
        }
        expect(sides.size).toBe(C.numCounters);
    });

    it("are three on a wall, each with its digits upright as the room has up: one on its plate, over its pillar, " +
        "facing out of the wall, and one on its pillar's side to either hand, with nothing on the pillar's upper and " +
        "lower sides", () => {
        // The plate's lies between the pillar and the plate's upper edge, clear of both; a side's as far out of the
        // wall as it stands over a floor.
        const middleUp = 0.5 * C.plateSize.y - C.plateCounterInset - 0.5 * C.counterSize;
        const middleOut = C.plateSize.z + C.counterBottom + 0.5 * C.counterSize;
        expect(C.plateCounterInset).toBeGreaterThan(0);
        expect(middleUp - 0.5 * C.counterSize).toBeGreaterThan(0.5 * C.pillarSize.y);
        for (const facing of WALL_FACINGS)
        {
            const parts = posed(facing, 88);
            const seen = [...Array(C.numCounters).keys()].filter(counter => !isUnseen(parts, counter));
            expect(seen).toHaveLength(3);
            const sideWays: Vec3[] = [];
            for (const counter of seen)
            {
                const panel = parts[C.firstCounterIndex + counter];
                // Which way it faces in the room, and where it is from the middle of the cannon's place on the wall.
                const way = inRoom(facing, panel.dir);
                const middle = inRoom(facing, panel.offset);
                expect(panel.scale).toEqual({x: C.counterSize, y: C.counterSize, z: 1});
                // None faces up or down the room, and each one's digits stand the way the room is up.
                expect(way.y).toBeCloseTo(0, 9);
                expectAxis(inRoom(facing, panelAxes(facing, panel.dir).up), {x: 0, y: 1, z: 0});
                expectDigitsOnPanel(parts, facing, counter);
                if (Vector3DUtil.dot(way, facing) > 0.5)
                {
                    // The plate's: straight up the wall from the cannon's middle, and just proud of the plate.
                    expect(middle.y).toBeCloseTo(middleUp, 9);
                    expect(Vector3DUtil.dot(middle, facing)).toBeCloseTo(C.plateSize.z + RELIEF_STEP, 9);
                    expect(Math.hypot(middle.x, middle.z)).toBeCloseTo(C.plateSize.z + RELIEF_STEP, 9);
                }
                else
                {
                    // A side's: level with the cannon's middle, and just proud of the pillar's side.
                    sideWays.push(way);
                    expect(Vector3DUtil.dot(way, facing)).toBeCloseTo(0, 9);
                    expect(middle.y).toBeCloseTo(0, 9);
                    expect(Vector3DUtil.dot(middle, way)).toBeCloseTo(0.5 * C.pillarSize.x + RELIEF_STEP, 9);
                    expect(Vector3DUtil.dot(middle, facing)).toBeCloseTo(middleOut, 9);
                }
            }
            // One along the wall each way.
            expect(sideWays).toHaveLength(2);
            expect(Vector3DUtil.dot(sideWays[0], sideWays[1])).toBeCloseTo(-1, 9);
        }
    });

    it(`show the balls left, from ${CANNON_BALL_COUNT} down to none, reading the right way round: on every side of the ` +
        "pillar on a floor, and on the plate and the pillar's two sides on whichever wall it stands", () => {
        for (const facing of [FLOOR_FACING, ...WALL_FACINGS])
        {
            const full = posed(facing, 88);
            const seen = [...Array(C.numCounters).keys()].filter(counter => !isUnseen(full, counter));
            expect(seen).toHaveLength((facing == FLOOR_FACING) ? C.numCounters : 3);
            for (let ballsLeft = 0; ballsLeft <= CANNON_BALL_COUNT; ++ballsLeft)
            {
                const parts = posed(facing, ballsLeft);
                for (let counter = 0; counter < C.numCounters; ++counter)
                {
                    if (seen.includes(counter))
                        expect(readCounter(parts, facing, counter), `${ballsLeft} on counter ${counter}`).toBe(`${ballsLeft}`);
                    else
                        expect(isUnseen(parts, counter), `${ballsLeft} on counter ${counter}`).toBe(true);
                }
            }
        }
    });

    it("go where each face has them as a cannon is moved from one to another, its parts posed anew", () => {
        const aim = CannonAimUtil.getLocalDirection({yaw: 0, pitch: 0});
        const parts = CannonCompositionUtil.buildParts();
        for (const facing of [WALL_FACINGS[0], FLOOR_FACING, WALL_FACINGS[3], WALL_FACINGS[1], FLOOR_FACING])
        {
            CannonCompositionUtil.pose(parts, facing, aim, 17);
            expect(parts).toEqual(posed(facing, 17));
        }
    });

    it("show the balls left wherever a cannon is composed, on a floor or a wall", () => {
        for (const facing of [FLOOR_FACING, WALL_FACINGS[1]])
        {
            for (let ballsLeft = 0; ballsLeft <= CANNON_BALL_COUNT; ++ballsLeft)
            {
                const state = {...CannonStateUtil.decode(""), ballsLeft};
                // As anything that draws one composes it, from the object alone.
                const cannon = new AddObjectSignal(HUB_ID, "", "", CANNON_TYPE_INDEX, "a-cannon",
                    new ObjectTransform({...CANNON_SPOT}, {...facing}, {x: 1, y: 1, z: 1}),
                    {[ObjectMetadataKeyEnumMap.CannonState]: new EncodableByteString(CannonStateUtil.encode(state))});
                const composed: InstancedMeshCompositionPart[] = [];
                ObjectCompositionUtil.decode(cannon, {}, composed);
                // (Aimed as its state keeps the aim.)
                const kept = CannonStateUtil.decode(CannonStateUtil.encode(state));
                const expected = CannonCompositionUtil.buildParts();
                CannonCompositionUtil.pose(expected, facing,
                    CannonAimUtil.getLocalDirection(CannonStateUtil.getShownAim(kept, facing)), ballsLeft);
                expect(composed).toEqual(expected);
            }
        }
    });

    it("light their digits green, or red while warning, dimmed toward the black behind them, and black while not lit", () => {
        const parts = posed(FLOOR_FACING, 12);
        const digits = () => parts.slice(C.firstSegmentIndex).map(part => part.color);
        const panels = () => parts.slice(C.firstCounterIndex, C.firstSegmentIndex).map(part => part.color);
        const allOf = (color: Vec3) => Array(C.numCounters * SEGMENTS_PER_COUNTER).fill(color);
        expect(CannonCompositionUtil.setCounterLight(parts, 1, false, true)).toBe(false);
        expect(digits()).toEqual(allOf(C.digitColor));
        expect(CannonCompositionUtil.setCounterLight(parts, 1, true, true)).toBe(true);
        expect(digits()).toEqual(allOf(C.digitWarningColor));
        // Told again, nothing changes.
        expect(CannonCompositionUtil.setCounterLight(parts, 1, true, true)).toBe(false);

        const halfway = (from: Vec3, to: Vec3) => ({x: (from.x + to.x) / 2, y: (from.y + to.y) / 2, z: (from.z + to.z) / 2});
        expect(CannonCompositionUtil.setCounterLight(parts, 0.5, true, true)).toBe(true);
        expect(digits()).toEqual(allOf(halfway(C.counterColor, C.digitWarningColor)));
        expect(CannonCompositionUtil.setCounterLight(parts, 0.5, false, true)).toBe(true);
        expect(digits()).toEqual(allOf(halfway(C.counterColor, C.digitColor)));
        for (const [glow, warning, lit] of [[0, false, true], [0, true, true], [1, true, false], [1, false, false]] as const)
        {
            CannonCompositionUtil.setCounterLight(parts, glow, warning, lit);
            expect(digits()).toEqual(allOf(C.counterColor));
        }
        expect(panels()).toEqual(Array(C.numCounters).fill(C.counterColor));
    });
});

describe("a sphere swept through a room", () => {
    const box: AABB3 = {center: {x: 0, y: 0, z: 0}, halfSize: {x: 1, y: 0.5, z: 0.75}};

    it("strikes a box where it first touches it, as a slow walk along the same way finds", () => {
        fc.assert(fc.property(vec3In(-4, 4), vec3In(-4, 4), scaled(0, 0.8), (from, to, radius) => {
            const hit = Geometry3DUtil.castSphereAgainstAABB(from, to, radius, box);
            const steps = 400;
            if (hit.hitNormal == undefined)
            {
                for (let i = 0; i <= steps; ++i)
                    expect(distanceToBox(along(from, to, i / steps), box)).toBeGreaterThan(radius - 0.000001);
                return;
            }
            expect(hit.hitRayScale).toBeGreaterThanOrEqual(0);
            expect(hit.hitRayScale).toBeLessThanOrEqual(1);
            const touching = distanceToBox(along(from, to, hit.hitRayScale), box);
            // Touching as it sets off, it may reach in; struck on its way, it only touches.
            if (hit.hitRayScale > 0)
                expect(touching).toBeCloseTo(radius, 6);
            else
                expect(touching).toBeLessThanOrEqual(radius + 0.000001);
            for (let i = 0; i < steps && i / steps < hit.hitRayScale - 0.000001; ++i)
                expect(distanceToBox(along(from, to, i / steps), box)).toBeGreaterThan(radius - 0.000001);
            expect(Vector3DUtil.length(hit.hitNormal)).toBeCloseTo(1, 6);
        }), {numRuns: 300});
    });

    it("strikes a face head on at its radius from it, with the way out of the box there", () => {
        const hit = Geometry3DUtil.castSphereAgainstAABB({x: -5, y: 0, z: 0}, {x: 5, y: 0, z: 0}, 0.25, box);
        expect(hit.hitRayScale).toBeCloseTo((5 - 1 - 0.25) / 10, 12);
        expectAxis(hit.hitNormal, {x: -1, y: 0, z: 0});
        // Past a corner by less than its radius, it strikes the corner, and is sent off at a slant.
        const corner = Geometry3DUtil.castSphereAgainstAABB({x: -5, y: 0.6, z: 0.85}, {x: 5, y: 0.6, z: 0.85}, 0.25, box);
        expect(corner.hitNormal).toBeDefined();
        expect(corner.hitNormal!.y).toBeGreaterThan(0);
        expect(corner.hitNormal!.z).toBeGreaterThan(0);
        // Past it by more, it misses.
        expect(Geometry3DUtil.castSphereAgainstAABB({x: -5, y: 0.8, z: 0}, {x: 5, y: 0.8, z: 0}, 0.25, box).hitNormal)
            .toBeUndefined();
    });

    it("is a ray with no radius, which stops at the face it comes to", () => {
        const hit = Geometry3DUtil.castSphereAgainstAABB({x: 0.2, y: 3, z: -0.3}, {x: 0.2, y: -3, z: -0.3}, 0, box);
        expect(hit.hitRayScale).toBeCloseTo(2.5 / 6, 9);
        expectAxis(hit.hitNormal, {x: 0, y: 1, z: 0});
        expect(Geometry3DUtil.castSphereAgainstAABB({x: 1.01, y: 3, z: 0}, {x: 1.01, y: -3, z: 0}, 0, box).hitNormal)
            .toBeUndefined();
    });

    it("strikes another sphere where the two first touch, and none it is leaving", () => {
        fc.assert(fc.property(vec3In(-4, 4), vec3In(-4, 4), vec3In(-1, 1), scaled(0.05, 0.6), scaled(0.05, 0.6),
            (from, to, other, radius, otherRadius) => {
                const hit = Geometry3DUtil.castSphereAgainstSphere(from, to, radius, other, otherRadius);
                const reach = radius + otherRadius;
                if (hit.hitNormal == undefined)
                {
                    // Never nearer than touching, unless it only moves away.
                    for (let i = 0; i <= 200; ++i)
                        expect(dist(along(from, to, i / 200), other)).toBeGreaterThan(reach - 0.000001);
                    return;
                }
                const at = along(from, to, hit.hitRayScale);
                if (hit.hitRayScale > 0)
                    expect(dist(at, other)).toBeCloseTo(reach, 6);
                else
                    expect(dist(at, other)).toBeLessThanOrEqual(reach + 0.000001);
                expect(angleBetween(hit.hitNormal, Vector3DUtil.subtract(at, other))).toBeLessThan(0.0001);
            }), {numRuns: 300});
    });

    // An upright cylinder standing in a box: as wide as the box is along x, and as tall.
    const cylinder: AABB3 = {center: {x: 0.5, y: -0.25, z: 0.25}, halfSize: {x: 0.6, y: 1.1, z: 0.6}};
    const acrossFromCylinder = (point: Vec3): number =>
        Math.hypot(point.x - cylinder.center.x, point.z - cylinder.center.z);
    const distanceToCylinder = (point: Vec3): number => Math.hypot(
        Math.max(0, acrossFromCylinder(point) - cylinder.halfSize.x),
        Math.max(0, Math.abs(point.y - cylinder.center.y) - cylinder.halfSize.y));

    it("strikes an upright cylinder where it first touches it, as a slow walk along the same way finds, with the way " +
        "out of it there: level off its side, straight up or down off an end", () => {
        fc.assert(fc.property(vec3In(-4, 4), vec3In(-4, 4), scaled(0, 0.8), (from, to, radius) => {
            const hit = Geometry3DUtil.castSphereAgainstUprightCylinder(from, to, radius, cylinder);
            const steps = 400;
            if (hit.hitNormal == undefined)
            {
                for (let i = 0; i <= steps; ++i)
                    expect(distanceToCylinder(along(from, to, i / steps))).toBeGreaterThan(radius - 0.000001);
                return;
            }
            expect(hit.hitRayScale).toBeGreaterThanOrEqual(0);
            expect(hit.hitRayScale).toBeLessThanOrEqual(1);
            const at = along(from, to, hit.hitRayScale);
            const touching = distanceToCylinder(at);
            if (hit.hitRayScale > 0)
                expect(touching).toBeCloseTo(radius, 6);
            else
                expect(touching).toBeLessThanOrEqual(radius + 0.000001);
            for (let i = 0; i < steps && i / steps < hit.hitRayScale - 0.000001; ++i)
                expect(distanceToCylinder(along(from, to, i / steps))).toBeGreaterThan(radius - 0.000001);
            expect(Vector3DUtil.length(hit.hitNormal)).toBeCloseTo(1, 6);

            // (Clear of the cylinder itself, and of the rim between its side and an end.)
            const height = at.y - cylinder.center.y;
            if (touching < 0.001)
                return;
            if (Math.abs(height) < cylinder.halfSize.y - 0.001)
            {
                expect(hit.hitNormal.y).toBe(0);
                expect(angleBetween(hit.hitNormal, {x: at.x - cylinder.center.x, y: 0, z: at.z - cylinder.center.z}))
                    .toBeLessThan(0.0001);
            }
            else if (acrossFromCylinder(at) < cylinder.halfSize.x - 0.001)
                expectAxis(hit.hitNormal, {x: 0, y: Math.sign(height), z: 0});
        }), {numRuns: 300});
    });

    it("strikes that cylinder's side at its radius from it whichever way it comes, misses the corners of the box it " +
        "stands in, and comes off the rim of its top between up and out", () => {
        const {center, halfSize} = cylinder;
        const radius = 0.25;
        for (const degrees of [0, 30, 45, 90, 135, 200, 315])
        {
            const way = levelWay(degrees);
            const hit = Geometry3DUtil.castSphereAgainstUprightCylinder(Vector3DUtil.add(center, Vector3DUtil.scale(way, 5)),
                center, radius, cylinder);
            expect(hit.hitRayScale).toBeCloseTo((5 - halfSize.x - radius) / 5, 9);
            expect(dist(hit.hitNormal!, way)).toBeLessThan(0.000001);
        }

        // Past a corner of the box, nearer than the corner reaches with the sphere, but farther than the side does.
        const passing = halfSize.x + radius + 0.05;
        expect(passing).toBeLessThan(Math.SQRT2 * halfSize.x + radius);
        const beside = Vector3DUtil.add(center, Vector3DUtil.scale(levelWay(45), passing));
        const [a, b] = [-4, 4].map(far => Vector3DUtil.add(beside, Vector3DUtil.scale(levelWay(135), far)));
        expect(Geometry3DUtil.castSphereAgainstAABB(a, b, radius, cylinder).hitNormal).toBeDefined();
        expect(Geometry3DUtil.castSphereAgainstUprightCylinder(a, b, radius, cylinder).hitNormal).toBeUndefined();

        // Down onto its top, and down past its top's rim, within the sphere's radius of it.
        const top = center.y + halfSize.y;
        const onto = Geometry3DUtil.castSphereAgainstUprightCylinder({x: center.x + 0.2, y: top + 3, z: center.z},
            {x: center.x + 0.2, y: top - 1, z: center.z}, radius, cylinder);
        expect(onto.hitRayScale).toBeCloseTo((3 - radius) / 4, 9);
        expectAxis(onto.hitNormal, {x: 0, y: 1, z: 0});
        const rim = Geometry3DUtil.castSphereAgainstUprightCylinder({x: center.x + halfSize.x + 0.15, y: top + 3, z: center.z},
            {x: center.x + halfSize.x + 0.15, y: top - 1, z: center.z}, radius, cylinder);
        expect(rim.hitRayScale).toBeCloseTo((3 - Math.sqrt(radius * radius - 0.15 * 0.15)) / 4, 9);
        expect(rim.hitNormal!.x).toBeCloseTo(0.15 / radius, 6);
        expect(rim.hitNormal!.y).toBeCloseTo(Math.sqrt(radius * radius - 0.15 * 0.15) / radius, 6);
        expect(rim.hitNormal!.z).toBeCloseTo(0, 9);
    });

    it("reaches into a box exactly when it comes nearer than its radius", () => {
        fc.assert(fc.property(vec3In(-3, 3), scaled(0.01, 1.5), (center, radius) => {
            const distance = distanceToBox(center, box);
            if (Math.abs(distance - radius) > 0.000001)
                expect(Geometry3DUtil.sphereOverlapsAABB(center, radius, box)).toBe(distance < radius);
        }));
    });
});

describe("what a ball strikes in a room, and what a blast reaches", () => {
    const NONE = new Set<string>();
    // Along the lower storey, from west to east.
    const from: Vec3 = {x: 8, y: FLIGHT_Y, z: 16.25};
    const to: Vec3 = {x: 24, y: FLIGHT_Y, z: 16.25};
    const cast = (a: Vec3 = from, b: Vec3 = to, ignored: ReadonlySet<string> = NONE) =>
        PhysicsManager.castSphere(HUB_ID, a, b, CANNON_BALL_RADIUS, ignored);

    beforeEach(async () => {
        await harness.loadRoom(HUB_ID);
    });

    it("is nothing, in the open", () => {
        expect(cast()).toBeUndefined();
    });

    it("is the first block in its way, at the ball's radius from it", () => {
        const block = placeBlock(16.25, FLIGHT_Y, 16.25);
        placeBlock(20.25, FLIGHT_Y, 16.25);
        const hit = cast()!;
        expect(hit.block).toEqual({row: block.row, col: block.col, collisionLayer: block.layer});
        expect(hit.object).toBeUndefined();
        expect(hit.center.x).toBeCloseTo(16 - CANNON_BALL_RADIUS, 9);
        expect(hit.contact.x).toBeCloseTo(16, 9);
        expectAxis(hit.normal, {x: -1, y: 0, z: 0});
        expect(hit.rayScale).toBeCloseTo((16 - CANNON_BALL_RADIUS - from.x) / (to.x - from.x), 9);
    });

    it("is the room's own floor, and its ceiling, which are neither block nor object", () => {
        const down = cast({x: 12, y: 2, z: 12}, {x: 12, y: -2, z: 12})!;
        expect(down.center.y).toBeCloseTo(CANNON_BALL_RADIUS, 9);
        expectAxis(down.normal, {x: 0, y: 1, z: 0});
        expect(down.block).toBeUndefined();
        expect(down.object).toBeUndefined();

        // The upper storey's ceiling is the room's.
        const up = cast({x: 12, y: MAX_ROOM_Y - 2, z: 12}, {x: 12, y: MAX_ROOM_Y + 2, z: 12})!;
        expect(up.center.y).toBeCloseTo(MAX_ROOM_Y - CANNON_BALL_RADIUS, 9);
        expectAxis(up.normal, {x: 0, y: -1, z: 0});
    });

    it("is never the room's sides, past its blocks: a ball goes out through a gap in the wall", () => {
        // The boundary wall stops it.
        expect(cast({x: 4, y: FLIGHT_Y, z: 16.25}, {x: -6, y: FLIGHT_Y, z: 16.25})?.block).toBeDefined();
        // Taken down in its way, nothing does.
        for (let x = 0.5 * VOXEL_CELL_SIZE; x < 4; x += VOXEL_CELL_SIZE)
        {
            for (const z of [15.75, 16.25, 16.75])
            {
                for (const y of [FLIGHT_Y - COLLISION_LAYER_HEIGHT, FLIGHT_Y, FLIGHT_Y + COLLISION_LAYER_HEIGHT])
                {
                    const voxel = VoxelQueryUtil.getVoxel(getRoom().voxelGrid.voxels,
                        VoxelQueryUtil.getVoxelRowFromWorldZ(z), VoxelQueryUtil.getVoxelColFromWorldX(x))!;
                    voxel.blockLayerMask &= ~(1 << VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(y));
                }
            }
        }
        expect(cast({x: 4, y: FLIGHT_Y, z: 16.25}, {x: -6, y: FLIGHT_Y, z: 16.25})).toBeUndefined();
        expect(cast({x: -6, y: FLIGHT_Y, z: 16.25}, {x: -30, y: FLIGHT_Y, z: 16.25})).toBeUndefined();
    });

    it("is a player's body, but no ghost's, nor one it is told to pass", async () => {
        const user = await join("someone", {x: 16.25, y: STANDING_Y, z: 16.25});
        const playerId = harness.getPlayerObject("someone")!.objectId;
        const low = {from: {...from, y: STANDING_Y}, to: {...to, y: STANDING_Y}};
        const hit = cast(low.from, low.to)!;
        expect(hit.object?.objectId).toBe(playerId);
        expect(hit.center.x).toBeCloseTo(16.25 - PLAYER_RADIUS_XZ - CANNON_BALL_RADIUS, 6);
        expect(cast(low.from, low.to, new Set([playerId]))).toBeUndefined();
        // Over their head, it passes.
        expect(cast({...from, y: PLAYER_HEIGHT + CANNON_BALL_RADIUS + 0.1}, {...to, y: PLAYER_HEIGHT + CANNON_BALL_RADIUS + 0.1}))
            .toBeUndefined();

        await harness.disconnectUser(user);
        await join("a-ghost", {x: 16.25, y: STANDING_Y, z: 16.25}, {userType: UserTypeEnumMap.Admin,
            playerMetadata: {[ObjectMetadataKeyEnumMap.AdminPrefs]: AdminPrefsUtil.encode({ghostMode: true})}});
        expect(AdminPrefsUtil.isGhost(harness.getPlayerObject("a-ghost"))).toBe(true);
        expect(cast(low.from, low.to)).toBeUndefined();
    });

    it("meets a player as a round body: by their side at its radius from their middle line whichever way it comes, " +
        "past the corners of their box, and by the top of their head from above", async () => {
        const at = {x: 16.25, y: STANDING_Y, z: 16.25};
        await join("someone", at);
        const playerId = harness.getPlayerObject("someone")!.objectId;
        const reach = PLAYER_RADIUS_XZ + CANNON_BALL_RADIUS;
        for (const degrees of [0, 45, 90, 160, 225, 300])
        {
            const way = levelWay(degrees);
            const hit = cast(Vector3DUtil.add(at, Vector3DUtil.scale(way, 4)), at)!;
            expect(hit.object?.objectId).toBe(playerId);
            expect(Math.hypot(hit.center.x - at.x, hit.center.z - at.z)).toBeCloseTo(reach, 6);
            expect(dist(hit.normal, way)).toBeLessThan(0.000001);
        }

        // Past a corner of the box they are to all else, where a box would be struck: a miss. A little nearer: a hit.
        const passing = reach + 0.05;
        expect(passing).toBeLessThan(Math.SQRT2 * PLAYER_RADIUS_XZ + CANNON_BALL_RADIUS);
        const pass = (across: number) => {
            const beside = Vector3DUtil.add(at, Vector3DUtil.scale(levelWay(45), across));
            return cast(Vector3DUtil.add(beside, Vector3DUtil.scale(levelWay(135), -3)),
                Vector3DUtil.add(beside, Vector3DUtil.scale(levelWay(135), 3)));
        };
        expect(pass(passing)).toBeUndefined();
        expect(pass(passing - 0.1)?.object?.objectId).toBe(playerId);

        // (From under the slab over the lower storey.)
        const down = cast({x: at.x + 0.1, y: SLAB_UNDERSIDE_Y - 2 * CANNON_BALL_RADIUS, z: at.z},
            {x: at.x + 0.1, y: STANDING_Y, z: at.z})!;
        expect(down.object?.objectId).toBe(playerId);
        expect(down.center.y).toBeCloseTo(PLAYER_HEIGHT + CANNON_BALL_RADIUS, 6);
        expectAxis(down.normal, {x: 0, y: 1, z: 0});
    });

    it("is a mirror it closes on, by the way the mirror faces whichever part of it the ball touches, and never one it " +
        "leaves; past the mirror's edge, the wall it hangs on", () => {
        const {mirror, box} = hangMirror();
        const front = box.center.x - box.halfSize.x;
        const level = {from: {x: 12, y: MIRROR_SPOT.y, z: MIRROR_SPOT.z}, to: {x: 17, y: MIRROR_SPOT.y, z: MIRROR_SPOT.z}};
        const hit = cast(level.from, level.to)!;
        expect(hit.object?.objectId).toBe(mirror.objectId);
        expect(hit.block).toBeUndefined();
        expect(hit.center.x).toBeCloseTo(front - CANNON_BALL_RADIUS, 9);
        expect(front).toBeLessThan(MIRROR_SPOT.x);
        expectAxis(hit.normal, {x: -1, y: 0, z: 0});

        // Just past its edge, where its box alone would send a ball off at a slant: the same way.
        const edgeZ = box.center.z + box.halfSize.z + 0.02;
        const byEdge = cast({...level.from, z: edgeZ}, {...level.to, z: edgeZ})!;
        expect(byEdge.object?.objectId).toBe(mirror.objectId);
        expectAxis(byEdge.normal, {x: -1, y: 0, z: 0});
        // Farther past it, the wall is struck first.
        const pastZ = box.center.z + box.halfSize.z + 0.2;
        const past = cast({...level.from, z: pastZ}, {...level.to, z: pastZ})!;
        expect(past.object).toBeUndefined();
        expect(past.block).toBeDefined();
        expect(past.center.x).toBeCloseTo(MIRROR_SPOT.x - CANNON_BALL_RADIUS, 9);

        // Touching it, a ball that flies off it, or along it, is free of it.
        expect(cast(hit.center, level.from)).toBeUndefined();
        expect(cast(hit.center, {...hit.center, z: hit.center.z - 0.4})).toBeUndefined();
    });

    it("is an NPC it closes on, round as a player is, and never one it leaves, even from inside it", () => {
        const {npc, box} = standNpc({x: 16.25, z: 16.25});
        const reach = box.halfSize.x + CANNON_BALL_RADIUS;
        const low = {from: {x: 8, y: STANDING_Y, z: box.center.z}, to: {x: 24, y: STANDING_Y, z: box.center.z}};
        const hit = cast(low.from, low.to)!;
        expect(hit.object?.objectId).toBe(npc.objectId);
        expect(hit.center.x).toBeCloseTo(box.center.x - reach, 6);
        expectAxis(hit.normal, {x: -1, y: 0, z: 0});

        // To one side of its middle line: off its side there, level.
        const aside = 0.3;
        const glancing = cast({...low.from, z: box.center.z + aside}, {...low.to, z: box.center.z + aside})!;
        expect(glancing.center.x).toBeCloseTo(box.center.x - Math.sqrt(reach * reach - aside * aside), 6);
        expect(glancing.normal.y).toBe(0);
        expect(angleBetween(glancing.normal, {x: glancing.center.x - box.center.x, y: 0, z: aside})).toBeLessThan(0.000001);

        expect(cast(hit.center, low.from)).toBeUndefined();
        expect(cast({x: box.center.x - 0.1, y: STANDING_Y, z: box.center.z}, low.from)).toBeUndefined();
        // Over its head, it passes.
        const over = box.center.y + box.halfSize.y + CANNON_BALL_RADIUS + 0.1;
        expect(cast({...low.from, y: over}, {...low.to, y: over})).toBeUndefined();
        // Ignored, it is passed.
        expect(cast(low.from, low.to, new Set([npc.objectId]))).toBeUndefined();
    });

    it("is a cannon in its way, as solid as a block, with the way out of its box where the two touch, but not one it " +
        "leaves, nor the one it sets off from inside", () => {
        const cannon = placeCannon({on: false}, {x: 16.5, y: 0, z: 16.5});
        const box = PhysicsColliderStateUtil.getObjectColliderState(CANNON_TYPE_INDEX, cannon.transform)!.hitbox;
        const low = {from: {x: 8, y: 0.5, z: 16.5}, to: {x: 24, y: 0.5, z: 16.5}};
        const hit = cast(low.from, low.to)!;
        expect(hit.object?.objectId).toBe(cannon.objectId);
        expect(hit.center.x).toBeCloseTo(box.center.x - box.halfSize.x - CANNON_BALL_RADIUS, 9);
        expectAxis(hit.normal, {x: -1, y: 0, z: 0});
        // Over its top edge by less than its radius: off that edge, aslant, not as off its face up.
        const above = 0.15;
        const edge = {x: box.center.x - box.halfSize.x, y: box.center.y + box.halfSize.y, z: 16.5};
        const byEdge = cast({...low.from, y: edge.y + above}, {...low.to, y: edge.y + above})!;
        expect(byEdge.object?.objectId).toBe(cannon.objectId);
        expect(byEdge.center.x).toBeCloseTo(edge.x - Math.sqrt(CANNON_BALL_RADIUS ** 2 - above ** 2), 6);
        expect(angleBetween(byEdge.normal, Vector3DUtil.subtract(byEdge.center, edge))).toBeLessThan(0.000001);
        expect(byEdge.normal.x).toBeLessThan(-0.5);
        expect(byEdge.normal.y).toBeGreaterThan(0.5);

        // Touching it, a ball that flies off it is free of it.
        expect(cast(hit.center, low.from)).toBeUndefined();
        expect(cast(byEdge.center, {...low.from, y: 3})).toBeUndefined();
        // From its own barrel's mouth, which is inside its box, a ball flies free of it.
        const muzzle = CannonAimUtil.getMuzzle(cannon.transform.pos, cannon.transform.dir, {yaw: 0, pitch: 0});
        expect(distanceToBox(muzzle, box)).toBe(0);
        const away = Vector3DUtil.add(muzzle, Vector3DUtil.scale(CannonAimUtil.getDirection(cannon.transform.dir, {yaw: 0, pitch: 0}), 6));
        expect(cast(muzzle, away)).toBeUndefined();
    });

    it("is another ball, and never what hangs flat on a wall or blows from it", () => {
        const fan = new AddObjectSignal(HUB_ID, ADMIN.id, ADMIN.userName, FAN_TYPE_INDEX, "a-fan",
            new ObjectTransform({x: 16.5, y: 0, z: 16.5}, {...FLOOR_FACING}, {...UNIT_VEC3}));
        expect(ServerObjectManager.addObjectAsServer(getRoom(), ADMIN, fan)).toBe(true);
        expect(cast({x: 8, y: CANNON_BALL_RADIUS + 0.01, z: 16.5}, {x: 24, y: CANNON_BALL_RADIUS + 0.01, z: 16.5})).toBeUndefined();

        expect(CannonBallUtil.launch(getRoom(), {x: 16, y: FLIGHT_Y, z: 16.25}, {x: 0, y: 0, z: 0})).toBe(true);
        const [ball] = getBalls();
        const hit = cast()!;
        expect(hit.object?.objectId).toBe(ball.objectId);
        expect(hit.center.x).toBeCloseTo(16 - 2 * CANNON_BALL_RADIUS, 6);
        expect(hit.contact.x).toBeCloseTo(16 - CANNON_BALL_RADIUS, 6);
    });

    it("reaches every block and body its blast comes nearer than its radius to, and none it only touches", async () => {
        const near = placeBlock(16.25, FLIGHT_Y, 16.25);
        const far = placeBlock(17.25, FLIGHT_Y, 16.25);
        await join("someone", {x: 15.75 - PLAYER_RADIUS_XZ, y: FLIGHT_Y, z: 16.25});
        const playerId = harness.getPlayerObject("someone")!.objectId;

        const reached = PhysicsManager.getReachedBySphere(HUB_ID, {x: 16, y: FLIGHT_Y, z: 16.25}, CANNON_BALL_BLAST_RADIUS);
        expect(reached.blocks).toEqual([{row: near.row, col: near.col, collisionLayer: near.layer}]);
        expect(reached.objects.map(object => object.objectId)).toEqual([playerId]);
        expect(hasBlock(far)).toBe(true);
        // A blast right at the far block's face reaches it, and not the body a blast's reach and more away.
        const there = PhysicsManager.getReachedBySphere(HUB_ID, {x: 17, y: FLIGHT_Y, z: 16.25}, CANNON_BALL_BLAST_RADIUS);
        expect(there.blocks).toContainEqual({row: far.row, col: far.col, collisionLayer: far.layer});
        expect(there.objects).toEqual([]);
    });
});

describe("a cannon in a room", () => {
    it("is anyone's to add, in their own name, for its price, on a floor or a wall but no ceiling", async () => {
        await harness.loadRoom(HUB_ID);
        const room = getRoom();
        expect(CannonObjectTypeConfig.price).toBe(CANNON_PRICE_DOLLARS);
        expect(CannonObjectTypeConfig.persistent).toBe(true);
        for (const user of [GUEST, MEMBER, ADMIN])
        {
            expect(ObjectUpdateUtil.canAddObject(user, room, cannonSignal(user, "new"))).toBe(true);
            expect(ObjectUpdateUtil.canAddObject(user, room, cannonSignal(ADMIN.id == user.id ? GUEST : ADMIN, "new"))).toBe(false);
        }

        const place = (center: Vec3, facing: Vec3) => ObjectAttachmentUtil.findPlacement(room, CANNON_TYPE_INDEX, center,
            facing, {...UNIT_VEC3}, transform => ObjectUpdateUtil.canAddObject(GUEST, room,
                new AddObjectSignal(HUB_ID, GUEST.id, GUEST.userName, CANNON_TYPE_INDEX, "new", transform)));
        expect(place(CANNON_SPOT, FLOOR_FACING)).toBeDefined();
        expect(ObjectAttachmentUtil.allowsFacing(CANNON_TYPE_INDEX, CEILING_FACING)).toBe(false);
        expect(place({x: CANNON_SPOT.x, y: SLAB_UNDERSIDE_Y, z: CANNON_SPOT.z}, CEILING_FACING)).toBeUndefined();
        // On a pillar's side, a block's width off the floor.
        for (const x of [20.25, 20.75])
        {
            for (const z of [20.25, 20.75])
            {
                for (let y = 0.5 * COLLISION_LAYER_HEIGHT; y < 3; y += COLLISION_LAYER_HEIGHT)
                    placeBlock(x, y, z);
            }
        }
        for (const facing of WALL_FACINGS)
        {
            expect(ObjectAttachmentUtil.allowsFacing(CANNON_TYPE_INDEX, facing)).toBe(true);
            const onWall = place({x: 20.5 + 0.5 * facing.x, y: 1.5, z: 20.5 + 0.5 * facing.z}, facing);
            expect(onWall, `on a wall facing ${JSON.stringify(facing)}`).toBeDefined();
        }
    });

    it("is none of a single-player room's, where nothing would play it", () => {
        const room = harness.seedRoom("singleAAAAAAAAAAAAAA", RoomTypeEnumMap.SinglePlayer);
        expect(CannonObjectTypeConfig.canUserAddObject(ADMIN, room, cannonSignal(ADMIN, "new", CANNON_SPOT, FLOOR_FACING,
            CannonStateUtil.encodeSwitch(true), room.id))).toBe(false);
    });

    it("stands in a cube of its own, as solid as a block, a little short of the cube's far side", async () => {
        await harness.loadRoom(HUB_ID);
        const collider = CannonObjectTypeConfig.components.spawnedByAny.collider;
        expect(collider.applyHardCollisionToOthers).toBe(true);
        expect(collider.baseHitboxSize).toEqual({sizeX: 1, sizeY: 1, sizeZ: 1 - ATTACHMENT_HITBOX_INSET});
        for (const facing of [FLOOR_FACING, ...WALL_FACINGS])
        {
            const {hitbox} = PhysicsColliderStateUtil.getObjectColliderState(CANNON_TYPE_INDEX,
                new ObjectTransform({...CANNON_SPOT}, {...facing}, {...UNIT_VEC3}))!;
            // From the face it stands on, out along its facing.
            const out = Vector3DUtil.dot(Vector3DUtil.subtract(hitbox.center, CANNON_SPOT), facing);
            expect(out).toBeCloseTo(0.5 * (1 - ATTACHMENT_HITBOX_INSET), 6);
        }
        // Nothing else may stand where it does, nor so near as to reach into its cube.
        placeCannon({on: false});
        expect(ObjectUpdateUtil.canAddObject(GUEST, getRoom(), cannonSignal(GUEST, "another"))).toBe(false);
        expect(ObjectUpdateUtil.canAddObject(GUEST, getRoom(), cannonSignal(GUEST, "another",
            {x: CANNON_SPOT.x + 0.5, y: 0, z: CANNON_SPOT.z}))).toBe(false);
        expect(ObjectUpdateUtil.canAddObject(GUEST, getRoom(), cannonSignal(GUEST, "another",
            {x: CANNON_SPOT.x + 1, y: 0, z: CANNON_SPOT.z}))).toBe(true);
    });

    it("lets a user set its switch and nothing else of its state, and anyone move it or take it away", async () => {
        await harness.loadRoom(HUB_ID);
        const room = getRoom();
        const cannon = placeCannon({ballsLeft: 4, phase: CannonPhaseEnumMap.Waiting});
        const set = (value: string) => new SetObjectMetadataSignal(HUB_ID, cannon.objectId, STATE_KEY, value);
        for (const user of [GUEST, MEMBER, ADMIN])
        {
            expect(ObjectUpdateUtil.canSetObjectMetadata(user, room, set(CannonStateUtil.encodeSwitch(false)))).toBe(true);
            expect(ObjectUpdateUtil.canSetObjectMetadata(user, room, set(CannonStateUtil.encode({...NEW})))).toBe(false);
            expect(ObjectUpdateUtil.canSetObjectMetadata(user, room, new SetObjectMetadataSignal(HUB_ID, cannon.objectId,
                ObjectMetadataKeyEnumMap.FanColor, "!"))).toBe(false);
            expect(ObjectUpdateUtil.canRemoveObject(user, room, new RemoveObjectSignal(HUB_ID, cannon.objectId))).toBe(true);
            expect(ObjectUpdateUtil.canSetObjectTransform(user, room, new SetObjectTransformSignal(HUB_ID, cannon.objectId,
                new ObjectTransform({x: 12.5, y: 0, z: 12.5}, {...FLOOR_FACING}, {...UNIT_VEC3}), true))).toBe(true);
            // A placement, never a motion.
            expect(CannonObjectTypeConfig.canUserSetObjectTransform(user, room, cannon, new SetObjectTransformSignal(HUB_ID,
                cannon.objectId, cannon.transform, false))).toBe(false);
        }
        // Nor does one come with more than its switch.
        expect(ObjectUpdateUtil.canAddObject(GUEST, room, cannonSignal(GUEST, "forged", {x: 12.5, y: 0, z: 12.5}, FLOOR_FACING,
            CannonStateUtil.encode({...NEW, ballsLeft: CANNON_BALL_COUNT})))).toBe(false);

        // The switch thrown, the rest stays as the server kept it.
        expect(ObjectUpdateUtil.setObjectMetadata(GUEST, room, set(CannonStateUtil.encodeSwitch(false)))).toBe(true);
        expect(stateOf(cannon)).toMatchObject({on: false, ballsLeft: 4, phase: CannonPhaseEnumMap.Waiting});
    });

    it("is held by a restricted zone against whoever the zone isn't kept for, as any object is", async () => {
        await harness.loadRoom(HUB_ID);
        const room = getRoom();
        const cannon = placeCannon();
        addRestrictedZone(room, {rowMin: VoxelQueryUtil.getVoxelRowFromWorldZ(CANNON_SPOT.z) - 2,
            rowMax: VoxelQueryUtil.getVoxelRowFromWorldZ(CANNON_SPOT.z) + 2,
            colMin: VoxelQueryUtil.getVoxelColFromWorldX(CANNON_SPOT.x) - 2,
            colMax: VoxelQueryUtil.getVoxelColFromWorldX(CANNON_SPOT.x) + 2}, MEMBER.userName);
        const off = new SetObjectMetadataSignal(HUB_ID, cannon.objectId, STATE_KEY, CannonStateUtil.encodeSwitch(false));
        const remove = new RemoveObjectSignal(HUB_ID, cannon.objectId);
        expect(ObjectUpdateUtil.canSetObjectMetadata(GUEST, room, off)).toBe(false);
        expect(ObjectUpdateUtil.canRemoveObject(GUEST, room, remove)).toBe(false);
        expect(ObjectUpdateUtil.canSetObjectMetadata(MEMBER, room, off)).toBe(true);
        expect(ObjectUpdateUtil.canRemoveObject(MEMBER, room, remove)).toBe(true);
        expect(ObjectUpdateUtil.canAddObject(GUEST, room, cannonSignal(GUEST, "new", {x: CANNON_SPOT.x, y: 0, z: CANNON_SPOT.z + 1})))
            .toBe(false);
    });

    it(`holds no more than ${ObjectCategoryConfigMap.getMaxCountPerRoom(CannonObjectTypeConfig.category)} of them`, async () => {
        await harness.loadRoom(HUB_ID);
        const most = ObjectCategoryConfigMap.getMaxCountPerRoom(CannonObjectTypeConfig.category);
        for (let i = 0; i < most; ++i)
            placeCannon({on: false}, {x: 6.5 + 2 * i, y: 0, z: 8.5}, FLOOR_FACING, `cannon-${i}`);
        expect(ObjectUpdateUtil.canAddObject(GUEST, getRoom(), cannonSignal(GUEST, "one-more", {x: 8.5, y: 0, z: 20.5}))).toBe(false);
    });
});

describe("paying for a cannon", () => {
    function add(user: ConnectedUser, objectId: string, pos: Vec3 = CANNON_SPOT): boolean
    {
        return ServerObjectManager.onAddObjectSignalReceived(user.socketUserContext, cannonSignal(user.user, objectId, pos));
    }

    it("takes its price from whoever adds it, as it is added, and tells them and the room", async () => {
        const user = await join("someone");
        const other = await join("another", {x: 20, y: STANDING_Y, z: 20});
        user.socketUserContext.inventory[DOLLAR] = CANNON_PRICE_DOLLARS + 3;
        forget(user);
        forget(other);

        expect(add(user, "mine")).toBe(true);
        expect(getRoom().objectById["mine"]).toBeDefined();
        expect(user.socketUserContext.inventory[DOLLAR]).toBe(3);
        expect(getPendingSignals(user, "inventorySignal").map((signal: InventorySignal) => signal.inventory[DOLLAR])).toEqual([3]);
        expect(getPendingSignals(other, "addObjectSignal").map((signal: AddObjectSignal) => signal.objectId)).toEqual(["mine"]);
        expect(getPendingSignals(other, "inventorySignal")).toEqual([]);
        // The row follows.
        expect(vi.mocked(DBInventoryUtil.addItem)).toHaveBeenLastCalledWith(user.user.id, DOLLAR, -CANNON_PRICE_DOLLARS);
    });

    it("refuses whoever has less than its price, who is told to take theirs away again, and pays nothing", async () => {
        const user = await join("someone");
        user.socketUserContext.inventory[DOLLAR] = CANNON_PRICE_DOLLARS - 1;
        forget(user);
        expect(add(user, "mine")).toBe(false);
        expect(getRoom().objectById["mine"]).toBeUndefined();
        expect(user.socketUserContext.inventory[DOLLAR]).toBe(CANNON_PRICE_DOLLARS - 1);
        expect(removalsSentTo(user)).toEqual(["mine"]);
        expect(getPendingSignals(user, "inventorySignal")).toEqual([]);

        // With nothing at all, the same.
        delete user.socketUserContext.inventory[DOLLAR];
        expect(add(user, "mine")).toBe(false);
    });

    it("takes nothing for one the room refuses, however much its user has", async () => {
        const user = await join("someone");
        user.socketUserContext.inventory[DOLLAR] = 5 * CANNON_PRICE_DOLLARS;
        // In mid-air, where nothing holds it up.
        expect(add(user, "floating", {x: CANNON_SPOT.x, y: 2, z: CANNON_SPOT.z})).toBe(false);
        expect(add(user, "first")).toBe(true);
        // Where one already stands.
        expect(add(user, "second")).toBe(false);
        expect(user.socketUserContext.inventory[DOLLAR]).toBe(4 * CANNON_PRICE_DOLLARS);
    });

    it("takes it each time, down to what is left", async () => {
        const user = await join("someone");
        user.socketUserContext.inventory[DOLLAR] = 2 * CANNON_PRICE_DOLLARS + 1;
        expect(add(user, "first", {x: 8.5, y: 0, z: 8.5})).toBe(true);
        expect(add(user, "second", {x: 10.5, y: 0, z: 8.5})).toBe(true);
        expect(add(user, "third", {x: 12.5, y: 0, z: 8.5})).toBe(false);
        expect(user.socketUserContext.inventory[DOLLAR]).toBe(1);
    });

    it("gives nothing back for one taken away", async () => {
        const user = await join("someone");
        user.socketUserContext.inventory[DOLLAR] = CANNON_PRICE_DOLLARS;
        expect(add(user, "mine")).toBe(true);
        expect(ServerObjectManager.onRemoveObjectSignalReceived(user.socketUserContext, new RemoveObjectSignal(HUB_ID, "mine")))
            .toBe(true);
        expect(user.socketUserContext.inventory[DOLLAR]).toBe(0);
    });
});

describe("a cannon the server plays", () => {
    // Every wait it picks is its shortest, unless a scene says otherwise. (The ids drawn by the same chance, of its
    // balls and of the bills a long scene sees come, still differ.)
    beforeEach(() => {
        vi.spyOn(Math, "random").mockReturnValue(0);
        let idsDrawn = 0;
        vi.spyOn(ObjectIdUtil, "generateRandomObjectId").mockImplementation(() => `drawn-${idsDrawn++}`);
    });

    it(`rests about ${CANNON_REST_SECONDS} seconds once installed, before anything else`, async () => {
        await join("someone");
        const cannon = placeCannon();
        flushFor(CANNON_REST_SECONDS - FLUSH_SECONDS);
        expect(stateOf(cannon).phase).toBe(CannonPhaseEnumMap.Resting);
        flushFor(2 * FLUSH_SECONDS);
        expect(stateOf(cannon).phase).toBe(CannonPhaseEnumMap.Waiting);
        expect(getBalls()).toEqual([]);
    });

    it(`then waits between ${CANNON_FIRE_INTERVAL_SECONDS[0]} and ${CANNON_FIRE_INTERVAL_SECONDS[1]} seconds, as chance has it, ` +
        "before it turns to someone", async () => {
        const [shortest, longest] = CANNON_FIRE_INTERVAL_SECONDS;
        await join("someone");
        const quick = placeCannon({phase: CannonPhaseEnumMap.Resting, timeLeft: 0});
        flush();
        expect(stateOf(quick)).toMatchObject({phase: CannonPhaseEnumMap.Waiting});
        expect(stateOf(quick).timeLeft).toBeCloseTo(shortest, 2);
        flushFor(shortest - FLUSH_SECONDS);
        expect(stateOf(quick).phase).toBe(CannonPhaseEnumMap.Waiting);
        flushFor(2 * FLUSH_SECONDS);
        expect(stateOf(quick).phase).toBe(CannonPhaseEnumMap.Aiming);

        vi.mocked(Math.random).mockReturnValue(0.999999);
        const slow = placeCannon({phase: CannonPhaseEnumMap.Resting, timeLeft: 0}, {x: 12.5, y: 0, z: 22.5}, FLOOR_FACING, "slow");
        flush();
        expect(stateOf(slow).timeLeft).toBeCloseTo(longest, 2);
        flushFor(longest - FLUSH_SECONDS);
        expect(stateOf(slow).phase).toBe(CannonPhaseEnumMap.Waiting);
    });

    it("turns to whoever is nearest, at the rate it turns, telling the room each step of it", async () => {
        const user = await join("someone");
        await join("farther", {x: TARGET_SPOT.x + 4, y: STANDING_Y, z: TARGET_SPOT.z + 3});
        const cannon = placeCannon({phase: CannonPhaseEnumMap.Waiting, timeLeft: 0, aim: {yaw: 0, pitch: 0}});
        const pivot = CannonAimUtil.getPivot(cannon.transform.pos, cannon.transform.dir);
        const wanted = CannonAimUtil.getAim(cannon.transform.dir, Vector3DUtil.subtract(TARGET_SPOT, pivot)).aim;
        const turn = CannonAimUtil.getAngleBetween({yaw: 0, pitch: 0}, wanted);
        expect(turn, "the scene has it turn a good way").toBeGreaterThan(1);

        forget(user);
        flush();
        expect(stateOf(cannon).phase).toBe(CannonPhaseEnumMap.Aiming);
        let last = stateOf(cannon).aim;
        let turns = 0;
        while (CannonAimUtil.getAngleBetween(stateOf(cannon).aim, wanted) > CANNON_AIM_TOLERANCE + ANGLE_STEP)
        {
            flush();
            const aim = stateOf(cannon).aim;
            expect(CannonAimUtil.getAngleBetween(last, aim)).toBeLessThanOrEqual(Math.SQRT2 * CANNON_TURN_RATE * FLUSH_SECONDS + ANGLE_STEP);
            last = aim;
            expect(++turns).toBeLessThan(Math.ceil(Math.PI / (CANNON_TURN_RATE * FLUSH_SECONDS)) + 2);
        }
        expect(turns).toBeGreaterThanOrEqual(Math.floor(turn / (Math.SQRT2 * CANNON_TURN_RATE * FLUSH_SECONDS)));
        // On them, it is not aimed yet.
        expect(stateOf(cannon).phase).toBe(CannonPhaseEnumMap.Aiming);
        // One word to the room for the turn's start, and one for each step of it.
        expect(statesToldTo(user, cannon.objectId).length).toBe(turns + 1);
    });

    it("turns to another as soon as they are the nearest", async () => {
        const first = await join("someone");
        const other = {x: CANNON_SPOT.x, y: STANDING_Y, z: CANNON_SPOT.z + 6};
        await join("another", other);
        const cannon = placeCannon({phase: CannonPhaseEnumMap.Waiting, timeLeft: 0, aim: {yaw: 0, pitch: 0}});
        const aimAt = (spot: Vec3): CannonAim => CannonAimUtil.getAim(cannon.transform.dir,
            Vector3DUtil.subtract(spot, CannonAimUtil.getPivot(cannon.transform.pos, cannon.transform.dir))).aim;
        const settle = Math.PI / CANNON_TURN_RATE + 1;
        // The other is the nearer.
        flushUntil(() => CannonAimUtil.getAngleBetween(stateOf(cannon).aim, aimAt(other)) <= CANNON_AIM_TOLERANCE + ANGLE_STEP, settle);
        // The first comes nearer than they are, before it has stayed on them its while.
        const nearer = {x: CANNON_SPOT.x + 3, y: STANDING_Y, z: CANNON_SPOT.z};
        moveTo(first, nearer);
        flushUntil(() => CannonAimUtil.getAngleBetween(stateOf(cannon).aim, aimAt(nearer)) <= CANNON_AIM_TOLERANCE + ANGLE_STEP, settle);
        expect(getBalls()).toEqual([]);
        flushUntil(() => getBalls().length == 1, CANNON_LOCK_SECONDS + 2 * CANNON_READY_SECONDS);
        expect(angleBetween(CannonBallStateUtil.getObjectState(getBalls()[0]).vel,
            CannonAimUtil.getDirection(cannon.transform.dir, aimAt(nearer)))).toBeLessThan(CANNON_AIM_TOLERANCE + 0.01);
    });

    it("turns slowly enough to walk round ahead of, from its near limit well out, but not as far as it fires", () => {
        const walkSpeed = PLAYER_WALK_SPEED_PER_INPUT * PLAYER_MAX_WALK_INPUT;
        // How far from it someone walking round it goes round as fast as it turns.
        expect(walkSpeed / CANNON_TURN_RATE).toBeGreaterThan(2 * CANNON_MIN_RANGE);
        expect(walkSpeed / CANNON_TURN_RATE).toBeLessThan(CANNON_MAX_RANGE);
    });

    describe("staying on whoever it turns to", () => {
        const RADIUS = 2 * CANNON_MIN_RANGE;
        const pivot = CannonAimUtil.getPivot(CANNON_SPOT, FLOOR_FACING);
        // Round the cannon on its floor, at one distance, so that only its yaw has to follow.
        const around = (angle: number): Vec3 => ({x: pivot.x + RADIUS * Math.cos(angle), y: STANDING_Y, z: pivot.z + RADIUS * Math.sin(angle)});
        const aimAt = (spot: Vec3): CannonAim => CannonAimUtil.getAim(FLOOR_FACING, Vector3DUtil.subtract(spot, pivot)).aim;
        // Someone going round it at a rate, for a while: the phases it went through meanwhile, and how far it turned.
        const circle = (user: ConnectedUser, cannon: AddObjectSignal, from: number, rate: number, seconds: number)
            : {angle: number, phases: Set<number>, turned: number} => {
            const phases = new Set<number>();
            let angle = from, turned = 0;
            for (let i = 0; i < Math.round(seconds / FLUSH_SECONDS); ++i)
            {
                const before = stateOf(cannon).aim;
                angle += rate * FLUSH_SECONDS;
                moveTo(user, around(angle));
                flush();
                phases.add(stateOf(cannon).phase);
                turned += CannonAimUtil.getAngleBetween(before, stateOf(cannon).aim);
            }
            return {angle, phases, turned};
        };

        it(`is aimed only once it has pointed at them for ${CANNON_LOCK_SECONDS} s without a break, telling the room ` +
            "nothing meanwhile", async () => {
            const user = await join("someone", around(0));
            const cannon = placeCannon({phase: CannonPhaseEnumMap.Waiting, timeLeft: 0, aim: aimAt(around(0))});
            // It picks them, and a flush later finds itself on them.
            flushFor(2 * FLUSH_SECONDS);
            forget(user);
            flushFor(CANNON_LOCK_SECONDS - FLUSH_SECONDS);
            expect(stateOf(cannon).phase).toBe(CannonPhaseEnumMap.Aiming);
            expect(statesToldTo(user, cannon.objectId)).toEqual([]);
            flushFor(2 * FLUSH_SECONDS);
            expect(stateOf(cannon).phase).toBe(CannonPhaseEnumMap.Ready);
            expect(statesToldTo(user, cannon.objectId).map(value => CannonStateUtil.decode(value).phase))
                .toEqual([CannonPhaseEnumMap.Ready]);

            // As long again before its next shot, at someone who never moved.
            flushUntil(() => stateOf(cannon).ballsLeft == CANNON_BALL_COUNT - 1, 2 * CANNON_READY_SECONDS);
            flushUntil(() => stateOf(cannon).phase == CannonPhaseEnumMap.Aiming, CANNON_FIRE_INTERVAL_SECONDS[0] + 2 * FLUSH_SECONDS);
            flushFor(CANNON_LOCK_SECONDS);
            expect(stateOf(cannon).phase).toBe(CannonPhaseEnumMap.Aiming);
            flushFor(2 * FLUSH_SECONDS);
            expect(stateOf(cannon).phase).toBe(CannonPhaseEnumMap.Ready);
        });

        it("starts that over for another, though they stand on the line it points along", async () => {
            const first = await join("someone", around(0));
            // Behind the first, twice as far from it.
            const behind = {x: pivot.x + 2 * RADIUS, y: STANDING_Y, z: pivot.z};
            await join("another", behind);
            const cannon = placeCannon({phase: CannonPhaseEnumMap.Waiting, timeLeft: 0, aim: aimAt(around(0))});
            flushFor(2 * FLUSH_SECONDS);
            flushFor(CANNON_LOCK_SECONDS - FLUSH_SECONDS);
            expect(stateOf(cannon).phase).toBe(CannonPhaseEnumMap.Aiming);
            // The first gone far off the other way, the other is the nearest: its while is theirs from the start.
            moveTo(first, {x: pivot.x - 3 * RADIUS, y: STANDING_Y, z: pivot.z});
            flushFor(CANNON_LOCK_SECONDS - FLUSH_SECONDS);
            expect(stateOf(cannon).phase).toBe(CannonPhaseEnumMap.Aiming);
            flushFor(3 * FLUSH_SECONDS);
            expect(stateOf(cannon).phase).toBe(CannonPhaseEnumMap.Ready);
            expect(CannonAimUtil.getAngleBetween(stateOf(cannon).aim, aimAt(behind))).toBeLessThanOrEqual(CANNON_AIM_TOLERANCE + ANGLE_STEP);
        });

        it("starts that over whenever they get off its line", async () => {
            const user = await join("someone", around(0));
            const cannon = placeCannon({phase: CannonPhaseEnumMap.Waiting, timeLeft: 0, aim: aimAt(around(0))});
            flushFor(2 * FLUSH_SECONDS);
            // Each time it has nearly stayed long enough, they step aside, farther than it turns in a flush.
            const aside = 3 * CANNON_TURN_RATE * FLUSH_SECONDS;
            let angle = 0;
            for (let round = 0; round < 3; ++round)
            {
                flushFor(CANNON_LOCK_SECONDS - FLUSH_SECONDS);
                expect(stateOf(cannon).phase).toBe(CannonPhaseEnumMap.Aiming);
                angle += aside;
                moveTo(user, around(angle));
            }
            // Left alone, it comes back onto them, and stays its while.
            flushFor(aside / CANNON_TURN_RATE + CANNON_LOCK_SECONDS - FLUSH_SECONDS);
            expect(stateOf(cannon).phase).toBe(CannonPhaseEnumMap.Aiming);
            flushFor(3 * FLUSH_SECONDS);
            expect(stateOf(cannon).phase).toBe(CannonPhaseEnumMap.Ready);
            expect(CannonAimUtil.getAngleBetween(stateOf(cannon).aim, aimAt(around(angle))))
                .toBeLessThanOrEqual(CANNON_AIM_TOLERANCE + ANGLE_STEP);
            expect(getBalls()).toEqual([]);
        });

        it("never fires at whoever keeps going round it faster than it turns, and goes on turning after them all the " +
            "while, with no wait, until they stop", async () => {
            const user = await join("someone", around(0));
            const cannon = placeCannon({phase: CannonPhaseEnumMap.Waiting, timeLeft: 0, aim: aimAt(around(0))});
            flush();
            expect(stateOf(cannon).phase).toBe(CannonPhaseEnumMap.Aiming);

            // Many times as long as it waits between two shots.
            const rate = 1.25 * CANNON_TURN_RATE;
            const seconds = 6 * CANNON_FIRE_INTERVAL_SECONDS[1];
            const chased = circle(user, cannon, 0, rate, seconds);
            expect([...chased.phases]).toEqual([CannonPhaseEnumMap.Aiming]);
            expect(chased.turned).toBeGreaterThan(0.9 * CANNON_TURN_RATE * seconds);
            expect(getBalls()).toEqual([]);
            expect(stateOf(cannon).ballsLeft).toBe(CANNON_BALL_COUNT);

            // They stop: it comes round onto them, stays its while, and fires.
            flushUntil(() => getBalls().length == 1, Math.PI / CANNON_TURN_RATE + CANNON_LOCK_SECONDS + 2 * CANNON_READY_SECONDS + 1);
            expect(angleBetween(CannonBallStateUtil.getObjectState(getBalls()[0]).vel,
                CannonAimUtil.getDirection(FLOOR_FACING, aimAt(around(chased.angle))))).toBeLessThan(CANNON_AIM_TOLERANCE + 0.01);
        });

        it("fires at whoever goes round it slower than it turns, the way it pointed as it was aimed", async () => {
            const user = await join("someone", around(0));
            const cannon = placeCannon({phase: CannonPhaseEnumMap.Waiting, timeLeft: 0, aim: aimAt(around(0))});
            flush();
            const rate = 0.5 * CANNON_TURN_RATE;
            let angle = 0;
            while (stateOf(cannon).phase != CannonPhaseEnumMap.Ready)
            {
                angle = circle(user, cannon, angle, rate, FLUSH_SECONDS).angle;
                expect(angle).toBeLessThan(rate * (CANNON_LOCK_SECONDS + 3 * FLUSH_SECONDS));
            }
            // It kept on them as they went, and is aimed at where they then were.
            const aimed = aimAt(around(angle));
            expect(CannonAimUtil.getAngleBetween(stateOf(cannon).aim, aimed)).toBeLessThanOrEqual(CANNON_AIM_TOLERANCE + ANGLE_STEP);
            circle(user, cannon, angle, rate, 2 * CANNON_READY_SECONDS);
            const [ball] = getBalls();
            expect(ball).toBeDefined();
            expect(angleBetween(CannonBallStateUtil.getObjectState(ball).vel, CannonAimUtil.getDirection(FLOOR_FACING, aimed)))
                .toBeLessThan(CANNON_AIM_TOLERANCE + 0.01);
        });
    });

    it(`stands aimed about ${CANNON_READY_SECONDS} seconds, then fires a ball from its barrel's mouth the way it points, ` +
        "wherever they have gone meanwhile", async () => {
        const user = await join("someone");
        const cannon = placeCannon({phase: CannonPhaseEnumMap.Waiting, timeLeft: 0});
        flushUntil(() => stateOf(cannon).phase == CannonPhaseEnumMap.Ready, 10);
        const aim = stateOf(cannon).aim;
        // They step well aside as it stands aimed.
        moveTo(user, {x: TARGET_SPOT.x, y: STANDING_Y, z: TARGET_SPOT.z + 6});
        forget(user);
        flushFor(CANNON_READY_SECONDS - FLUSH_SECONDS);
        expect(getBalls()).toEqual([]);
        expect(stateOf(cannon).aim).toEqual(aim);
        flushFor(2 * FLUSH_SECONDS);

        const [ball] = getBalls();
        expect(ball).toBeDefined();
        const flight = CannonBallStateUtil.getObjectState(ball);
        const {pos, dir} = cannon.transform;
        expect(Vector3DUtil.length(flight.vel)).toBeCloseTo(CANNON_BALL_SPEED, 2);
        expect(angleBetween(flight.vel, CannonAimUtil.getDirection(dir, aim))).toBeLessThan(0.01);
        // Toward where they stood, not where they stand.
        expect(angleBetween(flight.vel, Vector3DUtil.subtract(TARGET_SPOT, CannonAimUtil.getPivot(pos, dir))))
            .toBeLessThanOrEqual(CANNON_AIM_TOLERANCE + 0.01);
        // (It has flown at most one flush since.)
        expect(dist(flight.pos, CannonAimUtil.getMuzzle(pos, dir, aim)))
            .toBeLessThanOrEqual(CANNON_BALL_SPEED * FLUSH_SECONDS + PLACE_STEP);
        expect(stateOf(cannon)).toMatchObject({ballsLeft: CANNON_BALL_COUNT - 1, phase: CannonPhaseEnumMap.Waiting});
        // The room is told of the ball, then of the cannon's having one fewer.
        expect(getPendingSignals(user, "addObjectSignal").map((signal: AddObjectSignal) => signal.objectTypeIndex))
            .toEqual([BALL_TYPE_INDEX]);
        expect(statesToldTo(user, cannon.objectId).map(value => CannonStateUtil.decode(value).ballsLeft))
            .toContain(CANNON_BALL_COUNT - 1);
        expect(ball.sourceUserID).toBe("");
        expect(CannonBallObjectTypeConfig.persistent).toBe(false);
    });

    describe("turning after someone it may not fire at", () => {
        // Long enough for it to turn to someone from any way it points, and to stay on them its while several times.
        const LONG_ENOUGH = Math.PI / CANNON_TURN_RATE + 3 * CANNON_LOCK_SECONDS + 1;
        const aimAt = (cannon: AddObjectSignal, spot: Vec3): CannonAim => CannonAimUtil.getAim(cannon.transform.dir,
            Vector3DUtil.subtract(spot, CannonAimUtil.getPivot(cannon.transform.pos, cannon.transform.dir))).aim;
        const isOn = (cannon: AddObjectSignal, spot: Vec3): boolean =>
            CannonAimUtil.getAngleBetween(stateOf(cannon).aim, aimAt(cannon, spot)) <= CANNON_AIM_TOLERANCE + ANGLE_STEP;
        // The phases it goes through over a while.
        const watch = (cannon: AddObjectSignal, seconds: number = LONG_ENOUGH): number[] => {
            const phases = new Set<number>();
            for (let i = 0; i < Math.round(seconds / FLUSH_SECONDS); ++i)
            {
                flush();
                phases.add(stateOf(cannon).phase);
            }
            return [...phases];
        };
        // Someone a distance from its pivot, along one line from it.
        const CORNER_SPOT: Vec3 = {x: 6.5, y: 0, z: 6.5};
        const at = (distance: number): Vec3 => {
            const pivot = CannonAimUtil.getPivot(CORNER_SPOT, FLOOR_FACING);
            const across = Math.sqrt(distance * distance - (STANDING_Y - pivot.y) ** 2);
            return {x: pivot.x + across * Math.SQRT1_2, y: STANDING_Y, z: pivot.z + across * Math.SQRT1_2};
        };

        it(`goes on with someone farther off than ${CANNON_MAX_RANGE} units, whom it never fires at, and has them in ` +
            "its sights only from where they come within that", async () => {
            const user = await join("someone", at(CANNON_MAX_RANGE + 0.2));
            const cannon = placeCannon({phase: CannonPhaseEnumMap.Waiting, timeLeft: 0, aim: {yaw: 0, pitch: 0}}, CORNER_SPOT);
            expect(watch(cannon)).toEqual([CannonPhaseEnumMap.Aiming]);
            expect(isOn(cannon, at(CANNON_MAX_RANGE + 0.2))).toBe(true);
            expect(getBalls()).toEqual([]);

            // A step nearer, on the line it points along: its while starts there, however long it has been on them.
            moveTo(user, at(CANNON_MAX_RANGE - 0.2));
            expect(watch(cannon, CANNON_LOCK_SECONDS)).toEqual([CannonPhaseEnumMap.Aiming]);
            flushFor(2 * FLUSH_SECONDS);
            expect(stateOf(cannon).phase).toBe(CannonPhaseEnumMap.Ready);
        });

        it(`goes on with someone nearer than ${CANNON_MIN_RANGE} units, whom it never fires at`, async () => {
            const user = await join("someone", at(CANNON_MIN_RANGE - 0.2));
            const cannon = placeCannon({phase: CannonPhaseEnumMap.Waiting, timeLeft: 0, aim: {yaw: 0, pitch: 0}}, CORNER_SPOT);
            expect(watch(cannon)).toEqual([CannonPhaseEnumMap.Aiming]);
            expect(isOn(cannon, at(CANNON_MIN_RANGE - 0.2))).toBe(true);
            // Round it they go, as near, and it after them.
            const pivot = CannonAimUtil.getPivot(CORNER_SPOT, FLOOR_FACING);
            const beside = {x: pivot.x - (at(CANNON_MIN_RANGE - 0.2).x - pivot.x), y: STANDING_Y, z: at(CANNON_MIN_RANGE - 0.2).z};
            moveTo(user, beside);
            expect(watch(cannon)).toEqual([CannonPhaseEnumMap.Aiming]);
            expect(isOn(cannon, beside)).toBe(true);
            expect(getBalls()).toEqual([]);
            expect(stateOf(cannon).ballsLeft).toBe(CANNON_BALL_COUNT);
        });

        it("goes on with someone it has no clear line to, from its barrel's mouth to their middle, and has them in its " +
            "sights only from where the line is clear", async () => {
            const user = await join("someone");
            const cannon = placeCannon({phase: CannonPhaseEnumMap.Waiting, timeLeft: 0, aim: {yaw: 0, pitch: 0}});
            placeWallAcross(14.25);
            expect(watch(cannon)).toEqual([CannonPhaseEnumMap.Aiming]);
            expect(isOn(cannon, TARGET_SPOT)).toBe(true);
            // They walk on behind the wall, and it follows.
            const along = {x: TARGET_SPOT.x, y: STANDING_Y, z: TARGET_SPOT.z + 5};
            moveTo(user, along);
            expect(watch(cannon)).toEqual([CannonPhaseEnumMap.Aiming]);
            expect(isOn(cannon, along)).toBe(true);
            expect(getBalls()).toEqual([]);

            // The wall gone from between them: its while starts there.
            removeWallAcross(14.25);
            expect(watch(cannon, CANNON_LOCK_SECONDS)).toEqual([CannonPhaseEnumMap.Aiming]);
            flushFor(2 * FLUSH_SECONDS);
            expect(stateOf(cannon).phase).toBe(CannonPhaseEnumMap.Ready);
        });

        it("keeps still with only a ghost there, who is nobody to it, and turns to whoever else comes", async () => {
            await join("a-ghost", {x: CANNON_SPOT.x + 4, y: STANDING_Y, z: CANNON_SPOT.z}, {userType: UserTypeEnumMap.Admin,
                playerMetadata: {[ObjectMetadataKeyEnumMap.AdminPrefs]: AdminPrefsUtil.encode({ghostMode: true})}});
            const cannon = placeCannon({phase: CannonPhaseEnumMap.Waiting, timeLeft: 0});
            expect(watch(cannon)).toEqual([CannonPhaseEnumMap.Aiming]);
            expect(CannonAimUtil.getAngleBetween(stateOf(cannon).aim, NEW.aim)).toBeLessThan(ANGLE_STEP);
            expect(getBalls()).toEqual([]);

            // With no wait first: it was only waiting for someone.
            const spot = {x: CANNON_SPOT.x, y: STANDING_Y, z: CANNON_SPOT.z + 7};
            await join("someone", spot);
            flush();
            expect(CannonAimUtil.getAngleBetween(stateOf(cannon).aim, NEW.aim)).toBeGreaterThan(ANGLE_STEP);
            flushUntil(() => getBalls().length == 1, LONG_ENOUGH);
            expect(angleBetween(CannonBallStateUtil.getObjectState(getBalls()[0]).vel,
                CannonAimUtil.getDirection(cannon.transform.dir, aimAt(cannon, spot)))).toBeLessThan(0.05);
        });

        it("goes on turning from where its room kept it, if kept as it turned", async () => {
            await join("someone");
            // As a room loaded again finds one: turning, with nothing of whom it was turning to.
            const cannon = placeCannon({phase: CannonPhaseEnumMap.Aiming, timeLeft: 0, aim: {yaw: 0, pitch: 0}});
            flush();
            expect(stateOf(cannon).phase).toBe(CannonPhaseEnumMap.Aiming);
            expect(CannonAimUtil.getAngleBetween(stateOf(cannon).aim, {yaw: 0, pitch: 0})).toBeGreaterThan(ANGLE_STEP);
            flushUntil(() => getBalls().length == 1, LONG_ENOUGH);
        });
    });

    it("fires at someone behind an NPC all the same, whom nothing a ball bounces off hides from it, and its ball " +
        "bounces off the NPC", async () => {
        const user = await join("someone");
        const cannon = placeCannon({phase: CannonPhaseEnumMap.Waiting, timeLeft: 0});
        // Midway on the line from its barrel's mouth to their middle.
        const {box} = standNpc({x: 0.5 * (CANNON_SPOT.x + TARGET_SPOT.x), z: TARGET_SPOT.z});
        const pivot = CannonAimUtil.getPivot(cannon.transform.pos, cannon.transform.dir);
        expect(Geometry3DUtil.castSphereAgainstUprightCylinder(pivot, TARGET_SPOT, 0, box).hitNormal).toBeDefined();

        flushUntil(() => getBalls().length == 1, Math.PI / CANNON_TURN_RATE + CANNON_LOCK_SECONDS + CANNON_READY_SECONDS + 2);
        const [ball] = getBalls();
        const fired = CannonBallStateUtil.getObjectState(ball).vel;
        expect(angleBetween(fired, Vector3DUtil.subtract(TARGET_SPOT, pivot))).toBeLessThanOrEqual(CANNON_AIM_TOLERANCE + 0.01);
        forget(user);
        // Back off the NPC, toward the cannon, and nobody is thrown.
        const isFlying = () => getRoom().objectById[ball.objectId] != undefined;
        flushUntil(() => !isFlying() || CannonBallStateUtil.getObjectState(ball).vel.x < 0,
            (box.center.x - pivot.x) / fired.x + 2 * FLUSH_SECONDS);
        expect(isFlying()).toBe(true);
        expect(CannonBallStateUtil.getObjectState(ball).vel.x).toBeLessThan(0);
        expect(statesToldTo(user, ball.objectId).map(value => CannonBallStateUtil.decode(value).exploded)).toEqual([false]);
        expect(getBills()).toEqual([]);
    });

    it("fires at someone behind another cannon all the same, which a ball bounces off too, and its ball bounces off " +
        "that cannon, which stays", async () => {
        const user = await join("someone");
        const cannon = placeCannon({phase: CannonPhaseEnumMap.Waiting, timeLeft: 0});
        // Switched off, midway on the line from the first one's barrel's mouth to their middle.
        const between = placeCannon({on: false}, {x: 0.5 * (CANNON_SPOT.x + TARGET_SPOT.x), y: 0, z: TARGET_SPOT.z},
            FLOOR_FACING, "another-cannon");
        const box = PhysicsColliderStateUtil.getObjectColliderState(CANNON_TYPE_INDEX, between.transform)!.hitbox;
        const pivot = CannonAimUtil.getPivot(cannon.transform.pos, cannon.transform.dir);
        expect(Geometry3DUtil.castSphereAgainstAABB(pivot, TARGET_SPOT, 0, box).hitNormal).toBeDefined();

        flushUntil(() => getBalls().length == 1, Math.PI / CANNON_TURN_RATE + CANNON_LOCK_SECONDS + CANNON_READY_SECONDS + 2);
        const [ball] = getBalls();
        const fired = CannonBallStateUtil.getObjectState(ball).vel;
        expect(angleBetween(fired, Vector3DUtil.subtract(TARGET_SPOT, pivot))).toBeLessThanOrEqual(CANNON_AIM_TOLERANCE + 0.01);
        forget(user);
        // Back off the other cannon, toward the first, and nobody is thrown.
        const isFlying = () => getRoom().objectById[ball.objectId] != undefined;
        flushUntil(() => !isFlying() || CannonBallStateUtil.getObjectState(ball).vel.x < 0,
            (box.center.x - pivot.x) / fired.x + 2 * FLUSH_SECONDS);
        expect(isFlying()).toBe(true);
        expect(CannonBallStateUtil.getObjectState(ball).vel.x).toBeLessThan(0);
        expect(statesToldTo(user, ball.objectId).map(value => CannonBallStateUtil.decode(value).exploded)).toEqual([false]);
        expect(getRoom().objectById[between.objectId]).toBeDefined();
        expect(getBills()).toEqual([]);
    });

    it("fires from a wall as from a floor", async () => {
        await join("someone", {x: 16.5, y: STANDING_Y, z: 16.5});
        // On the inside of the west boundary wall.
        const transform = ObjectAttachmentUtil.findPlacement(getRoom(), CANNON_TYPE_INDEX,
            {x: GENERATED_WALL_THICKNESS * VOXEL_CELL_SIZE, y: 1.5, z: 16.5}, {x: 1, y: 0, z: 0}, {...UNIT_VEC3},
            tr => ObjectUpdateUtil.canAddObject(ADMIN, getRoom(), cannonSignal(ADMIN, "a-cannon", tr.pos, tr.dir)));
        expect(transform, "the scene's wall takes a cannon").toBeDefined();
        const cannon = placeCannon({phase: CannonPhaseEnumMap.Waiting, timeLeft: 0}, transform!.pos, transform!.dir);
        flushUntil(() => getBalls().length == 1, 12);
        const {pos, dir} = cannon.transform;
        expect(angleBetween(CannonBallStateUtil.getObjectState(getBalls()[0]).vel,
            Vector3DUtil.subtract({x: 16.5, y: STANDING_Y, z: 16.5}, CannonAimUtil.getPivot(pos, dir)))).toBeLessThan(0.05);
    });

    it(`fires ${CANNON_BALL_COUNT} balls in all, the last of which leaves it empty a moment, and then is gone`, async () => {
        const user = await join("someone");
        const cannon = placeCannon({phase: CannonPhaseEnumMap.Waiting, timeLeft: 0, ballsLeft: 2});
        flushUntil(() => stateOf(cannon).ballsLeft == 1, 12);
        expect(getRoom().objectById[cannon.objectId]).toBeDefined();
        flushUntil(() => stateOf(cannon).ballsLeft == 0, CANNON_FIRE_INTERVAL_SECONDS[0] + 12);
        // Empty, it still stands, for those who watch its counter run out.
        forget(user);
        flushFor(CANNON_SPENT_SECONDS - FLUSH_SECONDS);
        expect(getRoom().objectById[cannon.objectId]).toBeDefined();
        expect(removalsSentTo(user)).not.toContain(cannon.objectId);
        flushFor(2 * FLUSH_SECONDS);
        expect(getRoom().objectById[cannon.objectId]).toBeUndefined();
        expect(removalsSentTo(user)).toContain(cannon.objectId);
        expect(PhysicsManager.hasObject(HUB_ID, cannon.objectId)).toBe(false);
    });

    it("goes even from inside a restricted zone, which holds against users alone", async () => {
        await join("someone");
        const cannon = placeCannon({phase: CannonPhaseEnumMap.Waiting, timeLeft: 0, ballsLeft: 0});
        addRestrictedZone(getRoom(), {rowMin: 0, rowMax: 63, colMin: 0, colMax: 63});
        flushFor(2 * FLUSH_SECONDS);
        expect(getRoom().objectById[cannon.objectId]).toBeUndefined();
    });

    it("does nothing while switched off, and starts over rested once switched on", async () => {
        const user = await join("someone");
        const cannon = placeCannon({phase: CannonPhaseEnumMap.Waiting, timeLeft: 0, ballsLeft: 9, aim: {yaw: 3, pitch: 0.4}});
        const throwSwitch = (on: boolean) => expect(ServerObjectManager.onSetObjectMetadataSignalReceived(
            user.socketUserContext, new SetObjectMetadataSignal(HUB_ID, cannon.objectId, STATE_KEY,
                CannonStateUtil.encodeSwitch(on)))).toBe(true);

        flush();
        expect(stateOf(cannon).phase).toBe(CannonPhaseEnumMap.Aiming);
        throwSwitch(false);
        const aim = stateOf(cannon).aim;
        flushFor(3 * CANNON_FIRE_INTERVAL_SECONDS[1]);
        expect(getBalls()).toEqual([]);
        expect(stateOf(cannon)).toMatchObject({on: false, ballsLeft: 9, phase: CannonPhaseEnumMap.Resting});
        expect(stateOf(cannon).aim).toEqual(aim);

        throwSwitch(true);
        flushFor(CANNON_REST_SECONDS - 2 * FLUSH_SECONDS);
        expect(stateOf(cannon)).toMatchObject({on: true, phase: CannonPhaseEnumMap.Resting});
        flushFor(4 * FLUSH_SECONDS);
        expect(stateOf(cannon).phase).toBe(CannonPhaseEnumMap.Waiting);
        flushUntil(() => getBalls().length == 1, CANNON_FIRE_INTERVAL_SECONDS[0] + 10);
        expect(stateOf(cannon).ballsLeft).toBe(8);
    });

    describe(`firing ${CANNON_SHOTS_IN_A_ROW} in a row`, () => {
        // Long enough for a shot from just switched on: its rest, its longest wait, a turn from any way it points, its
        // while on them and its standing aimed.
        const SHOT_SECONDS = CANNON_REST_SECONDS + CANNON_FIRE_INTERVAL_SECONDS[1] + Math.PI / CANNON_TURN_RATE
            + CANNON_LOCK_SECONDS + CANNON_READY_SECONDS + 1;
        const throwSwitch = (user: ConnectedUser, cannon: AddObjectSignal, on: boolean) =>
            expect(ServerObjectManager.onSetObjectMetadataSignalReceived(user.socketUserContext,
                new SetObjectMetadataSignal(HUB_ID, cannon.objectId, STATE_KEY, CannonStateUtil.encodeSwitch(on)))).toBe(true);
        const fire = (cannon: AddObjectSignal, count: number) => {
            const left = stateOf(cannon).ballsLeft - count;
            flushUntil(() => stateOf(cannon).ballsLeft == left, count * SHOT_SECONDS);
        };
        // How many it fires before it switches itself off.
        const fireUntilOff = (cannon: AddObjectSignal): number => {
            const before = stateOf(cannon).ballsLeft;
            flushUntil(() => !stateOf(cannon).on, CANNON_SHOTS_IN_A_ROW * SHOT_SECONDS + CANNON_SPENT_SECONDS + 1);
            return before - stateOf(cannon).ballsLeft;
        };

        it("it then stands a moment and switches itself off, the room told of its switch alone, as of a user's throw, " +
            "and keeps its other balls for whoever switches it on again", async () => {
            const user = await join("someone");
            const cannon = placeCannon({phase: CannonPhaseEnumMap.Waiting, timeLeft: 0});
            fire(cannon, CANNON_SHOTS_IN_A_ROW);
            expect(stateOf(cannon)).toMatchObject({on: true, shotsInARow: CANNON_SHOTS_IN_A_ROW});
            forget(user);
            flushFor(CANNON_SPENT_SECONDS - FLUSH_SECONDS);
            expect(stateOf(cannon).on).toBe(true);
            flushFor(2 * FLUSH_SECONDS);
            expect(stateOf(cannon)).toMatchObject({on: false, phase: CannonPhaseEnumMap.Resting, shotsInARow: 0,
                ballsLeft: CANNON_BALL_COUNT - CANNON_SHOTS_IN_A_ROW});
            const [thrown, ...after] = statesToldTo(user, cannon.objectId);
            expect(thrown).toBe(CannonStateUtil.encodeSwitch(false));
            expect(after.map(value => CannonStateUtil.decode(value).phase)).toEqual([CannonPhaseEnumMap.Resting]);

            flushFor(2 * SHOT_SECONDS);
            expect(stateOf(cannon)).toMatchObject({on: false, ballsLeft: CANNON_BALL_COUNT - CANNON_SHOTS_IN_A_ROW});
            throwSwitch(user, cannon, true);
            expect(fireUntilOff(cannon)).toBe(CANNON_SHOTS_IN_A_ROW);
        });

        it("starts its row over each time its switch is thrown, even off and on again between two of the server's steps",
            async () => {
            expect(CANNON_SHOTS_IN_A_ROW, "a row the scene can break off").toBeGreaterThan(1);
            expect(4 * CANNON_SHOTS_IN_A_ROW - 2, "balls enough for the scene").toBeLessThan(CANNON_BALL_COUNT);
            const user = await join("someone");
            const cannon = placeCannon({phase: CannonPhaseEnumMap.Waiting, timeLeft: 0});
            fire(cannon, CANNON_SHOTS_IN_A_ROW - 1);
            throwSwitch(user, cannon, false);
            flush();
            expect(stateOf(cannon)).toMatchObject({on: false, shotsInARow: 0});
            throwSwitch(user, cannon, true);
            expect(fireUntilOff(cannon)).toBe(CANNON_SHOTS_IN_A_ROW);

            throwSwitch(user, cannon, true);
            fire(cannon, CANNON_SHOTS_IN_A_ROW - 1);
            throwSwitch(user, cannon, false);
            throwSwitch(user, cannon, true);
            expect(fireUntilOff(cannon)).toBe(CANNON_SHOTS_IN_A_ROW);
        });

        it("goes once it has fired its last ball, though that is the last of its row too", async () => {
            await join("someone");
            const cannon = placeCannon({phase: CannonPhaseEnumMap.Waiting, timeLeft: 0, ballsLeft: 1,
                shotsInARow: CANNON_SHOTS_IN_A_ROW - 1});
            fire(cannon, 1);
            flushUntil(() => getRoom().objectById[cannon.objectId] == undefined, CANNON_SPENT_SECONDS + 2 * FLUSH_SECONDS);
            expect(stateOf(cannon).on).toBe(true);
        });

        it("is kept by the room's saves as far as it has got, and goes on from there", async () => {
            expect(CANNON_SHOTS_IN_A_ROW, "a row the scene can break off").toBeGreaterThan(1);
            const user = await join("someone");
            const cannon = placeCannon({phase: CannonPhaseEnumMap.Waiting, timeLeft: 0});
            fire(cannon, CANNON_SHOTS_IN_A_ROW - 1);
            await harness.disconnectUser(user);
            ServerRoomManager.unloadRoom(HUB_ID);
            await harness.loadRoom(HUB_ID);
            const back = getRoom().objectById[cannon.objectId];
            expect(stateOf(back).shotsInARow).toBe(CANNON_SHOTS_IN_A_ROW - 1);
            await join("newcomer");
            expect(fireUntilOff(back)).toBe(1);
        });
    });

    it("refuses a user's word of anything but its switch, and tells the room of a switch thrown", async () => {
        const user = await join("someone");
        const other = await join("another", {x: 22, y: STANDING_Y, z: 22});
        const cannon = placeCannon({ballsLeft: 1});
        expect(ServerObjectManager.onSetObjectMetadataSignalReceived(user.socketUserContext, new SetObjectMetadataSignal(
            HUB_ID, cannon.objectId, STATE_KEY, CannonStateUtil.encode({...NEW})))).toBe(false);
        expect(stateOf(cannon).ballsLeft).toBe(1);

        forget(other);
        expect(ServerObjectManager.onSetObjectMetadataSignalReceived(user.socketUserContext, new SetObjectMetadataSignal(
            HUB_ID, cannon.objectId, STATE_KEY, CannonStateUtil.encodeSwitch(false)))).toBe(true);
        expect(statesToldTo(other, cannon.objectId)).toEqual([CannonStateUtil.encodeSwitch(false)]);
    });

    it("tells the room nothing while only its time passes, nor while it stays on someone who keeps still", async () => {
        const user = await join("someone", {x: 28, y: STANDING_Y, z: 28});
        const cannon = placeCannon({phase: CannonPhaseEnumMap.Resting, timeLeft: 0}, {x: 4.5, y: 0, z: 4.5});
        flush();
        expect(stateOf(cannon).phase).toBe(CannonPhaseEnumMap.Waiting);
        forget(user);
        flushFor(CANNON_FIRE_INTERVAL_SECONDS[0] - 2 * FLUSH_SECONDS);
        expect(statesToldTo(user, cannon.objectId)).toEqual([]);
        expect(stateOf(cannon).timeLeft).toBeLessThan(CANNON_FIRE_INTERVAL_SECONDS[0]);

        // Then it turns to them, out of its range as they are, and once on them has no more to tell.
        flushFor(Math.PI / CANNON_TURN_RATE + 1);
        expect(stateOf(cannon).phase).toBe(CannonPhaseEnumMap.Aiming);
        forget(user);
        flushFor(3 * CANNON_LOCK_SECONDS);
        expect(statesToldTo(user, cannon.objectId)).toEqual([]);
    });

    it("keeps still with nobody in the room", async () => {
        await harness.loadRoom(HUB_ID);
        const cannon = placeCannon({phase: CannonPhaseEnumMap.Waiting, timeLeft: 1});
        flushFor(5);
        expect(stateOf(cannon)).toMatchObject({phase: CannonPhaseEnumMap.Waiting});
        expect(stateOf(cannon).timeLeft).toBeCloseTo(1, 2);
    });

    it("is kept by the room's saves as it stands: its balls, its aim, its switch, and where in its round it is", async () => {
        const user = await join("someone");
        const cannon = placeCannon({phase: CannonPhaseEnumMap.Waiting, timeLeft: 0, ballsLeft: 12});
        flushUntil(() => stateOf(cannon).ballsLeft == 11, 12);
        flushFor(1);
        expect(ServerObjectManager.onSetObjectMetadataSignalReceived(user.socketUserContext, new SetObjectMetadataSignal(
            HUB_ID, cannon.objectId, STATE_KEY, CannonStateUtil.encodeSwitch(false)))).toBe(true);
        flush();
        const kept = stateOf(cannon);
        expect(kept).toMatchObject({on: false, ballsLeft: 11});
        expect(kept.aim).not.toEqual(NEW.aim);

        await harness.disconnectUser(user);
        // As after a restart or its unloading: the harness's store hands back the room as it was kept.
        ServerRoomManager.unloadRoom(HUB_ID);
        await harness.loadRoom(HUB_ID);
        const back = getRoom().objectById[cannon.objectId];
        expect(back).toBeDefined();
        expect(stateOf(back)).toEqual(kept);

        // Switched on again, it goes on from there with the balls it had.
        const newcomer = await join("newcomer");
        expect(ServerObjectManager.onSetObjectMetadataSignalReceived(newcomer.socketUserContext, new SetObjectMetadataSignal(
            HUB_ID, back.objectId, STATE_KEY, CannonStateUtil.encodeSwitch(true)))).toBe(true);
        flushUntil(() => stateOf(back).ballsLeft == 10, CANNON_REST_SECONDS + CANNON_FIRE_INTERVAL_SECONDS[0] + 12);
    });

    it("keeps still once the server starts shutting down, and its room is saved as it then stands", async () => {
        await join("someone");
        const cannon = placeCannon({phase: CannonPhaseEnumMap.Waiting, timeLeft: 2});
        flush();
        getRoom().dirty = false;
        const shuttingDown = vi.spyOn((await import("../../../src/server/system/util/serverLifecycleUtil")).default,
            "isShuttingDown").mockReturnValue(true);
        const before = stateOf(cannon);
        flushFor(5);
        expect(stateOf(cannon)).toEqual(before);
        CannonUtil.markRoomsToSave();
        expect(getRoom().dirty).toBe(true);
        shuttingDown.mockRestore();
    });
});

describe("a cannon ball the server flies", () => {
    function launch(pos: Vec3, vel: Vec3): AddObjectSignal
    {
        const before = new Set(getBalls().map(ball => ball.objectId));
        expect(CannonBallUtil.launch(getRoom(), pos, vel)).toBe(true);
        return getBalls().find(ball => !before.has(ball.objectId))!;
    }

    function flightOf(ball: AddObjectSignal)
    {
        return CannonBallStateUtil.getObjectState(ball);
    }

    function isFlying(ball: AddObjectSignal): boolean
    {
        return getRoom().objectById[ball.objectId] != undefined;
    }

    // What the room was told of a ball, as a newcomer to the words would read them.
    function wordsOf(user: ConnectedUser, ball: AddObjectSignal)
    {
        return statesToldTo(user, ball.objectId).map(value => CannonBallStateUtil.decode(value));
    }

    // How fast a ball leaves a bounce it came to at some speed.
    function speedAfterBounce(speed: number): number
    {
        return Math.max(speed, Math.min(speed + CANNON_BALL_BOUNCE_BOOST, CANNON_BALL_MAX_SPEED));
    }

    // How a ball goes on from a bounce off something that stands still, which turns it some way: that way, faster.
    function boosted(turned: Vec3): Vec3
    {
        const speed = Vector3DUtil.length(turned);
        return Vector3DUtil.scale(turned, speedAfterBounce(speed) / speed);
    }

    // A fan at its gentlest, which turns a ball without sending it as fast as a wind takes one at most.
    function addFan(pos: Vec3, dir: Vec3): void
    {
        const fan = new AddObjectSignal(HUB_ID, ADMIN.id, ADMIN.userName, FAN_TYPE_INDEX, `fan-${pos.x}-${pos.z}`,
            new ObjectTransform(pos, dir, {...UNIT_VEC3}), {[ObjectMetadataKeyEnumMap.ForceProperties]:
                new EncodableByteString(FanObjectTypeConfig.util.encodeForceProperties(FAN_SETTINGS[0]))});
        expect(ServerObjectManager.addObjectAsServer(getRoom(), ADMIN, fan)).toBe(true);
    }

    it("is no one's to add, move, change or remove by any signal", async () => {
        const user = await join("someone", {x: 26, y: STANDING_Y, z: 26});
        const ball = launch({x: 10, y: FLIGHT_Y, z: 10}, {x: 1, y: 0, z: 0});
        const config = CannonBallObjectTypeConfig;
        expect(config.canUserAddObject()).toBe(false);
        expect(config.canUserRemoveObject()).toBe(false);
        expect(config.canUserSetObjectTransform()).toBe(false);
        expect(config.canUserSetObjectMetadata()).toBe(false);
        expect(ServerObjectManager.onRemoveObjectSignalReceived(user.socketUserContext,
            new RemoveObjectSignal(HUB_ID, ball.objectId))).toBe(false);
        expect(ServerObjectManager.onSetObjectMetadataSignalReceived(user.socketUserContext, new SetObjectMetadataSignal(
            HUB_ID, ball.objectId, STATE_KEY, CannonBallStateUtil.encode({pos: {x: 1, y: 1, z: 1}, vel: {x: 0, y: 0, z: 0},
                exploded: true, hitObjectIds: [], bounces: 0})))).toBe(false);
        expect(isFlying(ball)).toBe(true);
    });

    it(`flies straight at the speed it was fired at, ${CANNON_BALL_SPEED} units a second, with no weight`, async () => {
        const user = await join("someone", {x: 26, y: STANDING_Y, z: 26});
        const from = {x: 8, y: FLIGHT_Y, z: 12};
        const vel = Vector3DUtil.scale(Vector3DUtil.normalize({x: 2, y: 0.1, z: 1}), CANNON_BALL_SPEED);
        const ball = launch(from, vel);
        forget(user);
        flushFor(3);
        const flight = flightOf(ball);
        const expected = Vector3DUtil.add(from, Vector3DUtil.scale(vel, 3));
        expect(dist(flight.pos, expected)).toBeLessThan(0.001 + 2 * PLACE_STEP);
        expect(dist(flight.vel, vel)).toBeLessThan(2 * SPEED_STEP);
        // Nobody is told of a ball that only flies on: browsers fly it themselves.
        expect(wordsOf(user, ball)).toEqual([]);
        // Its collider goes where it does, for whatever else flies.
        expect(dist(PhysicsManager.physicsRooms[HUB_ID].objectById[ball.objectId].colliderState.hitbox.center,
            expected)).toBeLessThan(0.001);
    });

    it("is pushed off its way by a fan's stream as it crosses it, and the room is told how it now goes", async () => {
        const user = await join("someone", {x: 26, y: STANDING_Y, z: 26});
        // A fan on the floor under its way, blowing up, with nothing over it for the ball to rise into.
        addFan({x: 14.5, y: 0, z: 12.5}, FLOOR_FACING);
        for (let x = 13; x < MAX_ROOM_X; x += VOXEL_CELL_SIZE)
        {
            for (let z = 11.5; z <= 13.5; z += VOXEL_CELL_SIZE)
            {
                VoxelQueryUtil.getVoxel(getRoom().voxelGrid.voxels, VoxelQueryUtil.getVoxelRowFromWorldZ(z),
                    VoxelQueryUtil.getVoxelColFromWorldX(x))!.blockLayerMask &= ~(1 << STOREY_FLOOR_COLLISION_LAYER);
            }
        }
        const ball = launch({x: 10, y: 1, z: 12.5}, {x: CANNON_BALL_SPEED, y: 0, z: 0});
        forget(user);
        flushFor(2.2);
        const flight = flightOf(ball);
        // By the share of the stream's push that it takes, over the time it takes to cross it: some units a second
        // for each unit of that share.
        expect(flight.vel.y).toBeGreaterThan(2 * CANNON_BALL_WIND_SHARE);
        expect(flight.vel.y).toBeLessThan(8 * CANNON_BALL_WIND_SHARE);
        expect(flight.pos.y).toBeGreaterThan(1.05);
        expect(flight.vel.x).toBeCloseTo(CANNON_BALL_SPEED, 2);
        expect(Vector3DUtil.length(flight.vel)).toBeLessThanOrEqual(CANNON_BALL_MAX_WIND_SPEED + SPEED_STEP);
        const words = wordsOf(user, ball);
        expect(words.length).toBeGreaterThan(0);
        expect(words.every(word => !word.exploded)).toBe(true);
        expect(words[words.length - 1].vel.y).toBeGreaterThan(2 * CANNON_BALL_WIND_SHARE);
        // A turn the air gives it is no bounce.
        expect(words.every(word => word.bounces == 0)).toBe(true);
        // Past the stream, it flies straight again, and nothing more is told.
        flushFor(1);
        forget(user);
        const after = flightOf(ball).vel;
        flushFor(1);
        expect(wordsOf(user, ball)).toEqual([]);
        expect(flightOf(ball).vel).toEqual(after);
    });

    it(`is sped up by a stream to ${CANNON_BALL_MAX_WIND_SPEED} units a second at most, however long the stream has it`, async () => {
        await join("someone", {x: 26, y: STANDING_Y, z: 26});
        // Fans along the floor, each blowing up the shaft over it... and one ball let go in their streams, going up.
        const pos = {x: 10, y: 0.5, z: 10};
        const vel = {x: 0, y: CANNON_BALL_SPEED, z: 0};
        vi.spyOn(PhysicsManager, "getPush").mockReturnValue({x: 0, y: 400, z: 0});
        for (let i = 0; i < 30; ++i)
        {
            CannonBallMotionUtil.advance(HUB_ID, pos, vel, 1 / 60, new Set());
            expect(Vector3DUtil.length(vel)).toBeLessThanOrEqual(CANNON_BALL_MAX_WIND_SPEED + 0.000001);
        }
        expect(Vector3DUtil.length(vel)).toBeCloseTo(CANNON_BALL_MAX_WIND_SPEED, 6);
    });

    it("is sped up by no stream once bounces have it going faster than a stream takes one, though turned by it, and " +
        "slowed by one it flies into", async () => {
        await join("someone", {x: 26, y: STANDING_Y, z: 26});
        expect(CANNON_BALL_MAX_SPEED).toBeGreaterThanOrEqual(CANNON_BALL_MAX_WIND_SPEED);
        vi.spyOn(PhysicsManager, "getPush").mockReturnValue({x: 0, y: 400, z: 0});
        const flown = (vel: Vec3): Vec3 => {
            CannonBallMotionUtil.advance(HUB_ID, {x: 10, y: 1.5, z: 10}, vel, 1 / 60, new Set());
            return vel;
        };
        const fast = CANNON_BALL_MAX_SPEED;
        // Along the stream, across it, and into it.
        expect(flown({x: 0, y: fast, z: 0}).y).toBeCloseTo(fast, 6);
        const across = flown({x: fast, y: 0, z: 0});
        expect(Vector3DUtil.length(across)).toBeCloseTo(fast, 6);
        expect(across.y).toBeGreaterThan(0);
        const into = flown({x: 0, y: -fast, z: 0});
        expect(into.y).toBeGreaterThan(-fast);
        expect(into.y).toBeLessThan(0);
    });

    it("bursts on a block anybody could remove, which goes with it, and leaves a bill there", async () => {
        const user = await join("someone", {x: 26, y: STANDING_Y, z: 26});
        const block = placeBlock(16.25, FLIGHT_Y, 16.25);
        const behind = placeBlock(16.75, FLIGHT_Y, 16.25);
        const ball = launch({x: 12, y: FLIGHT_Y, z: 16.25}, {x: CANNON_BALL_SPEED, y: 0, z: 0});
        forget(user);
        flushUntil(() => !isFlying(ball), 3);

        expect(hasBlock(block)).toBe(false);
        // Out of its blast's reach, the one behind stands.
        expect(hasBlock(behind)).toBe(true);
        const burstAt = {x: 16 - CANNON_BALL_RADIUS, y: FLIGHT_Y, z: 16.25};
        const words = wordsOf(user, ball);
        expect(words).toHaveLength(1);
        expect(words[0]).toMatchObject({exploded: true, hitObjectIds: []});
        expect(dist(words[0].pos, burstAt)).toBeLessThan(0.001 + 2 * PLACE_STEP);
        // The burst first, then what it broke, the ball's going, and the bill it leaves.
        expect(signalTypesSentTo(user).filter(type => type != "setObjectPathSignal")).toEqual(["setObjectMetadataSignal",
            "removeVoxelBlockSignal", "removeObjectSignal", "addObjectSignal"]);
        expect(removalsSentTo(user)).toEqual([ball.objectId]);
        const [bill] = getBills();
        expect(bill).toBeDefined();
        expect(dist(bill.transform.pos, burstAt)).toBeLessThan(0.01);
        expect(PhysicsManager.hasObject(HUB_ID, ball.objectId)).toBe(false);
        expect(getRoom().dirty).toBe(true);
    });

    it("takes what hangs on a block with it, where anybody could take that off", async () => {
        const user = await join("someone", {x: 26, y: STANDING_Y, z: 26});
        // A pillar two blocks square, with a fan on its south side, blowing clear of the ball's way.
        const blocks = [];
        for (const x of [16.25, 16.75])
        {
            for (const z of [16.25, 16.75])
            {
                for (const y of [1.25, 1.75])
                    blocks.push(placeBlock(x, y, z));
            }
        }
        const fan = new AddObjectSignal(HUB_ID, ADMIN.id, ADMIN.userName, FAN_TYPE_INDEX, "a-fan",
            new ObjectTransform({x: 16.5, y: 1.5, z: 17}, {x: 0, y: 0, z: 1}, {...UNIT_VEC3}));
        expect(ServerObjectManager.addObjectAsServer(getRoom(), ADMIN, fan)).toBe(true);

        // At the middle of the pillar's west side, where its blast reaches a block the fan hangs on.
        const ball = launch({x: 12, y: 1.5, z: 16.5}, {x: CANNON_BALL_SPEED, y: 0, z: 0});
        forget(user);
        flushUntil(() => !isFlying(ball), 3);
        expect(getRoom().objectById["a-fan"]).toBeUndefined();
        const broken = blocks.filter(block => !hasBlock(block));
        expect(broken.length).toBeGreaterThanOrEqual(1);
        expect(broken.every(block => VoxelQueryUtil.getVoxelBlockBox(block.row, block.col, block.layer).center.x < 16.5)).toBe(true);
        // Told as: the burst, each block with what hung on it going first, and last the ball.
        const types = signalTypesSentTo(user).filter(type => type != "setObjectPathSignal" && type != "addObjectSignal");
        expect(types[0]).toBe("setObjectMetadataSignal");
        expect(types.slice(types.indexOf("removeObjectSignal"))).toContain("removeVoxelBlockSignal");
        expect(types[types.length - 1]).toBe("removeObjectSignal");
        expect(removalsSentTo(user)).toEqual(["a-fan", ball.objectId]);
    });

    it("leaves a block that holds up what only an admin or the room's superuser could take off, and all on it", async () => {
        const user = await join("someone", {x: 26, y: STANDING_Y, z: 26});
        const blocks = [];
        for (const x of [16.25, 16.75])
        {
            for (const z of [16.25, 16.75])
            {
                for (const y of [1.25, 1.75])
                    blocks.push(placeBlock(x, y, z));
            }
        }
        const transform = ObjectAttachmentUtil.findPlacement(getRoom(), LABEL_TYPE_INDEX, {x: 16, y: 1.5, z: 16.5},
            {x: -1, y: 0, z: 0}, {...UNIT_VEC3}, () => true)!;
        expect(transform, "the scene's pillar takes a label").toBeDefined();
        const label = new AddObjectSignal(HUB_ID, ADMIN.id, ADMIN.userName, LABEL_TYPE_INDEX, "a-label", transform,
            {[ObjectMetadataKeyEnumMap.Label]: new EncodableByteString("Keep")});
        expect(ServerObjectManager.addObjectAsServer(getRoom(), ADMIN, label)).toBe(true);
        expect(ObjectUpdateUtil.canRemoveObject(GUEST, getRoom(), new RemoveObjectSignal(HUB_ID, "a-label"))).toBe(false);

        const ball = launch({x: 12, y: 1.5, z: 16.5}, {x: CANNON_BALL_SPEED, y: 0, z: 0});
        forget(user);
        flushUntil(() => !isFlying(ball), 3);
        expect(getRoom().objectById["a-label"]).toBeDefined();
        expect(blocks.every(hasBlock)).toBe(true);
        // The ball is gone all the same, and leaves its bill.
        expect(wordsOf(user, ball)).toMatchObject([{exploded: true}]);
        expect(signalTypesSentTo(user)).not.toContain("removeVoxelBlockSignal");
        expect(getBills()).toHaveLength(1);
    });

    it("leaves a block a cannon hangs on, and the cannon, though anybody could take both off, and breaks the rest",
        async () => {
        const user = await join("someone", {x: 26, y: STANDING_Y, z: 26});
        // A pillar two blocks square, with a cannon on top.
        const blocks = [];
        for (const x of [16.25, 16.75])
        {
            for (const z of [16.25, 16.75])
            {
                for (const y of [1.25, 1.75])
                    blocks.push(placeBlock(x, y, z));
            }
        }
        const cannon = placeCannon({on: false}, {x: 16.5, y: 2, z: 16.5});
        expect(ObjectUpdateUtil.canRemoveObject(GUEST, getRoom(), new RemoveObjectSignal(HUB_ID, cannon.objectId))).toBe(true);
        const top = VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(1.75);
        const under = blocks.filter(block => block.layer == top);

        // At the middle of the pillar's west side, where its blast reaches the blocks the cannon stands on, and those
        // under them.
        const ball = launch({x: 12, y: 1.5, z: 16.5}, {x: CANNON_BALL_SPEED, y: 0, z: 0});
        forget(user);
        flushUntil(() => !isFlying(ball), 3);
        expect(wordsOf(user, ball)).toMatchObject([{exploded: true}]);
        expect(getRoom().objectById[cannon.objectId]).toBeDefined();
        expect(under.every(hasBlock)).toBe(true);
        const broken = blocks.filter(block => !hasBlock(block));
        expect(broken.length).toBeGreaterThanOrEqual(1);
        expect(broken.every(block => block.layer < top)).toBe(true);
        expect(removalsSentTo(user)).toEqual([ball.objectId]);
    });

    it("breaks no block in a restricted zone, whoever the zone is kept for", async () => {
        const user = await join("someone", {x: 26, y: STANDING_Y, z: 26});
        const block = placeBlock(16.25, FLIGHT_Y, 16.25);
        const outside = placeBlock(16.25, FLIGHT_Y, 20.25);
        addRestrictedZone(getRoom(), {rowMin: block.row, rowMax: block.row, colMin: block.col, colMax: block.col},
            user.user.userName);
        const ball = launch({x: 12, y: FLIGHT_Y, z: 16.25}, {x: CANNON_BALL_SPEED, y: 0, z: 0});
        flushUntil(() => !isFlying(ball), 3);
        expect(hasBlock(block)).toBe(true);
        expect(getBills()).toHaveLength(1);

        const other = launch({x: 12, y: FLIGHT_Y, z: 20.25}, {x: CANNON_BALL_SPEED, y: 0, z: 0});
        flushUntil(() => !isFlying(other), 3);
        expect(hasBlock(outside)).toBe(false);
    });

    it("bursts on the room's own floor, which nothing breaks", async () => {
        const user = await join("someone", {x: 26, y: STANDING_Y, z: 26});
        const ball = launch({x: 12, y: 2, z: 12}, {x: 0, y: -CANNON_BALL_SPEED, z: 0});
        forget(user);
        flushUntil(() => !isFlying(ball), 2);
        const [word] = wordsOf(user, ball);
        expect(word.exploded).toBe(true);
        expect(word.pos.y).toBeCloseTo(CANNON_BALL_RADIUS, 1);
        expect(signalTypesSentTo(user)).not.toContain("removeVoxelBlockSignal");
        expect(getBills()).toHaveLength(1);
    });

    it("throws a player it strikes, names them in its burst, and leaves no bill", async () => {
        const user = await join("someone", {x: 16.25, y: STANDING_Y, z: 16.25});
        const playerId = harness.getPlayerObject("someone")!.objectId;
        const noted = vi.spyOn(PlayerMotionCheckUtil, "noteBlast");
        const ball = launch({x: 12, y: STANDING_Y, z: 16.25}, {x: CANNON_BALL_SPEED, y: 0, z: 0});
        forget(user);
        flushUntil(() => !isFlying(ball), 3);
        const [word] = wordsOf(user, ball);
        expect(word).toMatchObject({exploded: true, hitObjectIds: [playerId]});
        expect(word.pos.x).toBeCloseTo(16.25 - PLAYER_RADIUS_XZ - CANNON_BALL_RADIUS, 1);
        // Struck in the middle, they are thrown straight on along its way.
        expect(word.struck?.objectId).toBe(playerId);
        expect(Math.abs(word.struck!.heading)).toBeLessThan(ANGLE_STEP);
        expect(getBills()).toEqual([]);
        // Their browser throws them; the server believes how far they then go.
        expect(noted).toHaveBeenCalledWith(user.socketUserContext);
        expect(signalTypesSentTo(user)).toEqual(["setObjectMetadataSignal", "removeObjectSignal"]);
    });

    it("throws whoever stands within its blast of a block it strikes, and so leaves no bill there either", async () => {
        // Beside where it strikes, within the blast's reach of it but out of the ball's way.
        const user = await join("someone", {x: 15.75, y: STANDING_Y, z: 16.25 + CANNON_BALL_RADIUS + PLAYER_RADIUS_XZ + 0.1});
        const far = await join("another", {x: 15.5, y: STANDING_Y, z: 14});
        const block = placeBlock(16.25, 1.25, 16.25);
        const ball = launch({x: 12, y: 1.25, z: 16.25}, {x: CANNON_BALL_SPEED, y: 0, z: 0});
        forget(user);
        flushUntil(() => !isFlying(ball), 3);
        expect(wordsOf(user, ball)[0].hitObjectIds).toEqual([harness.getPlayerObject("someone")!.objectId]);
        expect(wordsOf(far, ball)[0].hitObjectIds).toEqual([harness.getPlayerObject("someone")!.objectId]);
        // The ball struck the block, and nobody.
        expect(wordsOf(user, ball)[0].struck).toBeUndefined();
        expect(hasBlock(block)).toBe(false);
        expect(getBills()).toEqual([]);
    });

    it("throws the player it strikes off their side where the two met, a body being round to it, and tells the room " +
        "which way", async () => {
        const at = {x: 16.25, y: STANDING_Y, z: 16.25};
        const reach = PLAYER_RADIUS_XZ + CANNON_BALL_RADIUS;
        for (const aside of [0.35, -0.5])
        {
            const name = `someone-${aside}`;
            const user = await join(name, at);
            const playerId = harness.getPlayerObject(name)!.objectId;
            // Along x, past their middle line by less than it reaches them from.
            const ball = launch({x: 12, y: STANDING_Y, z: at.z + aside}, {x: CANNON_BALL_SPEED, y: 0, z: 0});
            forget(user);
            flushUntil(() => !isFlying(ball), 3);
            const [word] = wordsOf(user, ball);
            const struckAt = {x: at.x - Math.sqrt(reach * reach - aside * aside), y: STANDING_Y, z: at.z + aside};
            expect(word.hitObjectIds).toEqual([playerId]);
            expect(dist(word.pos, struckAt)).toBeLessThan(0.001 + 2 * PLACE_STEP);
            // Away from the ball's middle as it touched them: on along its way, and off to the side it wasn't on.
            expect(word.struck?.objectId).toBe(playerId);
            expect(Math.abs(word.struck!.heading - Math.atan2(at.z - struckAt.z, at.x - struckAt.x))).toBeLessThan(ANGLE_STEP);
            const thrown = CannonBlastUtil.getThrow(word.struck!.heading);
            expect(thrown.x).toBeGreaterThan(0);
            expect(Math.sign(thrown.z)).toBe(-Math.sign(aside));
            expect(Math.abs(thrown.z / thrown.x)).toBeCloseTo(Math.abs(aside) / (at.x - struckAt.x), 2);
            await harness.disconnectUser(user);
        }
    });

    it("throws a body away from where it burst, across the room, and up off its feet", () => {
        const burst = {x: 10, y: 1, z: 10};
        fc.assert(fc.property(vec3In(-3, 3), offset => {
            fc.pre(Math.hypot(offset.x, offset.z) > 0.01);
            const thrown = CannonBlastUtil.getThrow(CannonBlastUtil.getHeading(burst, Vector3DUtil.add(burst, offset)));
            expect(thrown.y).toBe(CANNON_BLAST_LIFT_SPEED);
            expect(angleBetween({x: thrown.x, y: 0, z: thrown.z}, {x: offset.x, y: 0, z: offset.z})).toBeLessThan(0.000001);
            expect(Math.hypot(thrown.x, thrown.z)).toBeCloseTo(CANNON_BLAST_PUSH_SPEED, 9);
        }));
        expect(CANNON_BLAST_LIFT_SPEED).toBeGreaterThan(0);
        // Right over it, some way all the same.
        const straightUp = CannonBlastUtil.getThrow(CannonBlastUtil.getHeading(burst, {x: burst.x, y: burst.y + 1, z: burst.z}));
        expect(Math.hypot(straightUp.x, straightUp.z)).toBeCloseTo(CANNON_BLAST_PUSH_SPEED, 9);
    });

    it("throws a player hard: more than twice their height across the room, and higher than they stand where there is " +
        "room over them, all of which the server believes of them", async () => {
        const start = {x: 4.25, y: STANDING_Y, z: 16.25};
        const walkSpeed = PLAYER_WALK_SPEED_PER_INPUT * PLAYER_MAX_WALK_INPUT;
        const seconds = BLAST_GRACE_MS / 1000;
        const user = await join("someone", start);
        const player = harness.getPlayerObject("someone")!;
        // Nothing over their head all the way across the room: the slab between the storeys is taken out there.
        for (let x = start.x - 1; x < MAX_ROOM_X; x += VOXEL_CELL_SIZE)
        {
            for (let z = start.z - 1; z <= start.z + 1; z += VOXEL_CELL_SIZE)
            {
                VoxelQueryUtil.getVoxel(getRoom().voxelGrid.voxels, VoxelQueryUtil.getVoxelRowFromWorldZ(z),
                    VoxelQueryUtil.getVoxelColFromWorldX(x))!.blockLayerMask &= ~(1 << STOREY_FLOOR_COLLISION_LAYER);
            }
        }
        const ball = launch({x: start.x - 2, y: STANDING_Y, z: start.z}, {x: CANNON_BALL_SPEED, y: 0, z: 0});
        forget(user);
        flushUntil(() => !isFlying(ball), 3);
        const [word] = wordsOf(user, ball);
        expect(word.hitObjectIds).toEqual([player.objectId]);

        // Their browser throws them as it hears of the burst (see CannonBlastThrowUtil), and moves them a frame at a
        // time, telling the server where they are at each flush. They walk on the way it sends them all the while.
        PhysicsManager.addCarriedVelocity(HUB_ID, player.objectId, CannonBlastUtil.getThrow(word.struck!.heading));
        const frameSeconds = 1 / 60;
        const framesPerFlush = Math.round(FLUSH_SECONDS / frameSeconds);
        let pos = {...player.transform.pos}, reported = {...pos}, highest = pos.y;
        for (let frame = 1; frame <= Math.round(seconds / frameSeconds); ++frame)
        {
            const move = PhysicsManager.getStepVelocity(HUB_ID, player.objectId, {x: walkSpeed, y: 0, z: 0}, frameSeconds);
            pos = {...PhysicsManager.setObjectTransform(HUB_ID, player.objectId, new ObjectTransform(
                Vector3DUtil.add(pos, Vector3DUtil.scale(move.velocity, frameSeconds)), player.transform.dir,
                player.transform.scale), false).transform.pos};
            highest = Math.max(highest, pos.y);
            if (frame % framesPerFlush != 0)
                continue;
            vi.setSystemTime(Date.now() + SIGNAL_BATCH_SEND_INTERVAL);
            PlayerMotionCheckUtil.noteMove(user.socketUserContext, getRoom(), reported, pos);
            reported = {...pos};
            expect(PlayerMotionCheckUtil.isTrusted(user.socketUserContext), `${frame} frames on`).toBe(true);
        }
        expect(pos.x - start.x - walkSpeed * seconds).toBeGreaterThan(2 * PLAYER_HEIGHT);
        expect(highest - start.y).toBeGreaterThan(PLAYER_HEIGHT);
        // Down again by then.
        expect(pos.y).toBeCloseTo(STANDING_Y, 2);
        expect(Math.abs(pos.z - start.z)).toBeLessThan(0.1);
    });

    it("believes of someone a blast threw as far as it carries a body, even told all at once after a stall, but no " +
        "longer than its while", async () => {
        const walkSpeed = PLAYER_WALK_SPEED_PER_INPUT * PLAYER_MAX_WALK_INPUT;
        const reach = PhysicsForceUtil.getCarriedReach(CANNON_BLAST_PUSH_SPEED);
        const thrown = (await join("someone", {x: 4.25, y: STANDING_Y, z: 12.25})).socketUserContext;
        const from = {x: 4.25, y: STANDING_Y, z: 12.25};
        PlayerMotionCheckUtil.noteMove(thrown, getRoom(), from, from);
        PlayerMotionCheckUtil.noteBlast(thrown);
        // Nothing heard of them for a second: then the whole throw, with that second's walk on top.
        vi.setSystemTime(Date.now() + 1000);
        PlayerMotionCheckUtil.noteMove(thrown, getRoom(), from, {...from, x: from.x + reach + walkSpeed});
        expect(PlayerMotionCheckUtil.isTrusted(thrown)).toBe(true);

        // Nor twice as far: back the way they came, in the next flush, is more than is left to believe of them.
        vi.setSystemTime(Date.now() + SIGNAL_BATCH_SEND_INTERVAL);
        PlayerMotionCheckUtil.noteMove(thrown, getRoom(), {...from, x: from.x + reach + walkSpeed}, {...from, x: from.x - 1});
        expect(PlayerMotionCheckUtil.isTrusted(thrown)).toBe(false);

        // One the blast left where they stood can't go as far on their own, once its while is over.
        const still = (await join("another", {x: 4.25, y: STANDING_Y, z: 20.25})).socketUserContext;
        const spot = {x: 4.25, y: STANDING_Y, z: 20.25};
        PlayerMotionCheckUtil.noteMove(still, getRoom(), spot, spot);
        PlayerMotionCheckUtil.noteBlast(still);
        vi.setSystemTime(Date.now() + BLAST_GRACE_MS + SIGNAL_BATCH_SEND_INTERVAL);
        PlayerMotionCheckUtil.noteMove(still, getRoom(), spot, {...spot, x: spot.x + reach + ALLOWANCE.capacity});
        expect(PlayerMotionCheckUtil.isTrusted(still)).toBe(false);
    });

    it("bounces off a mirror as light does, faster than it came by what a bounce adds, and the room is told how it now " +
        "goes: nothing bursts, nothing behind the mirror breaks, and no bill is left", async () => {
        const user = await join("someone", {x: 26, y: STANDING_Y, z: 26});
        const {mirror, box} = hangMirror();
        const blocksBefore = getRoom().voxelGrid.voxels.map(voxel => voxel.blockLayerMask);
        // At the mirror's middle, from a second's flight away, coming at a slant across it and up it.
        const vel = Vector3DUtil.scale(Vector3DUtil.normalize({x: 2, y: 0.3, z: -0.8}), CANNON_BALL_SPEED);
        const struckAt = {x: box.center.x - box.halfSize.x - CANNON_BALL_RADIUS, y: MIRROR_SPOT.y, z: MIRROR_SPOT.z};
        const ball = launch(Vector3DUtil.subtract(struckAt, vel), vel);
        forget(user);
        flushFor(2);

        expect(isFlying(ball)).toBe(true);
        // What carried it into the mirror now carries it out of it, the rest as it was, and it goes that way faster.
        const after = boosted({x: -vel.x, y: vel.y, z: vel.z});
        expect(Vector3DUtil.length(after)).toBeCloseTo(speedAfterBounce(CANNON_BALL_SPEED), 6);
        expect(Vector3DUtil.length(after)).toBeGreaterThan(CANNON_BALL_SPEED);
        expect(dist(flightOf(ball).vel, after)).toBeLessThan(2 * SPEED_STEP);
        expect(dist(flightOf(ball).pos, Vector3DUtil.add(struckAt, after))).toBeLessThan(0.001 + 2 * PLACE_STEP);
        const words = wordsOf(user, ball);
        expect(words).toHaveLength(1);
        expect(words[0].exploded).toBe(false);
        expect(words[0].bounces).toBe(1);
        expect(dist(words[0].vel, after)).toBeLessThan(2 * SPEED_STEP);
        expect(signalTypesSentTo(user)).toEqual(["setObjectMetadataSignal"]);
        expect(getRoom().objectById[mirror.objectId]).toBeDefined();
        expect(getRoom().voxelGrid.voxels.map(voxel => voxel.blockLayerMask)).toEqual(blocksBefore);
        expect(getBills()).toEqual([]);
    });

    it("bounces off an NPC as off a round body, off its side where it strikes it, as level as it came and faster by " +
        "what a bounce adds, and the room is told how it now goes: nothing bursts, and no bill is left", async () => {
        const user = await join("someone", {x: 26, y: STANDING_Y, z: 26});
        const {npc, box} = standNpc({x: 16.25, z: 16.25});
        const home = {...npc.transform.pos};
        const reach = box.halfSize.x + CANNON_BALL_RADIUS;
        // Past its middle line by some way, falling a little as it goes, from a second's flight away.
        const aside = 0.3;
        const vel = Vector3DUtil.scale(Vector3DUtil.normalize({x: 1, y: -0.1, z: 0}), CANNON_BALL_SPEED);
        const struckAt = {x: box.center.x - Math.sqrt(reach * reach - aside * aside), y: STANDING_Y, z: box.center.z + aside};
        const ball = launch(Vector3DUtil.subtract(struckAt, vel), vel);
        forget(user);
        flushFor(2);

        expect(isFlying(ball)).toBe(true);
        const wayOut = Vector3DUtil.normalize({x: struckAt.x - box.center.x, y: 0, z: aside});
        const turned = Vector3DUtil.subtract(vel, Vector3DUtil.scale(wayOut, 2 * Vector3DUtil.dot(vel, wayOut)));
        expect(turned.y).toBe(vel.y);
        const after = boosted(turned);
        expect(after.x).toBeLessThan(0);
        expect(after.z).toBeGreaterThan(0);
        expect(dist(flightOf(ball).vel, after)).toBeLessThan(2 * SPEED_STEP);
        expect(Vector3DUtil.length(flightOf(ball).vel)).toBeCloseTo(speedAfterBounce(CANNON_BALL_SPEED), 1);
        expect(dist(flightOf(ball).pos, Vector3DUtil.add(struckAt, after))).toBeLessThan(0.001 + 2 * PLACE_STEP);
        const words = wordsOf(user, ball);
        expect(words).toHaveLength(1);
        expect(words[0].exploded).toBe(false);
        expect(words[0].bounces).toBe(1);
        expect(dist(words[0].vel, after)).toBeLessThan(2 * SPEED_STEP);
        expect(signalTypesSentTo(user)).toEqual(["setObjectMetadataSignal"]);
        expect(npc.transform.pos).toEqual(home);
        expect(getBills()).toEqual([]);
    });

    it("bounces off a cannon as off the box it is, off the side it strikes, faster than it came by what a bounce adds, " +
        "and the room is told how it now goes: nothing bursts, and the cannon and the blocks it stands on stay", async () => {
        const user = await join("someone", {x: 26, y: STANDING_Y, z: 26});
        // On blocks of its own, which a blast where the ball strikes it would reach.
        const blocks = [16.25, 16.75].flatMap(x => [16.25, 16.75].map(z => placeBlock(x, 0.25, z)));
        const cannon = placeCannon({on: false}, {x: 16.5, y: 0.5, z: 16.5});
        const box = PhysicsColliderStateUtil.getObjectColliderState(CANNON_TYPE_INDEX, cannon.transform)!.hitbox;
        const blocksBefore = getRoom().voxelGrid.voxels.map(voxel => voxel.blockLayerMask);
        // Low on its west side, from a second's flight away, coming at a slant across it.
        const struckAt = {x: box.center.x - box.halfSize.x - CANNON_BALL_RADIUS, y: 0.8, z: box.center.z};
        expect(PhysicsManager.getReachedBySphere(HUB_ID, {...struckAt, x: struckAt.x + CANNON_BALL_RADIUS},
            CANNON_BALL_BLAST_RADIUS).blocks.length).toBeGreaterThan(0);
        const vel = Vector3DUtil.scale(Vector3DUtil.normalize({x: 2, y: 0, z: -0.5}), CANNON_BALL_SPEED);
        const ball = launch(Vector3DUtil.subtract(struckAt, vel), vel);
        forget(user);
        flushFor(2);

        expect(isFlying(ball)).toBe(true);
        // What carried it into that side now carries it out of it, the rest as it was, and it goes that way faster.
        const after = boosted({x: -vel.x, y: vel.y, z: vel.z});
        expect(dist(flightOf(ball).vel, after)).toBeLessThan(2 * SPEED_STEP);
        expect(dist(flightOf(ball).pos, Vector3DUtil.add(struckAt, after))).toBeLessThan(0.001 + 2 * PLACE_STEP);
        const words = wordsOf(user, ball);
        expect(words).toHaveLength(1);
        expect(words[0].exploded).toBe(false);
        expect(words[0].bounces).toBe(1);
        expect(signalTypesSentTo(user)).toEqual(["setObjectMetadataSignal"]);
        expect(getRoom().objectById[cannon.objectId]).toBeDefined();
        expect(blocks.every(hasBlock)).toBe(true);
        expect(getRoom().voxelGrid.voxels.map(voxel => voxel.blockLayerMask)).toEqual(blocksBefore);
        expect(getBills()).toEqual([]);
    });

    it("bursts on a block beside an NPC without a word to the NPC, which no blast throws", async () => {
        const user = await join("someone", {x: 26, y: STANDING_Y, z: 26});
        const {npc, box} = standNpc({x: 15.75, z: 17});
        const block = placeBlock(16.25, 1.25, 16.25);
        // Within the blast's reach of where the ball strikes the block, and out of the ball's way.
        expect(distanceToBox({x: 16, y: 1.25, z: 16.25}, box)).toBeLessThan(CANNON_BALL_BLAST_RADIUS);
        expect(box.center.z - box.halfSize.x - 16.25).toBeGreaterThan(CANNON_BALL_RADIUS);
        const ball = launch({x: 12, y: 1.25, z: 16.25}, {x: CANNON_BALL_SPEED, y: 0, z: 0});
        forget(user);
        flushUntil(() => !isFlying(ball), 3);
        expect(wordsOf(user, ball)).toMatchObject([{exploded: true, hitObjectIds: []}]);
        expect(hasBlock(block)).toBe(false);
        expect(getRoom().objectById[npc.objectId]).toBeDefined();
        // Having thrown nobody, it leaves its bill.
        expect(getBills()).toHaveLength(1);
    });

    it("bounces off another ball as a billiard ball does, the two pushed apart by what a bounce adds, and neither " +
        "bursts", async () => {
        const user = await join("someone", {x: 26, y: STANDING_Y, z: 26});
        const a = launch({x: 10, y: FLIGHT_Y, z: 12}, {x: CANNON_BALL_SPEED, y: 0, z: 0});
        const b = launch({x: 14, y: FLIGHT_Y, z: 12}, {x: -CANNON_BALL_SPEED, y: 0, z: 0});
        forget(user);
        flushFor(1.4);
        expect(isFlying(a)).toBe(true);
        expect(isFlying(b)).toBe(true);
        // Head on, each takes the other's way, and goes it faster.
        expect(flightOf(a).vel.x).toBeCloseTo(-speedAfterBounce(CANNON_BALL_SPEED), 2);
        expect(flightOf(b).vel.x).toBeCloseTo(speedAfterBounce(CANNON_BALL_SPEED), 2);
        expect(flightOf(a).pos.x).toBeLessThan(flightOf(b).pos.x);
        for (const ball of [a, b])
        {
            const words = wordsOf(user, ball);
            expect(words.length).toBeGreaterThanOrEqual(1);
            expect(words.every(word => !word.exploded)).toBe(true);
            // Each is told to have bounced, once.
            expect(words[words.length - 1].bounces).toBe(1);
            expect(flightOf(ball).bounces).toBe(1);
        }
        expect(getBills()).toEqual([]);
    });

    it("counts each bounce, off whatever it is, in what it tells of the ball and in what the room's saves keep of it, " +
        "and counts on from there", async () => {
        const user = await join("someone", {x: 26, y: STANDING_Y, z: 26});
        const {box} = hangMirror();
        const struckAt = {x: box.center.x - box.halfSize.x - CANNON_BALL_RADIUS, y: MIRROR_SPOT.y, z: MIRROR_SPOT.z};
        const east = {x: CANNON_BALL_SPEED, y: 0, z: 0};
        const ball = launch(Vector3DUtil.subtract(struckAt, east), east);
        expect(flightOf(ball).bounces).toBe(0);
        forget(user);
        flushFor(1.5);
        expect(flightOf(ball).bounces).toBe(1);
        expect(wordsOf(user, ball).map(word => word.bounces)).toEqual([1]);

        await harness.disconnectUser(user);
        ServerRoomManager.unloadRoom(HUB_ID);
        await harness.loadRoom(HUB_ID);
        const back = getRoom().objectById[ball.objectId];
        expect(flightOf(back).bounces).toBe(1);

        // Another comes at it along its way back, two seconds' flight off: they meet, and a moment more goes by.
        const newcomer = await join("newcomer", {x: 26, y: STANDING_Y, z: 26});
        const other = launch(Vector3DUtil.subtract(flightOf(back).pos, Vector3DUtil.scale(east, 2)), east);
        forget(newcomer);
        flushFor((2 * CANNON_BALL_SPEED - 2 * CANNON_BALL_RADIUS) / (speedAfterBounce(CANNON_BALL_SPEED) + CANNON_BALL_SPEED)
            + 2 * FLUSH_SECONDS);
        expect(flightOf(back).vel.x).toBeGreaterThan(0);
        expect(flightOf(back).bounces).toBe(2);
        expect(flightOf(other).bounces).toBe(1);
        expect(wordsOf(newcomer, back).pop()?.bounces).toBe(2);
        expect(wordsOf(newcomer, other).pop()?.bounces).toBe(1);
    });

    it("goes on faster from each bounce, off whatever it is, as the room is told each time", async () => {
        const user = await join("someone", {x: 26, y: STANDING_Y, z: 26});
        const {box} = hangMirror();
        const struckAt = {x: box.center.x - box.halfSize.x - CANNON_BALL_RADIUS, y: MIRROR_SPOT.y, z: MIRROR_SPOT.z};
        // An NPC in its way back from the mirror, and the ball let go between the two, half a second from the mirror.
        const {box: npcBox} = standNpc({x: struckAt.x - 3, z: struckAt.z});
        expect(Math.abs(npcBox.center.z - struckAt.z)).toBeLessThan(npcBox.halfSize.x);
        const east = {x: CANNON_BALL_SPEED, y: 0, z: 0};
        const ball = launch(Vector3DUtil.subtract(struckAt, Vector3DUtil.scale(east, 0.5)), east);
        forget(user);
        flushUntil(() => flightOf(ball).bounces == 2, 3);

        const once = speedAfterBounce(CANNON_BALL_SPEED), twice = speedAfterBounce(once);
        expect(once).toBeGreaterThan(CANNON_BALL_SPEED);
        expect(twice).toBeGreaterThanOrEqual(once);
        const words = wordsOf(user, ball);
        expect(words.map(word => word.bounces)).toEqual([1, 2]);
        expect(Vector3DUtil.length(words[0].vel)).toBeCloseTo(once, 2);
        expect(words[0].vel.x).toBeLessThan(0);
        expect(Vector3DUtil.length(words[1].vel)).toBeCloseTo(twice, 2);
        expect(Vector3DUtil.length(flightOf(ball).vel)).toBeCloseTo(twice, 2);
    });

    it("leaves a bounce off what stands still the way that turns it, faster by what a bounce adds, however it comes: " +
        `never past ${CANNON_BALL_MAX_SPEED} units a second, and never slower than it came`, () => {
        fc.assert(fc.property(vec3In(-1, 1), vec3In(-1, 1), scaled(0.01, 1.5 * CANNON_BALL_MAX_SPEED), (way, facing, speed) => {
            fc.pre(Vector3DUtil.length(way) > 0.1 && Vector3DUtil.length(facing) > 0.1);
            const normal = Vector3DUtil.normalize(facing);
            const vel = Vector3DUtil.scale(Vector3DUtil.normalize(way), speed);
            // (Only what closes on a thing bounces off it.)
            fc.pre(Vector3DUtil.dot(vel, normal) < -0.001);
            const turned = Vector3DUtil.subtract(vel, Vector3DUtil.scale(normal, 2 * Vector3DUtil.dot(vel, normal)));
            CannonBallMotionUtil.rebound(vel, normal);
            const after = Vector3DUtil.length(vel);
            expect(dist(Vector3DUtil.normalize(vel), Vector3DUtil.normalize(turned))).toBeLessThan(0.000001);
            // (One already faster than a ball goes, as a room kept under other numbers may hold, keeps its speed.)
            expect(after).toBeCloseTo((speed > CANNON_BALL_MAX_SPEED) ? speed
                : Math.min(speed + CANNON_BALL_BOUNCE_BOOST, CANNON_BALL_MAX_SPEED), 6);
            expect(after).toBeGreaterThanOrEqual(speed - 0.000001);
        }));
        // Bounce after bounce, from the speed it is fired at up to the most, where another adds nothing.
        const vel = {x: CANNON_BALL_SPEED, y: 0, z: 0};
        const speeds: number[] = [];
        for (let i = 0; i < 2 + Math.ceil((CANNON_BALL_MAX_SPEED - CANNON_BALL_SPEED) / CANNON_BALL_BOUNCE_BOOST); ++i)
        {
            CannonBallMotionUtil.rebound(vel, {x: -Math.sign(vel.x), y: 0, z: 0});
            speeds.push(Math.abs(vel.x));
        }
        expect(speeds[0]).toBeGreaterThan(CANNON_BALL_SPEED);
        speeds.forEach((speed, i) => expect(speed).toBeCloseTo(
            Math.min(CANNON_BALL_SPEED + (i + 1) * CANNON_BALL_BOUNCE_BOOST, CANNON_BALL_MAX_SPEED), 6));
        expect(speeds[speeds.length - 1]).toBeCloseTo(speeds[speeds.length - 2], 6);
    });

    it("shares what two balls carry along the line between them and pushes each off the other by what a bounce adds, " +
        "whatever way they meet: they come apart, neither faster than a ball goes at most", () => {
        const most = CANNON_BALL_MAX_SPEED;
        const velArb = fc.tuple(vec3In(-1, 1), scaled(0, most)).filter(([way]) => Vector3DUtil.length(way) > 0.1)
            .map(([way, speed]) => Vector3DUtil.scale(Vector3DUtil.normalize(way), speed));
        fc.assert(fc.property(vec3In(-2, 2), velArb, velArb, (apart, velA, velB) => {
            fc.pre(Vector3DUtil.length(apart) > 0.1);
            const posA = {x: 5, y: 5, z: 5}, posB = Vector3DUtil.add(posA, apart);
            const beforeA = {...velA}, beforeB = {...velB};
            // The way from the second to the first, and what a ball carries along it and across it.
            const line = Vector3DUtil.normalize(Vector3DUtil.subtract(posA, posB));
            const along = (vel: Vec3) => Vector3DUtil.dot(vel, line);
            const across = (vel: Vec3) => Vector3DUtil.subtract(vel, Vector3DUtil.scale(line, along(vel)));
            const closing = along(velA) - along(velB);
            const bounced = CannonBallMotionUtil.bounce(posA, velA, posB, velB);
            expect(bounced).toBe(closing < 0);
            if (!bounced)
            {
                expect(velA).toEqual(beforeA);
                expect(velB).toEqual(beforeB);
                return;
            }
            // What each carries across the line is its own still.
            expect(dist(across(velA), across(beforeA))).toBeLessThan(0.000001);
            expect(dist(across(velB), across(beforeB))).toBeLessThan(0.000001);
            // Along it, each has what the other had, and what a bounce adds the way off the other: short of that
            // only where it would be faster than a ball goes.
            const held = (wanted: number, carriedAcross: Vec3) =>
                Math.min(wanted, Math.sqrt(Math.max(0, most * most - Vector3DUtil.lengthSqr(carriedAcross))));
            expect(along(velA)).toBeCloseTo(held(along(beforeB) + CANNON_BALL_BOUNCE_BOOST, across(beforeA)), 5);
            expect(-along(velB)).toBeCloseTo(held(-along(beforeA) + CANNON_BALL_BOUNCE_BOOST, across(beforeB)), 5);
            expect(Vector3DUtil.length(velA)).toBeLessThanOrEqual(most + 0.000001);
            expect(Vector3DUtil.length(velB)).toBeLessThanOrEqual(most + 0.000001);
            // And they are coming apart: by what both bounces add, and more, where neither is held back.
            expect(along(velA) - along(velB)).toBeGreaterThanOrEqual(-0.000001);
            if (Vector3DUtil.length(velA) < most - 0.001 && Vector3DUtil.length(velB) < most - 0.001)
            {
                expect(along(velA) - along(velB)).toBeCloseTo(2 * CANNON_BALL_BOUNCE_BOOST - closing, 5);
                // What the two carry between them is kept, each pushed as hard as the other.
                expect(dist(Vector3DUtil.add(velA, velB), Vector3DUtil.add(beforeA, beforeB))).toBeLessThan(0.000001);
            }
        }));
    });

    it("goes out through a gap in the room's wall and is taken away far past it, with no burst and no bill", async () => {
        const user = await join("someone", {x: 26, y: STANDING_Y, z: 26});
        // The west wall taken down in its way.
        for (let x = 0.5 * VOXEL_CELL_SIZE; x < 4; x += VOXEL_CELL_SIZE)
        {
            for (const z of [15.75, 16.25, 16.75])
            {
                for (const y of [FLIGHT_Y - COLLISION_LAYER_HEIGHT, FLIGHT_Y, FLIGHT_Y + COLLISION_LAYER_HEIGHT])
                {
                    const voxel = VoxelQueryUtil.getVoxel(getRoom().voxelGrid.voxels,
                        VoxelQueryUtil.getVoxelRowFromWorldZ(z), VoxelQueryUtil.getVoxelColFromWorldX(x))!;
                    voxel.blockLayerMask &= ~(1 << VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(y));
                }
            }
        }
        const fast = CANNON_BALL_MAX_SPEED;
        const ball = launch({x: 6, y: FLIGHT_Y, z: 16.25}, {x: -fast, y: 0, z: 0});
        forget(user);
        // Still flying a little short of how far out a ball goes, and its place is kept though no transform holds it.
        flushFor((6 + CANNON_BALL_VANISH_DISTANCE - 1) / fast);
        expect(isFlying(ball)).toBe(true);
        expect(flightOf(ball).pos.x).toBeLessThan(-CANNON_BALL_VANISH_DISTANCE + 2);
        expect(ball.transform.pos.x).toBe(0);
        expect(CannonBallMotionUtil.isGone(flightOf(ball).pos)).toBe(false);
        flushFor(2 / fast + 2 * FLUSH_SECONDS);
        expect(isFlying(ball)).toBe(false);
        expect(wordsOf(user, ball)).toEqual([]);
        expect(signalTypesSentTo(user)).toEqual(["removeObjectSignal"]);
        expect(getBills()).toEqual([]);
    });

    it(`is gone ${CANNON_BALL_VANISH_DISTANCE} units past the room, whichever way it left`, () => {
        const inside = {x: 0.5 * MAX_ROOM_X, y: 0.5 * MAX_ROOM_Y, z: 0.5 * MAX_ROOM_Z};
        expect(CannonBallMotionUtil.isGone(inside)).toBe(false);
        for (const axis of ["x", "y", "z"] as const)
        {
            const max = {x: MAX_ROOM_X, y: MAX_ROOM_Y, z: MAX_ROOM_Z}[axis];
            for (const [near, far] of [[-CANNON_BALL_VANISH_DISTANCE + 0.01, -CANNON_BALL_VANISH_DISTANCE - 0.01],
                [max + CANNON_BALL_VANISH_DISTANCE - 0.01, max + CANNON_BALL_VANISH_DISTANCE + 0.01]])
            {
                expect(CannonBallMotionUtil.isGone({...inside, [axis]: near})).toBe(false);
                expect(CannonBallMotionUtil.isGone({...inside, [axis]: far})).toBe(true);
            }
        }
    });

    it(`is refused where the room already has ${MAX_BALLS} in the air, and the cannon keeps the ball`, async () => {
        await join("someone", TARGET_SPOT);
        for (let i = 0; i < MAX_BALLS; ++i)
            launch({x: 6 + 0.6 * i, y: 3, z: 26}, {x: 0, y: 0, z: 0});
        expect(CannonBallUtil.launch(getRoom(), {x: 6, y: 3, z: 6}, {x: 0, y: 0, z: 0})).toBe(false);

        vi.spyOn(Math, "random").mockReturnValue(0);
        const cannon = placeCannon({phase: CannonPhaseEnumMap.Waiting, timeLeft: 0, ballsLeft: 5});
        flushUntil(() => stateOf(cannon).phase == CannonPhaseEnumMap.Ready, 10);
        flushFor(CANNON_READY_SECONDS + 2 * FLUSH_SECONDS);
        // Nor counted in its row.
        expect(stateOf(cannon)).toMatchObject({ballsLeft: 5, shotsInARow: 0, phase: CannonPhaseEnumMap.Waiting});
        expect(getBalls()).toHaveLength(MAX_BALLS);
    });

    it("is kept by the room's saves as it flies, and flies on from there", async () => {
        const user = await join("someone", {x: 26, y: STANDING_Y, z: 26});
        const vel = {x: 0.5, y: 0, z: 0.25};
        const ball = launch({x: 10, y: FLIGHT_Y, z: 10}, vel);
        flushFor(2);
        const kept = flightOf(ball);
        expect(kept.pos.x).toBeCloseTo(11, 1);
        await harness.disconnectUser(user);
        ServerRoomManager.unloadRoom(HUB_ID);
        await harness.loadRoom(HUB_ID);

        const back = getRoom().objectById[ball.objectId];
        expect(back).toBeDefined();
        expect(flightOf(back)).toEqual(kept);
        // (Nothing moves with nobody there.)
        flushFor(1);
        expect(flightOf(back)).toEqual(kept);
        await join("newcomer", {x: 26, y: STANDING_Y, z: 26});
        flushFor(2);
        expect(flightOf(back).pos.x).toBeCloseTo(kept.pos.x + 2 * vel.x, 1);
        expect(flightOf(back).pos.z).toBeCloseTo(kept.pos.z + 2 * vel.z, 1);
        expect(dist(flightOf(back).vel, vel)).toBeLessThan(2 * SPEED_STEP);
    });
});

describe("the bills cannon balls leave", () => {
    function burstAt(x: number, z: number): void
    {
        const before = getBalls().length;
        expect(CannonBallUtil.launch(getRoom(), {x, y: 1, z}, {x: 0, y: -CANNON_BALL_SPEED, z: 0})).toBe(true);
        flushUntil(() => getBalls().length == before, 2);
    }

    it("count as the room's own: with as many in it as it brings by itself, it brings none", async () => {
        // (Nobody near enough to collect one.)
        await join("someone", {x: 26, y: STANDING_Y, z: 26});
        for (let i = 0; i < DOLLAR_BILL_SPAWN_CAP; ++i)
            burstAt(8 + 2 * i, 8);
        expect(getBills()).toHaveLength(DOLLAR_BILL_SPAWN_CAP);
        flushFor(2 * SPAWN_INTERVAL_MS[1] / 1000);
        expect(getBills()).toHaveLength(DOLLAR_BILL_SPAWN_CAP);
    });

    it(`may be more than that, up to ${MAX_BILLS} in a room, past which a ball leaves none`, async () => {
        await join("someone", {x: 26, y: STANDING_Y, z: 26});
        expect(MAX_BILLS).toBeGreaterThan(DOLLAR_BILL_SPAWN_CAP);
        for (let i = 0; i < MAX_BILLS + 2; ++i)
            burstAt(6 + 1.5 * i, 10);
        expect(getBills()).toHaveLength(MAX_BILLS);
    });

    it("are collected as any bill is", async () => {
        const user = await join("someone", {x: 12, y: STANDING_Y, z: 26});
        burstAt(12, 12);
        const [bill] = getBills();
        expect(bill).toBeDefined();
        // Lying a step ahead of them, once they have walked over and faced it.
        Object.assign(bill.transform.pos, {x: 12, y: DOLLAR_BILL_REST_HEIGHT, z: 12});
        moveTo(user, {x: 12, y: STANDING_Y, z: 12.6});
        harness.getPlayerObject("someone")!.transform.dir = {x: 0, y: 0, z: 1};
        flushUntil(() => getBills().length == 0, 3);
        expect(user.socketUserContext.inventory[DOLLAR]).toBe(1);
    });
});

describe("a way walked round a cannon", () => {
    // A vertex of the lower storey's floor, and a body standing on a place of it.
    const vertexAt = (x: number, z: number): VoxelVertex =>
        ({row: Math.round(z / VOXEL_CELL_SIZE), col: Math.round(x / VOXEL_CELL_SIZE), layer: 0});
    const bodyAt = (feet: Vec3): AABB3 => ({center: {x: feet.x, y: feet.y + STANDING_Y, z: feet.z},
        halfSize: {x: PLAYER_RADIUS_XZ, y: STANDING_Y, z: PLAYER_RADIUS_XZ}});
    const boxOf = (cannon: AddObjectSignal): AABB3 =>
        PhysicsColliderStateUtil.getObjectColliderState(CANNON_TYPE_INDEX, cannon.transform)!.hitbox;
    const WEST = vertexAt(CANNON_SPOT.x - 3, CANNON_SPOT.z);
    const EAST = vertexAt(CANNON_SPOT.x + 3, CANNON_SPOT.z);

    it("keeps a body off the vertices it would stand in a cannon on, and off no other", async () => {
        await harness.loadRoom(HUB_ID);
        expect(ObjectObstacleUtil.getClearance(getRoom().objectById)(vertexAt(CANNON_SPOT.x, CANNON_SPOT.z))).toBe(true);
        const box = boxOf(placeCannon({on: false}));
        const isOpen = ObjectObstacleUtil.getClearance(getRoom().objectById);
        const closed: VoxelVertex[] = [];
        for (let x = CANNON_SPOT.x - 2; x <= CANNON_SPOT.x + 2; x += VOXEL_CELL_SIZE)
        {
            for (let z = CANNON_SPOT.z - 2; z <= CANNON_SPOT.z + 2; z += VOXEL_CELL_SIZE)
            {
                const vertex = vertexAt(x, z);
                expect(isOpen(vertex), JSON.stringify(vertex))
                    .toBe(!Geometry3DUtil.AABBsOverlap(bodyAt(VoxelPathUtil.toWorld(vertex)), box));
                if (!isOpen(vertex))
                    closed.push(vertex);
            }
        }
        // Its own vertex and the eight round it.
        expect(closed).toHaveLength(9);
        // Over its top, a body is clear of it; and what a body walks through keeps it off nothing.
        expect(isOpen({...vertexAt(CANNON_SPOT.x, CANNON_SPOT.z), layer: Math.ceil(1 / COLLISION_LAYER_HEIGHT)})).toBe(true);
        getRoom().objectById["a-fan"] = new AddObjectSignal(HUB_ID, ADMIN.id, ADMIN.userName, FAN_TYPE_INDEX, "a-fan",
            new ObjectTransform({x: CANNON_SPOT.x + 3, y: 0, z: CANNON_SPOT.z}, {...FLOOR_FACING}, {...UNIT_VEC3}));
        expect(ObjectObstacleUtil.getClearance(getRoom().objectById)(EAST)).toBe(true);
    });

    it("leads round it, cutting no corner of it, where the straight way runs through it", async () => {
        await harness.loadRoom(HUB_ID);
        const voxels = getRoom().voxelGrid.voxels;
        expect(VoxelPathUtil.findPath(voxels, WEST, EAST)).toEqual([WEST, EAST]);
        const box = boxOf(placeCannon({on: false}));
        const isOpen = ObjectObstacleUtil.getClearance(getRoom().objectById);

        const way = VoxelPathUtil.findPath(voxels, WEST, EAST, isOpen)!.map(VoxelPathUtil.toWorld);
        expect(way.length).toBeGreaterThan(2);
        for (let leg = 1; leg < way.length; ++leg)
        {
            for (let share = 0; share <= 1; share += 0.02)
                expect(Geometry3DUtil.AABBsOverlap(bodyAt(along(way[leg - 1], way[leg], share)), box)).toBe(false);
        }
        // Everywhere a body can walk to from there is clear of it too, however it gets there.
        const reach = VoxelPathUtil.findReach(voxels, WEST, 8, undefined, isOpen);
        expect(reach.vertices.length).toBeGreaterThan(100);
        expect(reach.vertices.filter(vertex => !isOpen(vertex))).toEqual([]);
        for (const vertex of reach.vertices)
        {
            const steps = VoxelPathUtil.getPathWithin(reach, vertex)!.map(VoxelPathUtil.toWorld);
            for (let step = 1; step < steps.length; ++step)
                expect(Geometry3DUtil.AABBsOverlap(bodyAt(along(steps[step - 1], steps[step], 0.5)), box)).toBe(false);
        }
    });

    it("leads to no place in it, but out from beside it, and finds the nearest place to stand by it", async () => {
        await harness.loadRoom(HUB_ID);
        const voxels = getRoom().voxelGrid.voxels;
        const box = boxOf(placeCannon({on: false}));
        const isOpen = ObjectObstacleUtil.getClearance(getRoom().objectById);
        const inIt = vertexAt(CANNON_SPOT.x, CANNON_SPOT.z);
        const besideIt = vertexAt(CANNON_SPOT.x + VOXEL_CELL_SIZE, CANNON_SPOT.z);

        expect(VoxelPathUtil.findPath(voxels, WEST, inIt)).toBeDefined();
        expect(VoxelPathUtil.findPath(voxels, WEST, inIt, isOpen)).toBeUndefined();
        expect(VoxelPathUtil.findPath(voxels, WEST, besideIt, isOpen)).toBeUndefined();
        // Someone a cannon was set down beside walks away from it all the same.
        expect(VoxelPathUtil.findPath(voxels, besideIt, EAST, isOpen)).toBeDefined();
        const near = VoxelPathUtil.findStandingVertexNear(voxels, CANNON_SPOT, 3, isOpen)!;
        expect(Geometry3DUtil.AABBsOverlap(bodyAt(VoxelPathUtil.toWorld(near)), box)).toBe(false);
        expect(dist(VoxelPathUtil.toWorld(near), CANNON_SPOT)).toBeCloseTo(2 * VOXEL_CELL_SIZE, 6);
        expect(VoxelPathUtil.findStandingVertexNear(voxels, CANNON_SPOT, 1, isOpen)).toBeUndefined();
    });
});
