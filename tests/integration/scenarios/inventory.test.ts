/**
 * Integration tests: what users hold, and the $1 bills that fill it (see @docs/gameplay/inventory.md) — the signals on the
 * wire and a path played out alike by whoever follows it; a bill's flight, property-based over rooms of random blocks:
 * never through a block, ending on whatever is under it, a gust's curve differing from the last and blowing it toward
 * nobody, and how it lies on every screen alike; and, through the real server modules, bills in a room: when and where
 * they come, how many, who sees them come and go, what the room's saves keep of them, gusts, fans' streams, a block laid
 * over one or taken from under one, whoever comes near collecting one, what coming back earns, and what a user holds
 * lasting.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fc from "fast-check";
import { harness, ConnectedUser } from "../helpers/serverHarness";
import { getPendingSignals } from "../helpers/invariants";
import { createTestRoom } from "../helpers/roomContent";
import DBFileStorageUtil from "../../../src/server/db/util/dbFileStorageUtil";
import DBInventoryUtil from "../../../src/server/db/util/dbInventoryUtil";
import DBRoomUtil from "../../../src/server/db/util/dbRoomUtil";
import ServerLifecycleUtil from "../../../src/server/system/util/serverLifecycleUtil";
import ObjectGroup from "../../../src/shared/object/types/objectGroup";
import VoxelGrid from "../../../src/shared/voxel/types/voxelGrid";
import DBUserUtil from "../../../src/server/db/util/dbUserUtil";
import ClientInventoryManager from "../../../src/client/inventory/clientInventoryManager";
import { dollarsInFlightObservable, inventoryGainObservable,
    inventoryObservable } from "../../../src/client/system/clientObservables";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ServerObjectManager from "../../../src/server/object/serverObjectManager";
import DollarBillUtil, { GUST_INTERVAL_MS, REACH_ANGLE, REACH_UPWARD as UPWARD_REACH,
    SPAWN_INTERVAL_MS } from "../../../src/server/inventory/util/dollarBillUtil";
import DollarBillFlightUtil, { CLEARANCE as FLIGHT_CLEARANCE,
    GUST_MIN_ANGLE } from "../../../src/server/inventory/util/dollarBillFlightUtil";
import ServerInventoryManager from "../../../src/server/inventory/serverInventoryManager";
import { LOGIN_REWARD_INTERVAL_MS } from "../../../src/server/system/serverConstants";
import DollarBillPoseUtil, { ABSORB_VANISHING_SHARE, FLIGHT_SHRINK, GROWING_SHARE, LEANS, MAX_FLIGHT_START,
    VANISHING_SHARE } from "../../../src/client/object/util/dollarBillPoseUtil";
import UserSessionUtil from "../../../src/server/user/util/userSessionUtil";
import InventorySignal from "../../../src/shared/inventory/types/inventorySignal";
import LoginRewardSignal from "../../../src/shared/inventory/types/loginRewardSignal";
import { InventoryItemTypeEnumMap } from "../../../src/shared/inventory/types/inventoryItemType";
import EncodingUtil from "../../../src/shared/networking/util/encodingUtil";
import SignalTypeConfigMap from "../../../src/shared/networking/maps/signalTypeConfigMap";
import BufferState from "../../../src/shared/networking/types/bufferState";
import ObjectCategoryConfigMap from "../../../src/shared/object/maps/objectCategoryConfigMap";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import ObjectCollectedSignal from "../../../src/shared/object/types/objectCollectedSignal";
import ObjectWaypoint from "../../../src/shared/object/types/objectWaypoint";
import RemoveObjectSignal from "../../../src/shared/object/types/removeObjectSignal";
import SetObjectPathSignal from "../../../src/shared/object/types/setObjectPathSignal";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import DollarBillObjectTypeConfig, { DOLLAR_BILL_REACH,
    DOLLAR_BILL_REST_HEIGHT } from "../../../src/shared/object/types/objectTypeConfig/dollarBillObjectTypeConfig";
import FanObjectTypeConfig, { FAN_SETTINGS } from "../../../src/shared/object/types/objectTypeConfig/fanObjectTypeConfig";
import { PLAYER_EYE_HEIGHT, PLAYER_HEIGHT, PLAYER_MAX_WALK_INPUT, PLAYER_RADIUS_XZ,
    PLAYER_WALK_SPEED_PER_INPUT } from "../../../src/shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import SetObjectTransformSignal from "../../../src/shared/object/types/setObjectTransformSignal";
import PlayerMotionCheckUtil, { ALLOWANCE, DISTRUST_MS } from "../../../src/server/user/util/playerMotionCheckUtil";
import UserSignalDispatchUtil from "../../../src/server/user/util/userSignalDispatchUtil";
import Vector3DUtil from "../../../src/shared/math/util/vector3DUtil";
import AdminPrefsUtil from "../../../src/shared/object/util/adminPrefsUtil";
import ObjectPathUtil from "../../../src/shared/object/util/objectPathUtil";
import EncodableByteString from "../../../src/shared/networking/types/encodableByteString";
import EncodableRawByteNumber from "../../../src/shared/networking/types/encodableRawByteNumber";
import PhysicsManager from "../../../src/shared/physics/physicsManager";
import Vec3 from "../../../src/shared/math/types/vec3";
import Geometry3DUtil from "../../../src/shared/math/util/geometry3DUtil";
import Room from "../../../src/shared/room/types/room";
import RoomFile from "../../../src/shared/room/types/roomFile";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import { COLLISION_LAYER_HEIGHT, GENERATED_WALL_THICKNESS, INITIAL_MULTI_PLAYER_ENTRANCE_POS,
    LOGIN_REWARD_DOLLARS, MAX_ROOM_Y, NUM_VOXEL_COLS, SIGNAL_BATCH_SEND_INTERVAL, STOREY_FLOOR_COLLISION_LAYER, UNIT_VEC3,
    VOXEL_CELL_SIZE } from "../../../src/shared/system/sharedConstants";
import User from "../../../src/shared/user/types/user";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";
import Voxel from "../../../src/shared/voxel/types/voxel";
import VoxelPathUtil from "../../../src/shared/voxel/util/voxelPathUtil";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import VoxelUpdateUtil from "../../../src/shared/voxel/util/voxelUpdateUtil";

const HUB_ID = "hubAAAAAAAAAAAAAAAAA";
const BILL_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType(DollarBillObjectTypeConfig.objectType);
const FAN_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType(FanObjectTypeConfig.objectType);
const NPC_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType("Npc");
const MAX_BILLS = ObjectCategoryConfigMap.getMaxCountPerRoom(DollarBillObjectTypeConfig.category);
// How far ahead of someone a bill lies well within their reach, and how far it lies in the scenes with something in
// the way, whose walls and steps are laid out for it.
const WITHIN_REACH = 0.75 * DOLLAR_BILL_REACH;
const OBSTRUCTED_AHEAD = 3;
const DOLLAR = InventoryItemTypeEnumMap.Dollar;
const FLUSH_MS = 200;
// Long enough for a bill lying still to be blown, even should the first gust find no way to go.
const GUST_WITHIN_MS = 2.5 * GUST_INTERVAL_MS[1];
const ADMIN = new User("an-admin", "Admin", UserTypeEnumMap.Admin, "", "");
// The middle of the lower storey's floor, a bill lying on it, and a player standing on it.
const MIDDLE_X = 16, MIDDLE_Z = 16;
const LYING_Y = DOLLAR_BILL_REST_HEIGHT;
const STANDING_Y = 0.5 * PLAYER_HEIGHT;

function getRoom(): Room
{
    return ServerRoomManager.roomRuntimeMemories[HUB_ID].room;
}

function getBills(): AddObjectSignal[]
{
    return Object.values(getRoom().objectById).filter(obj => obj.objectTypeIndex == BILL_TYPE_INDEX);
}

// The clock moved on, then a flush, as SocketsServer's interval makes them.
function flush(ms: number = FLUSH_MS): void
{
    vi.setSystemTime(Date.now() + ms);
    DollarBillUtil.stepAll(ms / 1000);
}

function flushFor(ms: number): void
{
    for (let elapsed = 0; elapsed < ms; elapsed += FLUSH_MS)
        flush();
}

function flushUntil(done: () => boolean, withinMs: number = SPAWN_INTERVAL_MS[1] + 30_000): void
{
    for (let elapsed = 0; !done(); elapsed += FLUSH_MS)
    {
        if (elapsed >= withinMs)
            throw new Error(`Still waiting after ${withinMs} ms`);
        flush();
    }
}

async function join(id: string, at: Vec3 = {x: 4, y: STANDING_Y, z: 4}): Promise<ConnectedUser>
{
    const user = harness.connectUser({id, userName: id});
    await harness.joinRoom(user, HUB_ID);
    moveTo(user, at);
    return user;
}

// An admin in ghost mode, whom nobody sees (see AdminPrefsUtil.isGhost).
async function joinAsGhost(id: string, at: Vec3): Promise<ConnectedUser>
{
    const ghost = harness.connectUser({id, userName: id, userType: UserTypeEnumMap.Admin,
        playerMetadata: {[ObjectMetadataKeyEnumMap.AdminPrefs]: AdminPrefsUtil.encode({ghostMode: true})}});
    await harness.joinRoom(ghost, HUB_ID);
    expect(AdminPrefsUtil.isGhost(harness.getPlayerObject(id))).toBe(true);
    moveTo(ghost, at);
    return ghost;
}

// Where the room keeps their player, as the moves they send leave it, their body's box with it.
function moveTo(user: ConnectedUser, pos: Vec3): void
{
    const player = harness.getPlayerObject(user.user.id)!;
    Object.assign(player.transform.pos, pos);
    PhysicsManager.setObjectTransform(HUB_ID, player.objectId, player.transform, true);
}

// Turns them toward a place, as the moves they send do. A player's transform's direction points behind them.
function faceToward(user: ConnectedUser, x: number, z: number): void
{
    const {transform} = harness.getPlayerObject(user.user.id)!;
    const length = Math.hypot(x - transform.pos.x, z - transform.pos.z);
    transform.dir = {x: (transform.pos.x - x) / length, y: 0, z: (transform.pos.z - z) / length};
}

// A bill come into the room in its own time, lying on the floor at last.
function spawnBill(x: number = MIDDLE_X, z: number = MIDDLE_Z): AddObjectSignal
{
    const before = getBills().length;
    flushUntil(() => getBills().length > before);
    const bill = getBills()[before];
    Object.assign(bill.transform.pos, {x, y: LYING_Y, z});
    return bill;
}

// No gust blows, for a test about something else: one could carry a bill anywhere, into someone's reach included.
function holdGusts(): void
{
    vi.spyOn(DollarBillFlightUtil, "planGust").mockReturnValue([]);
}

function pathsSentTo(user: ConnectedUser, objectId: string): ObjectWaypoint[][]
{
    return getPendingSignals(user, "setObjectPathSignal")
        .filter((signal: SetObjectPathSignal) => signal.objectId == objectId)
        .map((signal: SetObjectPathSignal) => signal.waypoints);
}

function removalsSentTo(user: ConnectedUser): string[]
{
    return getPendingSignals(user, "removeObjectSignal").map((signal: RemoveObjectSignal) => signal.objectId);
}

function collectionsSentTo(user: ConnectedUser): {objectId: string, collectorUserID: string}[]
{
    return getPendingSignals(user, "objectCollectedSignal")
        .map(({objectId, collectorUserID}: ObjectCollectedSignal) => ({objectId, collectorUserID}));
}

// The types of what is queued for a user, in order.
function signalTypesSentTo(user: ConnectedUser): string[]
{
    return (user.socketUserContext as any).pendingSignalsToUser.runs.map((run: {typeIndex: number}) =>
        SignalTypeConfigMap.getConfigByIndex(run.typeIndex).signalType);
}

function inventoriesSentTo(user: ConnectedUser): {[itemType: string]: number}[]
{
    return getPendingSignals(user, "inventorySignal").map((signal: InventorySignal) => signal.inventory);
}

function addFan(id: string, pos: Vec3, dir: Vec3, setting: (typeof FAN_SETTINGS)[number] = FAN_SETTINGS[1]): void
{
    const metadata = {[ObjectMetadataKeyEnumMap.ForceProperties]:
        new EncodableByteString(FanObjectTypeConfig.util.encodeForceProperties(setting))};
    const fan = new AddObjectSignal(HUB_ID, ADMIN.id, ADMIN.userName, FAN_TYPE_INDEX, id,
        new ObjectTransform(pos, dir, {...UNIT_VEC3}), metadata);
    expect(ServerObjectManager.addObjectAsServer(getRoom(), ADMIN, fan)).toBe(true);
}

function placeBlock(row: number, col: number, layer: number): void
{
    expect(VoxelUpdateUtil.addVoxelBlock(ADMIN, getRoom().voxelGrid.voxels,
        VoxelQueryUtil.getVoxelQuadIndex(row, col, "y", "-", layer), undefined, getRoom())).toBe(true);
}

function roundTrip(signal: {encode: (bufferState: BufferState) => void}): BufferState
{
    const bufferState = EncodingUtil.startEncoding();
    signal.encode(bufferState);
    return new BufferState(new Uint8Array(EncodingUtil.endEncoding(bufferState)));
}

// A wind that blows the same all through, along a direction across the room and upward.
function steadyWind(direction: Vec3, speed: number, lift: number = 0): () => Vec3
{
    return () => ({x: direction.x * speed, y: lift, z: direction.z * speed});
}

function colOf(x: number): number { return VoxelQueryUtil.getVoxelColFromWorldX(x); }
function rowOf(z: number): number { return VoxelQueryUtil.getVoxelRowFromWorldZ(z); }

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    // Only the clock: promises and the harness's own timers run as usual.
    vi.useFakeTimers({toFake: ["Date"]});
    harness.reset();
    harness.seedHub(HUB_ID);
    vi.mocked(DBInventoryUtil.addItem).mockClear();
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe("what goes over the wire", () => {
    it("tells all a user holds, however much", () => {
        const inventory = {dollar: 4_000_000_000, somethingElse: 3};
        expect((InventorySignal.decode(roundTrip(new InventorySignal(inventory))) as InventorySignal).inventory)
            .toEqual(inventory);
    });

    it("tells what a login earned", () => {
        expect((LoginRewardSignal.decode(roundTrip(new LoginRewardSignal(LOGIN_REWARD_DOLLARS))) as LoginRewardSignal).dollars)
            .toBe(LOGIN_REWARD_DOLLARS);
    });

    it("says a path, each place near to where it was given and each speed as near as a byte can", () => {
        const waypoints = [{pos: {x: 1.25, y: 0.5, z: 30}, speed: 3.5}, {pos: {x: 31.9, y: 7.9, z: 0}, speed: 1.4}];
        const decoded = SetObjectPathSignal.decode(roundTrip(new SetObjectPathSignal("a-room", "@7", waypoints))) as SetObjectPathSignal;
        expect([decoded.roomID, decoded.objectId]).toEqual(["a-room", "@7"]);
        decoded.waypoints.forEach((waypoint, i) => {
            for (const axis of ["x", "y", "z"] as const)
                expect(waypoint.pos[axis]).toBeCloseTo(waypoints[i].pos[axis], 2);
            expect(Math.abs(waypoint.speed - waypoints[i].speed)).toBeLessThan(1 / 16);
        });
    });

    it("says who collected what", () => {
        const decoded = ObjectCollectedSignal.decode(roundTrip(new ObjectCollectedSignal("a-room", "@7", "a-user"))) as ObjectCollectedSignal;
        expect(decoded).toMatchObject({roomID: "a-room", objectId: "@7", collectorUserID: "a-user"});
    });

    it("never says a speed of nothing, which would leave a bill going nowhere for good", () => {
        const decoded = SetObjectPathSignal.decode(roundTrip(new SetObjectPathSignal("a-room", "@7",
            [{pos: {x: 1, y: 1, z: 1}, speed: 0}]))) as SetObjectPathSignal;
        expect(decoded.waypoints[0].speed).toBeGreaterThan(0);
    });
});

describe("a path", () => {
    it("goes from waypoint to waypoint at each one's speed", () => {
        const waypoints = [{pos: {x: 2, y: 0, z: 0}, speed: 2}, {pos: {x: 2, y: 1, z: 0}, speed: 0.5}];
        const pos = {x: 0, y: 0, z: 0};
        expect(ObjectPathUtil.advance(waypoints, 0, pos, 0.5)).toBe(0);
        expect(pos).toEqual({x: 1, y: 0, z: 0});
        // The first half second reaches the corner, the rest goes up at the slower speed.
        expect(ObjectPathUtil.advance(waypoints, 0, pos, 1)).toBe(1);
        expect(pos.x).toBe(2);
        expect(pos.y).toBeCloseTo(0.25);
        expect(ObjectPathUtil.advance(waypoints, 1, pos, 10)).toBe(2);
        expect(pos).toEqual({x: 2, y: 1, z: 0});
    });

    it("says how long it takes from where something is", () => {
        const waypoints = [{pos: {x: 2, y: 0, z: 0}, speed: 2}, {pos: {x: 2, y: 1, z: 0}, speed: 0.5}];
        expect(ObjectPathUtil.getSeconds(waypoints, {x: 0, y: 0, z: 0})).toBeCloseTo(3);
        expect(ObjectPathUtil.getSeconds(waypoints, {x: 2, y: 0, z: 0})).toBeCloseTo(2);
    });

    it("ends in the same place, whatever steps it is played out in", () => {
        fc.assert(fc.property(
            fc.array(fc.record({x: fc.integer({min: 0, max: 50}), y: fc.integer({min: 0, max: 50}),
                z: fc.integer({min: 0, max: 50}), speed: fc.integer({min: 1, max: 40})}), {minLength: 1, maxLength: 6}),
            fc.array(fc.integer({min: 1, max: 30}), {minLength: 1, maxLength: 8}),
            (legs, steps) => {
                const waypoints = legs.map(({speed, ...pos}) => ({pos, speed}));
                const pos = {x: 0, y: 0, z: 0};
                let next = 0;
                for (const step of steps)
                    next = ObjectPathUtil.advance(waypoints, next, pos, step);
                next = ObjectPathUtil.advance(waypoints, next, pos, 1_000_000);
                expect(next).toBe(waypoints.length);
                expect(pos).toEqual(waypoints[waypoints.length - 1].pos);
            }));
    });
});

describe("a bill's flight", () => {
    // A storey of open room with blocks strewn about it, a floor of the room's own.
    function strewnRoom(blocks: {row: number, col: number, layer: number}[]): Voxel[]
    {
        const voxels: Voxel[] = createTestRoom("strewn", "strewn", RoomTypeEnumMap.Hub).voxelGrid.voxels;
        for (const {row, col, layer} of blocks)
            VoxelQueryUtil.getVoxel(voxels, row, col)!.blockLayerMask |= 1 << layer;
        return voxels;
    }

    // Walks a path finely, asking at every step whether the bill is in a block.
    function expectClearOfBlocks(voxels: Voxel[], from: Vec3, path: ObjectWaypoint[]): void
    {
        let at = from;
        for (const {pos} of path)
        {
            const numSteps = Math.ceil(Math.sqrt((pos.x - at.x) ** 2 + (pos.y - at.y) ** 2 + (pos.z - at.z) ** 2) / 0.02);
            for (let step = 1; step <= numSteps; ++step)
            {
                const t = step / numSteps;
                expect(DollarBillFlightUtil.isInBlock(voxels, {x: at.x + (pos.x - at.x) * t, y: at.y + (pos.y - at.y) * t,
                    z: at.z + (pos.z - at.z) * t})).toBe(false);
            }
            at = pos;
        }
    }

    const BLOCK_NEAR_MIDDLE = fc.record({row: fc.integer({min: 26, max: 38}), col: fc.integer({min: 26, max: 38}),
        layer: fc.integer({min: 0, max: 5})});
    // Over the highest any of them lies, so that it starts clear of them all, and under the storey's slab.
    const HIGH_UP = {x: MIDDLE_X, y: 6 * COLLISION_LAYER_HEIGHT + LYING_Y + 0.05, z: MIDDLE_Z};
    const DIRECTION_ANGLE = fc.double({min: 0, max: 2 * Math.PI, noNaN: true});

    it("never passes through a block or stops in the air, however the room is strewn with them", () => {
        fc.assert(fc.property(fc.array(BLOCK_NEAR_MIDDLE, {maxLength: 60}), DIRECTION_ANGLE,
            fc.integer({min: 2, max: 30}), fc.integer({min: 5, max: 90}), fc.integer({min: 0, max: 40}),
            (blocks, angle, tenthsLong, tenthsFast, tenthsUp) => {
                const voxels = strewnRoom(blocks);
                const path = DollarBillFlightUtil.planFlight(voxels, HIGH_UP, steadyWind(
                    {x: Math.cos(angle), y: 0, z: Math.sin(angle)}, tenthsFast / 10, tenthsUp / 10), tenthsLong / 10);
                expectClearOfBlocks(voxels, HIGH_UP, path);
                expect(DollarBillFlightUtil.isLying(voxels, path[path.length - 1]?.pos ?? HIGH_UP)).toBe(true);
            }), {numRuns: 60});
    });

    it("is as clear of blocks on a gust, and on its way down, whatever the curve", () => {
        fc.assert(fc.property(fc.array(BLOCK_NEAR_MIDDLE, {maxLength: 60}), (blocks) => {
            const voxels = strewnRoom(blocks);
            for (const path of [DollarBillFlightUtil.planGust(voxels, HIGH_UP, []),
                DollarBillFlightUtil.planFlutterDown(voxels, HIGH_UP)])
            {
                expectClearOfBlocks(voxels, HIGH_UP, path);
                expect(DollarBillFlightUtil.isLying(voxels, path[path.length - 1].pos)).toBe(true);
            }
        }), {numRuns: 60});
    });

    it("never has more waypoints than a path can say", () => {
        const voxels = strewnRoom([]);
        for (let i = 0; i < 200; ++i)
        {
            expect(DollarBillFlightUtil.planGust(voxels, HIGH_UP, []).length)
                .toBeLessThanOrEqual(EncodableRawByteNumber.MAX_VALUE);
        }
    });

    it("keeps the flight it is given short of a wall in its way, sliding down it to the floor", () => {
        const voxels = strewnRoom([]);
        const wallFace = 32 * VOXEL_CELL_SIZE - 0.5;
        for (let layer = 0; layer < 7; ++layer)
        {
            for (let row = 28; row < 36; ++row)
                VoxelQueryUtil.getVoxel(voxels, row, 31)!.blockLayerMask |= 1 << layer;
        }
        const path = DollarBillFlightUtil.planFlight(voxels, {x: wallFace - 1, y: LYING_Y, z: MIDDLE_Z},
            steadyWind({x: 1, y: 0, z: 0}, 5, 3), 2);
        const last = path[path.length - 1].pos;
        expect(last.x).toBeLessThanOrEqual(wallFace);
        expect(last.y).toBeCloseTo(LYING_Y);
        expectClearOfBlocks(voxels, {x: wallFace - 1, y: LYING_Y, z: MIDDLE_Z}, path);
    });

    it("goes nowhere with no room to go", () => {
        const voxels = strewnRoom([]);
        for (let row = 28; row < 36; ++row)
            VoxelQueryUtil.getVoxel(voxels, row, 33)!.blockLayerMask = 0b111111;
        const against = {x: 16.5 - FLIGHT_CLEARANCE - 0.01, y: LYING_Y, z: MIDDLE_Z};
        expect(DollarBillFlightUtil.planFlight(voxels, against, steadyWind({x: 1, y: 0, z: 0}, 3), 2)).toEqual([]);
    });

    it("lands on the first thing under it, even with most of it hanging over an edge", () => {
        const voxels = strewnRoom([{row: 32, col: 32, layer: 0}]);
        const blockTop = COLLISION_LAYER_HEIGHT;
        // A hair within reach of the block, which is under only its edge.
        const edge = 32 * VOXEL_CELL_SIZE - (FLIGHT_CLEARANCE - 0.01);
        const [fall] = DollarBillFlightUtil.planFall(voxels, {x: edge, y: 3, z: 16.25});
        expect(fall.pos).toEqual({x: edge, y: blockTop + LYING_Y, z: 16.25});
    });

    it("drops slower than it is blown", () => {
        const voxels = strewnRoom([]);
        const path = DollarBillFlightUtil.planFlight(voxels, {x: MIDDLE_X, y: 2, z: MIDDLE_Z},
            steadyWind({x: 1, y: 0, z: 0}, 6), 1);
        expect(path[path.length - 1].speed).toBeLessThan(Math.max(...path.map(({speed}) => speed)));
    });

    it("is told lying from hanging", () => {
        const voxels = strewnRoom([]);
        expect(DollarBillFlightUtil.isLying(voxels, {x: MIDDLE_X, y: LYING_Y, z: MIDDLE_Z})).toBe(true);
        expect(DollarBillFlightUtil.isLying(voxels, {x: MIDDLE_X, y: LYING_Y + 0.2, z: MIDDLE_Z})).toBe(false);
    });

    it("is seen past nothing but thin air", () => {
        const voxels = strewnRoom([{row: 32, col: 30, layer: 2}]);
        const eye = {x: 12, y: 1.25, z: 16.25};
        expect(VoxelQueryUtil.isLineClear(voxels, eye, {x: 14, y: 1.25, z: 16.25})).toBe(true);
        expect(VoxelQueryUtil.isLineClear(voxels, eye, {x: 18, y: 1.25, z: 16.25})).toBe(false);
        expect(VoxelQueryUtil.isLineClear(voxels, eye, {x: 18, y: 2.75, z: 16.25})).toBe(true);
    });

    it("is seen past no corner of a block, however little of it a line cuts", () => {
        // A line cutting a block's corner by a sliver, shorter than any sampling along it would have stepped.
        const voxels = strewnRoom([{row: 32, col: 32, layer: 1}]);
        const corner = {x: 16, y: 0.75, z: 16};
        const from = {x: corner.x - 2, y: corner.y, z: corner.z + 2.02};
        const to = {x: corner.x + 2.02, y: corner.y, z: corner.z - 2};
        expect(VoxelQueryUtil.isLineClear(voxels, from, to)).toBe(false);
        expect(VoxelQueryUtil.isLineClear(voxels, from, {...to, x: to.x - 0.04})).toBe(true);
    });

    it("is seen exactly where no block's box meets the line, whatever the line and the blocks", () => {
        // Each block's box the line passes through, found by clipping the line to each in turn.
        const anyBlockOnLine = (voxels: Voxel[], from: Vec3, to: Vec3): boolean => {
            const point = {center: from, halfSize: {x: 0, y: 0, z: 0}};
            for (let row = Math.min(rowOf(from.z), rowOf(to.z)); row <= Math.max(rowOf(from.z), rowOf(to.z)); ++row)
                for (let col = Math.min(colOf(from.x), colOf(to.x)); col <= Math.max(colOf(from.x), colOf(to.x)); ++col)
                    for (let layer = 0; layer < 6; ++layer)
                    {
                        if (VoxelQueryUtil.isVoxelBlockPresentAt(voxels, row, col, layer) && Geometry3DUtil.castAABBAgainstAABB(
                            point, to, VoxelQueryUtil.getVoxelBlockBox(row, col, layer)).hitRayScale < 1)
                            return true;
                    }
            return false;
        };
        // Off the grid's lines by odd amounts, so that no line is drawn exactly through a corner, where it touches a box.
        const placeNearMiddle = fc.record({x: fc.integer({min: 1300, max: 1900}), y: fc.integer({min: 5, max: 295}),
            z: fc.integer({min: 1300, max: 1900})}).map(({x, y, z}) => ({x: x / 100 + 0.00313, y: y / 100 + 0.00471,
            z: z / 100 + 0.00719}));
        fc.assert(fc.property(fc.array(BLOCK_NEAR_MIDDLE, {maxLength: 60}), placeNearMiddle, placeNearMiddle,
            (blocks, from, to) => {
                const voxels = strewnRoom(blocks);
                expect(VoxelQueryUtil.isLineClear(voxels, from, to)).toBe(!anyBlockOnLine(voxels, from, to));
            }), {numRuns: 400});
    });

    it("counts anything beyond the room as a block", () => {
        const voxels = strewnRoom([]);
        expect(DollarBillFlightUtil.isInBlock(voxels, {x: -1, y: LYING_Y, z: MIDDLE_Z})).toBe(true);
        expect(DollarBillFlightUtil.isInBlock(voxels, {x: MIDDLE_X, y: MAX_ROOM_Y + 1, z: MIDDLE_Z})).toBe(true);
    });

    it("is blown by a gust toward none of a few people, wherever they stand", () => {
        const voxels = strewnRoom([]);
        const from = {x: MIDDLE_X, y: LYING_Y, z: MIDDLE_Z};
        const PERSON = fc.record({x: fc.integer({min: 6, max: 26}), z: fc.integer({min: 6, max: 26})})
            .filter(({x, z}) => x != MIDDLE_X || z != MIDDLE_Z);
        // A few: fewer than the cones they keep it out of would take to fill the circle.
        const fewest = Math.round(Math.PI / GUST_MIN_ANGLE) - 1;
        fc.assert(fc.property(fc.array(PERSON, {minLength: 1, maxLength: fewest}), (people) => {
            const direction = DollarBillFlightUtil.pickGustDirection(voxels, from,
                people.map(({x, z}) => ({x, y: STANDING_Y, z})));
            for (const {x, z} of people)
            {
                const toPerson = Math.atan2(z - from.z, x - from.x);
                const off = Math.abs(Math.atan2(Math.sin(toPerson - Math.atan2(direction.z, direction.x)),
                    Math.cos(toPerson - Math.atan2(direction.z, direction.x))));
                expect(off).toBeGreaterThanOrEqual(GUST_MIN_ANGLE - 1e-9);
            }
        }), {numRuns: 200});
    });

    it("blows the way there is room to go, if it can, with nobody about", () => {
        const voxels = strewnRoom([]);
        // Walled in but for the way east.
        for (let layer = 0; layer < 7; ++layer)
        {
            for (let row = 28; row < 36; ++row)
                VoxelQueryUtil.getVoxel(voxels, row, 29)!.blockLayerMask |= 1 << layer;
            for (let col = 29; col < 42; ++col)
            {
                VoxelQueryUtil.getVoxel(voxels, 29, col)!.blockLayerMask |= 1 << layer;
                VoxelQueryUtil.getVoxel(voxels, 33, col)!.blockLayerMask |= 1 << layer;
            }
        }
        for (let i = 0; i < 30; ++i)
        {
            const direction = DollarBillFlightUtil.pickGustDirection(voxels, {x: 15.5, y: LYING_Y, z: 15.75}, []);
            expect(direction.x).toBeGreaterThan(0);
        }
    });

    describe("on a gust", () => {
        const FROM = {x: MIDDLE_X, y: LYING_Y, z: MIDDLE_Z};

        function distanceFrom(from: Vec3, to: Vec3): number
        {
            return Math.hypot(to.x - from.x, to.z - from.z);
        }

        function gusts(count: number): ObjectWaypoint[][]
        {
            const voxels = strewnRoom([]);
            return Array.from({length: count}, () => DollarBillFlightUtil.planGust(voxels, FROM, []));
        }

        it("takes a different curve each time: rising early or late, and bending either way", () => {
            const peaks: number[] = [];
            const bends: number[] = [];
            for (const path of gusts(200))
            {
                const heights = path.map(({pos}) => pos.y);
                const highest = Math.max(...heights);
                if (highest > LYING_Y + 0.3)
                    peaks.push(heights.indexOf(highest) / path.length);

                // How far it strays from the straight way to where it ends, to either side of it.
                const end = path[path.length - 1].pos;
                const length = Math.max(0.001, distanceFrom(FROM, end));
                const offsets = path.map(({pos}) => ((pos.x - FROM.x) * (end.z - FROM.z)
                    - (pos.z - FROM.z) * (end.x - FROM.x)) / length);
                bends.push(offsets.reduce((most, offset) => Math.abs(offset) > Math.abs(most) ? offset : most, 0));
            }
            expect(Math.max(...peaks) - Math.min(...peaks)).toBeGreaterThan(0.4);
            expect(Math.max(...bends)).toBeGreaterThan(0.3);
            expect(Math.min(...bends)).toBeLessThan(-0.3);
        });

        it("sometimes skids along the floor without rising at all", () => {
            expect(gusts(200).some(path => Math.max(...path.map(({pos}) => pos.y)) <= LYING_Y + 0.01)).toBe(true);
        });

        it("is sometimes a blow, going several times as far as a gust does, as one path", () => {
            const distances = gusts(200).map(path => distanceFrom(FROM, path[path.length - 1].pos))
                .sort((a, b) => a - b);
            expect(distances[distances.length - 1]).toBeGreaterThan(3 * distances[100]);
            expect(distances[100]).toBeLessThan(6);
        });

        it("drops like a leaf, not straight down", () => {
            const voxels = strewnRoom([]);
            for (let i = 0; i < 20; ++i)
            {
                const from = {x: MIDDLE_X, y: 3, z: MIDDLE_Z};
                const path = DollarBillFlightUtil.planFlutterDown(voxels, from);
                expect(Math.max(...path.map(({pos}) => distanceFrom(from, pos)))).toBeGreaterThan(0.05);
                expect(path[path.length - 1].pos.y).toBeCloseTo(LYING_Y);
            }
        });

        it("brings it no nearer to anyone close by, wherever its curve goes, or else doesn't blow", () => {
            const voxels = strewnRoom([]);
            const PERSON = fc.record({x: fc.integer({min: 6, max: 26}), z: fc.integer({min: 6, max: 26})})
                .filter(({x, z}) => x != MIDDLE_X || z != MIDDLE_Z);
            fc.assert(fc.property(fc.array(PERSON, {minLength: 1, maxLength: 5}), (people) => {
                const path = DollarBillFlightUtil.planGust(voxels, FROM, people.map(({x, z}) => ({x, y: STANDING_Y, z})));
                for (const {x, z} of people)
                {
                    const person = {x, y: STANDING_Y, z};
                    const nearest = Math.min(DOLLAR_BILL_REACH + 1, distanceFrom(FROM, person));
                    for (const {pos} of path)
                        expect(distanceFrom(pos, person)).toBeGreaterThanOrEqual(nearest - 1e-9);
                }
            }), {numRuns: 100});
        });

        it("doesn't blow at all with people close all round", () => {
            const voxels = strewnRoom([]);
            const people = Array.from({length: 16}, (_, i) => ({x: FROM.x + 0.9 * Math.cos(i * Math.PI / 8), y: STANDING_Y,
                z: FROM.z + 0.9 * Math.sin(i * Math.PI / 8)}));
            for (let i = 0; i < 20; ++i)
                expect(DollarBillFlightUtil.planGust(voxels, FROM, people)).toEqual([]);
        });
    });
});

describe("how a bill lies", () => {
    const COORDINATE = fc.integer({min: 0, max: 31_999}).map(n => n / 1000);
    const HEIGHT = fc.integer({min: 0, max: 7_999}).map(n => n / 1000);

    it("is the same on every screen, whether a flight's end or the room said where it stopped", () => {
        fc.assert(fc.property(COORDINATE, HEIGHT, COORDINATE, (x, y, z) => {
            const pos = {x, y, z};
            const toldByPath = (SetObjectPathSignal.decode(roundTrip(new SetObjectPathSignal(HUB_ID, "@7",
                [{pos, speed: 1}]))) as SetObjectPathSignal).waypoints[0].pos;
            const toldByRoom = (AddObjectSignal.decode(roundTrip(new AddObjectSignal(HUB_ID, "", "", BILL_TYPE_INDEX, "@7",
                new ObjectTransform(pos, {x: 0, y: 0, z: 1}, {...UNIT_VEC3})))) as AddObjectSignal).transform.pos;
            expect(toldByRoom).toEqual(toldByPath);
            expect(DollarBillPoseUtil.getRestPose("@7", toldByRoom)).toEqual(DollarBillPoseUtil.getRestPose("@7", toldByPath));
        }), {numRuns: 300});
    });

    it("differs from bill to bill and place to place: standing, or flat on either half, turned any way", () => {
        const poses = Array.from({length: 300}, (_, i) => DollarBillPoseUtil.getRestPose(`@${i}`, {x: 3 + i / 50, y: 0.2, z: 7}));
        expect(new Set(poses.map(({lean}) => lean))).toEqual(new Set(LEANS));
        for (const lean of LEANS)
            expect(poses.filter(pose => pose.lean == lean).length).toBeGreaterThan(50);
        expect(new Set(poses.map(({yaw}) => Math.floor(yaw))).size).toBe(7);
        expect(DollarBillPoseUtil.getRestPose("@7", {x: 3, y: 0.2, z: 7}))
            .not.toEqual(DollarBillPoseUtil.getRestPose("@7", {x: 4, y: 0.2, z: 7}));
    });
});

describe("bills in a room", () => {
    it("are no one's to add, move, change or remove by any signal", () => {
        const config = DollarBillObjectTypeConfig;
        expect(config.persistent).toBe(false);
        expect(config.canUserAddObject()).toBe(false);
        expect(config.canUserRemoveObject()).toBe(false);
        expect(config.canUserSetObjectTransform()).toBe(false);
        expect(config.canUserSetObjectMetadata()).toBe(false);
    });

    it("refuses a user's signal to take one or forge one", async () => {
        holdGusts();
        const user = await join("someone");
        const bill = spawnBill();
        expect(ServerObjectManager.onRemoveObjectSignalReceived(user.socketUserContext,
            new RemoveObjectSignal(HUB_ID, bill.objectId))).toBe(false);
        expect(getBills()).toHaveLength(1);
        expect(ServerObjectManager.onAddObjectSignalReceived(user.socketUserContext, new AddObjectSignal(HUB_ID, user.user.id,
            user.user.userName, BILL_TYPE_INDEX, "forged", new ObjectTransform({x: 10, y: 1, z: 10}, {x: 0, y: 0, z: 1},
                {...UNIT_VEC3})))).toBe(false);
        expect(getBills()).toHaveLength(1);
    });

    it(`come ${SPAWN_INTERVAL_MS[0] / 1000} seconds after the wait starts at the soonest`, async () => {
        await join("someone");
        vi.spyOn(Math, "random").mockReturnValue(0);
        flush();
        flushFor(SPAWN_INTERVAL_MS[0] - 1_000);
        expect(getBills()).toHaveLength(0);
        flushFor(2_000);
        expect(getBills()).toHaveLength(1);
    });

    it(`come ${SPAWN_INTERVAL_MS[1] / 1000} seconds after it at the latest`, async () => {
        await join("someone");
        vi.spyOn(Math, "random").mockReturnValue(0.999);
        flush();
        flushFor(SPAWN_INTERVAL_MS[1] - 2_000);
        expect(getBills()).toHaveLength(0);
        flushFor(2_000);
        expect(getBills()).toHaveLength(1);
    });

    it("come at places someone can walk to, in no block and at no one's feet, each new each time", async () => {
        holdGusts();
        const user = await join("someone", {x: MIDDLE_X, y: STANDING_Y, z: MIDDLE_Z});
        const places = new Set<string>();
        for (let i = 0; i < MAX_BILLS; ++i)
        {
            const before = getBills().length;
            flushUntil(() => getBills().length > before);
            const {pos} = getBills()[before].transform;
            expect(DollarBillFlightUtil.isInBlock(getRoom().voxelGrid.voxels, pos)).toBe(false);
            const toUser = harness.getPlayerObject(user.user.id)!.transform.pos;
            expect(Math.hypot(pos.x - toUser.x, pos.z - toUser.z)).toBeGreaterThan(DOLLAR_BILL_REACH);
            // Over the floor the user stands on, which a generated room's other storey isn't.
            expect(pos.y).toBeLessThan(STOREY_FLOOR_COLLISION_LAYER * COLLISION_LAYER_HEIGHT);
            places.add(`${pos.x},${pos.z}`);
        }
        expect(places.size).toBe(MAX_BILLS);
    });

    it("come at no one's feet however many are in the room", async () => {
        const users = await Promise.all(["a", "b", "c", "d", "e"].map((id, i) =>
            join(id, {x: 5 + 5 * i, y: STANDING_Y, z: 5 + 5 * i})));
        flushUntil(() => getBills().length == 1);
        const {pos} = getBills()[0].transform;
        for (const user of users)
        {
            const feet = VoxelPathUtil.feetOf(harness.getPlayerObject(user.user.id)!.transform.pos);
            expect(Math.hypot(pos.x - feet.x, pos.z - feet.z)).toBeGreaterThan(DOLLAR_BILL_REACH);
        }
    });

    it("never come where nobody could walk to, even with a sealed-off part of the room", async () => {
        holdGusts();
        await join("someone", {x: 4, y: STANDING_Y, z: 4});
        // A wall from side to side, with the user on its near side.
        for (let layer = 0; layer < STOREY_FLOOR_COLLISION_LAYER; ++layer)
        {
            for (let col = 0; col < NUM_VOXEL_COLS; ++col)
            {
                const voxel = VoxelQueryUtil.getVoxel(getRoom().voxelGrid.voxels, 24, col);
                if (voxel != undefined)
                    voxel.blockLayerMask |= 1 << layer;
            }
        }
        for (let i = 0; i < MAX_BILLS; ++i)
        {
            const before = getBills().length;
            flushUntil(() => getBills().length > before);
            expect(getBills()[before].transform.pos.z).toBeLessThan(12);
        }
    });

    it("stop at the room's cap, however long it stays full", async () => {
        holdGusts();
        await join("someone");
        flushUntil(() => getBills().length == MAX_BILLS, MAX_BILLS * SPAWN_INTERVAL_MS[1] + 60_000);
        flushFor(MAX_BILLS * SPAWN_INTERVAL_MS[1]);
        expect(getBills()).toHaveLength(MAX_BILLS);
    });

    it(`start another wait once one has gone: no sooner than ${SPAWN_INTERVAL_MS[0] / 1000} seconds after`, async () => {
        holdGusts();
        const user = await join("someone", {x: 4, y: STANDING_Y, z: 4});
        flushUntil(() => getBills().length == MAX_BILLS, MAX_BILLS * SPAWN_INTERVAL_MS[1] + 60_000);
        vi.spyOn(Math, "random").mockReturnValue(0);
        flushFor(SPAWN_INTERVAL_MS[1]);

        // Blown to the user's feet, and no other with it.
        Object.assign(getBills()[0].transform.pos, {x: 4.5, y: LYING_Y, z: 4});
        faceToward(user, 4.5, 4);
        flush();
        expect(getBills()).toHaveLength(MAX_BILLS - 1);
        flushFor(SPAWN_INTERVAL_MS[0] - 1_000);
        expect(getBills()).toHaveLength(MAX_BILLS - 1);
        flushFor(2_000);
        expect(getBills()).toHaveLength(MAX_BILLS);
    });

    it("don't come with nobody in the room", async () => {
        await harness.loadRoom(HUB_ID);
        flushFor(2 * SPAWN_INTERVAL_MS[1]);
        expect(getBills()).toHaveLength(0);
    });

    it("neither come nor move with only a ghost in the room, though the ghost collects one left there", async () => {
        const user = await join("someone");
        const bill = spawnBill();
        await harness.disconnectUser(user);
        // Within reach of it, but facing away until the end.
        const ghost = await joinAsGhost("ghost", {x: MIDDLE_X - WITHIN_REACH, y: STANDING_Y, z: MIDDLE_Z});
        faceToward(ghost, 0, MIDDLE_Z);
        flushFor(2 * SPAWN_INTERVAL_MS[1]);
        expect(getBills().map(({objectId}) => objectId)).toEqual([bill.objectId]);
        expect(bill.transform.pos).toMatchObject({x: MIDDLE_X, y: LYING_Y, z: MIDDLE_Z});
        expect(pathsSentTo(ghost, bill.objectId)).toEqual([]);

        faceToward(ghost, MIDDLE_X, MIDDLE_Z);
        flush();
        expect(getBills()).toHaveLength(0);
        expect(ghost.socketUserContext.inventory[DOLLAR]).toBe(1);
    });

    it("come and are blown about making way for a ghost as for anyone, with someone else in the room", async () => {
        // Each facing into a corner, where no bill comes or is blown.
        const ghost = await joinAsGhost("ghost", {x: 4, y: STANDING_Y, z: 4});
        faceToward(ghost, 0, 0);
        const other = await join("other", {x: 28, y: STANDING_Y, z: 28});
        faceToward(other, 32, 32);
        flushUntil(() => getBills().length == 1);
        const [bill] = getBills();
        const at = harness.getPlayerObject(ghost.user.id)!.transform.pos;
        expect(Math.hypot(bill.transform.pos.x - at.x, bill.transform.pos.z - at.z)).toBeGreaterThan(DOLLAR_BILL_REACH);

        const gusts = vi.spyOn(DollarBillFlightUtil, "planGust");
        flushUntil(() => gusts.mock.calls.length > 0, GUST_WITHIN_MS);
        expect(gusts.mock.calls[0][2]).toContainEqual(at);
    });

    it("are announced to everyone in the room, and are in what a newcomer is sent", async () => {
        const watcher = await join("watcher");
        const bill = spawnBill();
        expect(getPendingSignals(watcher, "addObjectSignal").map((added: AddObjectSignal) => added.objectId))
            .toContain(bill.objectId);
        expect(getRoom().objectById[bill.objectId]).toBeDefined();
    });

    it("are kept by the room's saves, under ids of their own, but by no file of it, and mark nothing to save", async () => {
        const user = await join("someone");
        const bill = spawnBill();
        const room = getRoom();
        expect(room.dirty).toBe(false);
        expect(Object.keys(RoomFile.fromRoom(room).objectGroup.objectById)).not.toContain(bill.objectId);
        // Not one of the server's own, which start over with each restart that the saves keep it through.
        expect(bill.objectId[0]).not.toBe(ServerObjectManager.generateNonPersistentObjectId()[0]);

        // The real save, what it would store kept here.
        const {default: storingDBRoomUtil} = await vi.importActual<typeof import("../../../src/server/db/util/dbRoomUtil")>(
            "../../../src/server/db/util/dbRoomUtil");
        const saveFile = vi.spyOn(DBFileStorageUtil, "saveBinaryFile").mockResolvedValue(true);
        expect(await storingDBRoomUtil.saveRoomContent(room)).toBe(true);
        const bufferState = new BufferState(new Uint8Array(saveFile.mock.calls[0][1]));
        const voxelGrid = VoxelGrid.decode(bufferState) as VoxelGrid;
        const storedObjects = (ObjectGroup.decodeWithParams(bufferState, room.id, voxelGrid) as ObjectGroup).objectById;
        const storedBill = storedObjects[bill.objectId];
        expect(storedBill).toBeDefined();
        // As finely as a room stores where anything is.
        for (const axis of ["x", "y", "z"] as const)
            expect(storedBill.transform.pos[axis]).toBeCloseTo(bill.transform.pos[axis], 2);
        expect(storedObjects[harness.getPlayerObject(user.user.id)!.objectId]).toBeUndefined();
    });

    it("come back as they lay when the room loads again, and are collected as any", async () => {
        const user = await join("someone");
        const bill = spawnBill();
        const lay = {...bill.transform.pos};
        await harness.disconnectUser(user);
        // As after a restart or its unloading: the harness's store hands back the room as it was kept.
        ServerRoomManager.unloadRoom(HUB_ID);
        await harness.loadRoom(HUB_ID);
        expect(getBills().map(({objectId}) => objectId)).toEqual([bill.objectId]);
        expect(bill.transform.pos).toEqual(lay);

        const newcomer = await join("newcomer", {x: lay.x - WITHIN_REACH, y: STANDING_Y, z: lay.z});
        faceToward(newcomer, lay.x, lay.z);
        flush();
        expect(getBills()).toHaveLength(0);
        expect(newcomer.socketUserContext.inventory[DOLLAR]).toBe(1);
    });

    it("count toward the cap of the room they come back to, which tries to add none past it", async () => {
        holdGusts();
        const user = await join("someone");
        flushUntil(() => getBills().length == MAX_BILLS, MAX_BILLS * SPAWN_INTERVAL_MS[1] + 60_000);
        const kept = getBills().map(({objectId}) => objectId);
        await harness.disconnectUser(user);
        ServerRoomManager.unloadRoom(HUB_ID);
        await harness.loadRoom(HUB_ID);

        await join("newcomer");
        const adding = vi.spyOn(ServerObjectManager, "addObjectAsServer");
        flushFor(2 * SPAWN_INTERVAL_MS[1]);
        expect(getBills().map(({objectId}) => objectId)).toEqual(kept);
        expect(adding).not.toHaveBeenCalled();
    });

    it("keep still once the server starts shutting down, and each room stepped since it loaded is saved", async () => {
        const OTHER_HUB_ID = "hubBBBBBBBBBBBBBBBBB";
        harness.seedHub(OTHER_HUB_ID);
        await harness.loadRoom(OTHER_HUB_ID);
        const user = await join("someone");
        const bill = spawnBill();
        const lay = {...bill.transform.pos};
        const room = getRoom();

        // Within its reach and facing it, with gusts coming due.
        vi.spyOn(ServerLifecycleUtil, "isShuttingDown").mockReturnValue(true);
        moveTo(user, {x: lay.x - WITHIN_REACH, y: STANDING_Y, z: lay.z});
        faceToward(user, lay.x, lay.z);
        flushFor(GUST_WITHIN_MS);
        expect(getBills().map(({objectId}) => objectId)).toEqual([bill.objectId]);
        expect(bill.transform.pos).toEqual(lay);
        expect(user.socketUserContext.inventory[DOLLAR]).toBeUndefined();

        expect(room.dirty).toBe(false);
        const save = vi.mocked(DBRoomUtil.saveRoomContent);
        save.mockClear();
        await harness.gracefulShutdown();
        expect(save.mock.calls.some(([saved]) => saved === room)).toBe(true);
        expect(save.mock.calls.some(([saved]) => saved.id == OTHER_HUB_ID)).toBe(false);
    });

    it("go with the old room when a room file is loaded over it", async () => {
        await join("someone");
        spawnBill();
        expect(await ServerRoomManager.loadRoomFile(HUB_ID, RoomFile.fromRoom(createTestRoom(HUB_ID, HUB_ID, RoomTypeEnumMap.Hub))))
            .toBe(true);
        expect(getBills()).toHaveLength(0);
        // And the room's life goes on without them.
        flushUntil(() => getBills().length == 1);
    });

    it("are left as they lie in a hub once nobody is there, and go on once someone is", async () => {
        const user = await join("someone");
        const bill = spawnBill();
        await harness.disconnectUser(user);
        const {x, z} = bill.transform.pos;
        flushFor(GUST_WITHIN_MS);
        expect(bill.transform.pos).toMatchObject({x, z});

        const newcomer = await join("newcomer", {x: 4, y: STANDING_Y, z: 4});
        flushUntil(() => pathsSentTo(newcomer, bill.objectId).length > 0, GUST_WITHIN_MS);
    });
});

describe("a gust", () => {
    it("comes now and then, blows a bill elsewhere, and leaves it lying", async () => {
        const watcher = await join("watcher");
        const bill = spawnBill();
        flushUntil(() => pathsSentTo(watcher, bill.objectId).length > 0, GUST_WITHIN_MS);
        const [path] = pathsSentTo(watcher, bill.objectId);

        const end = path[path.length - 1].pos;
        flushUntil(() => DollarBillUtil.getCatchUpSignals(HUB_ID).length == 0, 20_000);
        expect(bill.transform.pos).toEqual(end);
        expect(end.y).toBeCloseTo(LYING_Y);
    });

    it("isn't followed by another until a while after it has landed, however long it blew for", async () => {
        const watcher = await join("watcher");
        const bill = spawnBill();
        // A flight longer than the shortest wait between gusts, which is the wait each time.
        const away = GUST_INTERVAL_MS[0] / 1000;
        const end = {x: MIDDLE_X - away, y: LYING_Y, z: MIDDLE_Z - away};
        const flightMs = 1000 * Math.hypot(away, away);
        vi.spyOn(DollarBillFlightUtil, "planGust").mockReturnValue([{pos: end, speed: 1}]);
        vi.spyOn(Math, "random").mockReturnValue(0);
        flushUntil(() => pathsSentTo(watcher, bill.objectId).length > 0, GUST_WITHIN_MS);
        flushUntil(() => bill.transform.pos.x == end.x, flightMs + 1_400);

        flushFor(GUST_INTERVAL_MS[0] - 200);
        expect(pathsSentTo(watcher, bill.objectId)).toHaveLength(1);
        flushFor(1_000);
        expect(pathsSentTo(watcher, bill.objectId)).toHaveLength(2);
    });

    it("is told to everyone in the room once, the whole way at once", async () => {
        const watchers = [await join("first"), await join("second")];
        const bill = spawnBill();
        flushUntil(() => pathsSentTo(watchers[0], bill.objectId).length > 0, GUST_WITHIN_MS);
        expect(pathsSentTo(watchers[0], bill.objectId)).toHaveLength(1);
        expect(pathsSentTo(watchers[0], bill.objectId)[0].length).toBeGreaterThan(2);
        expect(pathsSentTo(watchers[1], bill.objectId)).toEqual(pathsSentTo(watchers[0], bill.objectId));
    });

    it("tells whoever comes in during a flight the rest of it", async () => {
        const watcher = await join("watcher");
        const bill = spawnBill();
        flushUntil(() => pathsSentTo(watcher, bill.objectId).length > 0, GUST_WITHIN_MS);
        const [path] = pathsSentTo(watcher, bill.objectId);

        const newcomer = await join("newcomer", {x: 28, y: STANDING_Y, z: 28});
        const [rest] = pathsSentTo(newcomer, bill.objectId);
        expect(rest.length).toBeGreaterThan(0);
        expect(rest[rest.length - 1]).toEqual(path[path.length - 1]);
    });

    it("tells a newcomer nothing of a bill lying still", async () => {
        await join("watcher");
        const bill = spawnBill();
        flushUntil(() => DollarBillUtil.getCatchUpSignals(HUB_ID).length == 0, 10_000);
        const newcomer = await join("newcomer");
        expect(pathsSentTo(newcomer, bill.objectId)).toEqual([]);
    });

    it("never takes one into a block a moment later", async () => {
        const watcher = await join("watcher");
        const bill = spawnBill();
        for (let elapsed = 0; elapsed < 6 * GUST_INTERVAL_MS[1]; elapsed += FLUSH_MS)
        {
            flush();
            expect(DollarBillFlightUtil.isInBlock(getRoom().voxelGrid.voxels, bill.transform.pos)).toBe(false);
        }
        expect(pathsSentTo(watcher, bill.objectId).length).toBeGreaterThan(2);
    });
});

describe("a fan's stream", () => {
    // Facing up out of the floor, and across the room out of the boundary wall, at the height of a bill on the floor.
    const FLOOR_FAN = {x: 12.5, y: 0, z: 12.5};
    const UP = {x: 0, y: 1, z: 0};
    const WALL_FAN = {x: INITIAL_MULTI_PLAYER_ENTRANCE_POS.x - 5, y: 0.5, z: INITIAL_MULTI_PLAYER_ENTRANCE_POS.z};
    const INTO_THE_ROOM = {x: 0, y: 0, z: -1};

    it("blows a bill lying in it along it, to the end of its reach and down", async () => {
        const watcher = await join("watcher", {x: 28, y: STANDING_Y, z: 4});
        const bill = spawnBill(20, 20);
        addFan("fan", WALL_FAN, INTO_THE_ROOM);
        Object.assign(bill.transform.pos, {x: WALL_FAN.x, z: WALL_FAN.z - 1});
        flush();

        const paths = pathsSentTo(watcher, bill.objectId);
        expect(paths).toHaveLength(1);
        const end = paths[0][paths[0].length - 1].pos;
        // Give or take how it glides and swings as it drops.
        const reach = WALL_FAN.z - FAN_SETTINGS[1].range;
        expect(Math.abs(end.z - reach)).toBeLessThan(2);
        expect(Math.abs(end.x - WALL_FAN.x)).toBeLessThan(1.25);
        expect(end.y).toBeCloseTo(LYING_Y);
    });

    it("carries it faster the stronger the fan", async () => {
        const watcher = await join("watcher", {x: 28, y: STANDING_Y, z: 4});
        const speeds: number[] = [];
        const bill = spawnBill(20, 20);
        for (const [i, setting] of FAN_SETTINGS.entries())
        {
            addFan(`fan${i}`, WALL_FAN, INTO_THE_ROOM, setting);
            Object.assign(bill.transform.pos, {x: WALL_FAN.x, y: LYING_Y, z: WALL_FAN.z - 1});
            const flown = pathsSentTo(watcher, bill.objectId).length;
            flush();
            speeds.push(pathsSentTo(watcher, bill.objectId)[flown][0].speed);
            flushUntil(() => DollarBillUtil.getCatchUpSignals(HUB_ID).length == 0, 30_000);
            expect(ServerObjectManager.removeObjectAsServer(getRoom(), ADMIN, new RemoveObjectSignal(HUB_ID, `fan${i}`))).toBe(true);
        }
        expect(speeds[0]).toBeLessThan(speeds[1]);
        expect(speeds[1]).toBeLessThan(speeds[2]);
    });

    it("lifts a bill over an upward fan and lets it drop back, over and over", async () => {
        const watcher = await join("watcher", {x: 28, y: STANDING_Y, z: 28});
        const bill = spawnBill(FLOOR_FAN.x, FLOOR_FAN.z);
        addFan("fan", FLOOR_FAN, UP);

        flushFor(30_000);
        const paths = pathsSentTo(watcher, bill.objectId);
        expect(paths.length).toBeGreaterThan(2);
        for (const path of paths)
        {
            expect(Math.max(...path.map(({pos}) => pos.y))).toBeGreaterThan(2);
            expect(path[path.length - 1].pos.y).toBeCloseTo(LYING_Y);
        }
    });

    it("stops with a wall in its way, and sends nothing while there is nowhere to go", async () => {
        const watcher = await join("watcher", {x: 28, y: STANDING_Y, z: 4});
        holdGusts();
        const bill = spawnBill(20, 20);
        // A wall across the stream, a little way down it.
        const wallRow = rowOf(WALL_FAN.z - 3);
        for (let col = colOf(WALL_FAN.x) - 4; col <= colOf(WALL_FAN.x) + 4; ++col)
        {
            for (let layer = 0; layer < 4; ++layer)
                placeBlock(wallRow, col, layer);
        }
        addFan("fan", WALL_FAN, INTO_THE_ROOM);
        Object.assign(bill.transform.pos, {x: WALL_FAN.x, z: WALL_FAN.z - 1});
        flushFor(3_000);
        const wallFace = (wallRow + 1) * VOXEL_CELL_SIZE;
        expect(bill.transform.pos.z).toBeGreaterThanOrEqual(wallFace);
        expect(bill.transform.pos.z).toBeLessThan(wallFace + FLIGHT_CLEARANCE + 0.2);

        const flown = pathsSentTo(watcher, bill.objectId).length;
        flushFor(2_000);
        expect(pathsSentTo(watcher, bill.objectId)).toHaveLength(flown);
    });

    it("leaves a bill to the strongest of fans overlapping, and everyone sees the same of it, however long", async () => {
        const watchers = [await join("first", {x: 28, y: STANDING_Y, z: 4}), await join("second", {x: 28, y: STANDING_Y, z: 28})];
        const bill = spawnBill(20, 20);
        const place = {x: WALL_FAN.x + 0.5, y: LYING_Y, z: WALL_FAN.z - 2};
        addFan("weak", WALL_FAN, INTO_THE_ROOM, FAN_SETTINGS[0]);
        addFan("strong", {...WALL_FAN, x: WALL_FAN.x + 1}, INTO_THE_ROOM, FAN_SETTINGS[2]);
        addFan("under", {x: place.x, y: 0, z: place.z}, UP, FAN_SETTINGS[1]);
        Object.assign(bill.transform.pos, place);

        // One flight at a time, however many hold it, and none laid over it until it is done.
        flush();
        expect(pathsSentTo(watchers[0], bill.objectId)).toHaveLength(1);
        const [path] = pathsSentTo(watchers[0], bill.objectId);
        const seconds = ObjectPathUtil.getSeconds(path, place);
        flushFor(1000 * seconds - 2 * FLUSH_MS);
        expect(pathsSentTo(watchers[0], bill.objectId)).toHaveLength(1);

        flushFor(30_000);
        expect(pathsSentTo(watchers[0], bill.objectId).length).toBeGreaterThan(1);
        expect(pathsSentTo(watchers[1], bill.objectId)).toEqual(pathsSentTo(watchers[0], bill.objectId));
        // The upward fan can go on tossing it for as long as it comes down over the fan, so it may not be down yet.
        const isDown = () => DollarBillUtil.getCatchUpSignals(HUB_ID).length == 0;
        for (let waited = 0; waited < 30_000 && !isDown(); waited += FLUSH_MS)
            flush();
        const paths = pathsSentTo(watchers[0], bill.objectId);
        const lastPath = paths[paths.length - 1];
        if (isDown() && getBills().includes(bill))
            expect(bill.transform.pos).toEqual(lastPath[lastPath.length - 1].pos);
    });

    it("takes a bill out of a gust's flight as it crosses it", async () => {
        const watcher = await join("watcher", {x: 28, y: STANDING_Y, z: 28});
        const bill = spawnBill(FLOOR_FAN.x + 1.5, FLOOR_FAN.z);
        addFan("fan", FLOOR_FAN, UP);
        Object.assign(bill.transform.pos, {x: FLOOR_FAN.x, y: 1.5, z: FLOOR_FAN.z});
        flush();
        const [path] = pathsSentTo(watcher, bill.objectId);
        expect(path[0].pos.y).toBeGreaterThan(1.5);
    });

    it("has no hold on a bill out of its reach", async () => {
        const watcher = await join("watcher", {x: 28, y: STANDING_Y, z: 28});
        const bill = spawnBill(FLOOR_FAN.x + 3, FLOOR_FAN.z);
        holdGusts();
        addFan("fan", FLOOR_FAN, UP);
        flushFor(2_000);
        expect(pathsSentTo(watcher, bill.objectId)).toEqual([]);
        expect(PhysicsManager.getStrongestStream(HUB_ID, {center: bill.transform.pos,
            halfSize: {x: 0.3, y: 0.2, z: 0.3}})).toBeUndefined();
    });
});

describe("a bill under what the room does", () => {
    it("is destroyed by a block laid over it, with nobody the richer", async () => {
        const watcher = await join("watcher");
        holdGusts();
        const bill = spawnBill();
        placeBlock(rowOf(MIDDLE_Z), colOf(MIDDLE_X), 0);
        flush();
        expect(getBills()).toHaveLength(0);
        expect(removalsSentTo(watcher)).toContain(bill.objectId);
        expect(collectionsSentTo(watcher)).toEqual([]);
        expect(watcher.socketUserContext.inventory[DOLLAR]).toBeUndefined();
    });

    it("falls when what it lies on is taken away", async () => {
        const watcher = await join("watcher");
        holdGusts();
        const bill = spawnBill();
        placeBlock(rowOf(MIDDLE_Z), colOf(MIDDLE_X), 0);
        Object.assign(bill.transform.pos, {y: COLLISION_LAYER_HEIGHT + LYING_Y});
        flush();
        expect(getBills()).toHaveLength(1);

        expect(VoxelUpdateUtil.removeVoxelBlock(ADMIN, getRoom().voxelGrid.voxels,
            VoxelQueryUtil.getVoxelQuadIndex(rowOf(MIDDLE_Z), colOf(MIDDLE_X), "y", "-", 0), getRoom())).toBe(true);
        flushFor(2_000);
        expect(bill.transform.pos.y).toBeCloseTo(LYING_Y);
        expect(pathsSentTo(watcher, bill.objectId)).toHaveLength(1);
    });
});

describe("collecting a bill", () => {
    const REACH_DEGREES = Math.round(REACH_ANGLE * 180 / Math.PI);

    // Someone in the middle of the floor looking east, and a bill as far ahead of them and to the south of that as asked.
    async function withBillBeforeUser(ahead: number, aside: number = 0, upward: number = 0)
    {
        const user = await join("someone", {x: MIDDLE_X, y: STANDING_Y, z: MIDDLE_Z});
        holdGusts();
        faceToward(user, 28, MIDDLE_Z);
        flush();
        const bill = spawnBill(4, 4);
        Object.assign(bill.transform.pos, {x: MIDDLE_X + ahead, y: LYING_Y + upward, z: MIDDLE_Z + aside});
        return {user, bill};
    }

    // The bill the scenes with something in the way are laid out for, which they need within reach.
    async function withObstructedBill()
    {
        expect(OBSTRUCTED_AHEAD, "the scene's bill is out of reach").toBeLessThan(DOLLAR_BILL_REACH);
        return await withBillBeforeUser(OBSTRUCTED_AHEAD);
    }

    function atAngle(degrees: number, distance: number): [number, number]
    {
        return [distance * Math.cos(degrees * Math.PI / 180), distance * Math.sin(degrees * Math.PI / 180)];
    }

    it("takes having it right ahead, at the farthest of a reach well past touching", async () => {
        const {user} = await withBillBeforeUser(DOLLAR_BILL_REACH - 0.01);
        flush();
        expect(getBills()).toHaveLength(0);
        expect(user.socketUserContext.inventory[DOLLAR]).toBe(1);
    });

    it("takes no more than that", async () => {
        const {user} = await withBillBeforeUser(DOLLAR_BILL_REACH + 0.01);
        flush();
        expect(getBills()).toHaveLength(1);
        expect(user.socketUserContext.inventory[DOLLAR]).toBeUndefined();
    });

    it(`works up to ${REACH_DEGREES} degrees to either side of the way they face`, async () => {
        for (const side of [1, -1])
        {
            harness.reset();
            harness.seedHub(HUB_ID);
            const [ahead, aside] = atAngle(side * (REACH_DEGREES - 1), WITHIN_REACH);
            await withBillBeforeUser(ahead, aside);
            flush();
            expect(getBills()).toHaveLength(0);
        }
    });

    it("doesn't work any wider than that, however near", async () => {
        for (const degrees of [REACH_DEGREES + 1, -(REACH_DEGREES + 1), 90, -90, 135])
        {
            harness.reset();
            harness.seedHub(HUB_ID);
            const [ahead, aside] = atAngle(degrees, 1);
            await withBillBeforeUser(ahead, aside);
            flush();
            expect(getBills()).toHaveLength(1);
        }
    });

    it("doesn't work on one behind them, touching them or not, until they turn to it", async () => {
        const {user} = await withBillBeforeUser(-0.5);
        flushFor(2_000);
        expect(getBills()).toHaveLength(1);

        faceToward(user, 4, MIDDLE_Z);
        flush();
        expect(getBills()).toHaveLength(0);
        expect(user.socketUserContext.inventory[DOLLAR]).toBe(1);
    });

    it("goes by the way they face across the room alone", async () => {
        const {user} = await withBillBeforeUser(WITHIN_REACH);
        const {transform} = harness.getPlayerObject(user.user.id)!;
        transform.dir = {x: -Math.SQRT1_2, y: Math.SQRT1_2, z: 0};
        flush();
        expect(getBills()).toHaveLength(0);
    });

    it("doesn't work through a wall, which a bill would have to fly through", async () => {
        const {user} = await withObstructedBill();
        const wallCol = colOf(MIDDLE_X + 1.5);
        for (const row of [rowOf(MIDDLE_Z) - 1, rowOf(MIDDLE_Z), rowOf(MIDDLE_Z) + 1])
        {
            for (let layer = 0; layer < 6; ++layer)
                placeBlock(row, wallCol, layer);
        }
        flush();
        expect(getBills()).toHaveLength(1);
        expect(user.socketUserContext.inventory[DOLLAR]).toBeUndefined();
    });

    it("works past a low step, which the eyes look over", async () => {
        const {user} = await withObstructedBill();
        placeBlock(rowOf(MIDDLE_Z), colOf(MIDDLE_X + 1.5), 0);
        flush();
        expect(user.socketUserContext.inventory[DOLLAR]).toBe(1);
    });

    it("works on one in the air, about as high over them as their own height", async () => {
        const upward = STANDING_Y + UPWARD_REACH - 0.05 - LYING_Y;
        await withBillBeforeUser(1, 0, upward);
        flush();
        expect(getBills()).toHaveLength(0);
    });

    it("doesn't work from any higher over them", async () => {
        const upward = STANDING_Y + UPWARD_REACH + 0.05 - LYING_Y;
        await withBillBeforeUser(1, 0, upward);
        flush();
        expect(getBills()).toHaveLength(1);
    });

    it("doesn't reach a bill on the floor from the storey above", async () => {
        const {user} = await withBillBeforeUser(1);
        moveTo(user, {x: MIDDLE_X, y: (STOREY_FLOOR_COLLISION_LAYER + 1) * COLLISION_LAYER_HEIGHT + STANDING_Y, z: MIDDLE_Z});
        flush();
        expect(getBills()).toHaveLength(1);
    });

    it("sees from their eyes, over what their middle couldn't see past", async () => {
        const {user} = await withObstructedBill();
        // Two blocks high and close by, a line from their middle to the bill passing into the upper one.
        const wall = colOf(MIDDLE_X + 0.75);
        placeBlock(rowOf(MIDDLE_Z), wall, 0);
        placeBlock(rowOf(MIDDLE_Z), wall, 1);
        const voxels = getRoom().voxelGrid.voxels;
        const middle = {x: MIDDLE_X, y: STANDING_Y, z: MIDDLE_Z};
        const billAt = {x: MIDDLE_X + OBSTRUCTED_AHEAD, y: LYING_Y, z: MIDDLE_Z};
        expect(VoxelQueryUtil.isLineClear(voxels, middle, billAt)).toBe(false);
        expect(VoxelQueryUtil.isLineClear(voxels, {...middle, y: STANDING_Y + PLAYER_EYE_HEIGHT}, billAt)).toBe(true);
        flush();
        expect(user.socketUserContext.inventory[DOLLAR]).toBe(1);
    });

    it("works on one at their feet, under the bottom of their view", async () => {
        const {user} = await withBillBeforeUser(0.3);
        flush();
        expect(user.socketUserContext.inventory[DOLLAR]).toBe(1);
    });

    it("doesn't work with someone else standing in the way, and does once they step aside", async () => {
        const {user} = await withBillBeforeUser(WITHIN_REACH);
        const inTheWay = await join("in the way", {x: MIDDLE_X + 1.5, y: STANDING_Y, z: MIDDLE_Z});
        faceToward(inTheWay, MIDDLE_X - 4, MIDDLE_Z);
        flushFor(1_000);
        expect(getBills()).toHaveLength(1);
        expect(user.socketUserContext.inventory[DOLLAR]).toBeUndefined();

        moveTo(inTheWay, {x: MIDDLE_X + 1.5, y: STANDING_Y, z: MIDDLE_Z + 2});
        flush();
        expect(user.socketUserContext.inventory[DOLLAR]).toBe(1);
        expect(inTheWay.socketUserContext.inventory[DOLLAR]).toBeUndefined();
    });

    it("works with a ghost in the way, whom nobody sees", async () => {
        const {user} = await withBillBeforeUser(WITHIN_REACH);
        const ghost = await joinAsGhost("ghost", {x: MIDDLE_X + 1.5, y: STANDING_Y, z: MIDDLE_Z});
        faceToward(ghost, MIDDLE_X - 4, MIDDLE_Z);
        flush();
        expect(user.socketUserContext.inventory[DOLLAR]).toBe(1);
        expect(ghost.socketUserContext.inventory[DOLLAR]).toBeUndefined();
    });

    it("doesn't work with a helper in the way", async () => {
        const {user} = await withBillBeforeUser(WITHIN_REACH);
        const npc = new AddObjectSignal(HUB_ID, ADMIN.id, ADMIN.userName, NPC_TYPE_INDEX, "a-helper",
            new ObjectTransform({x: MIDDLE_X + 1.5, y: 0, z: MIDDLE_Z}, {x: 0, y: 1, z: 0}, {...UNIT_VEC3}));
        expect(ServerObjectManager.addObjectAsServer(getRoom(), ADMIN, npc)).toBe(true);
        flushFor(1_000);
        expect(user.socketUserContext.inventory[DOLLAR]).toBeUndefined();

        ServerObjectManager.removeObjectAsServer(getRoom(), ADMIN, new RemoveObjectSignal(HUB_ID, npc.objectId));
        flush();
        expect(user.socketUserContext.inventory[DOLLAR]).toBe(1);
    });

    it("works with any of it in sight, however little shows past what is in the way", async () => {
        const {user} = await withObstructedBill();
        // A pillar just short of the bill, hiding its middle and all but one side of it.
        const pillarCol = colOf(MIDDLE_X + OBSTRUCTED_AHEAD - 0.75);
        for (let layer = 0; layer < 6; ++layer)
            placeBlock(rowOf(MIDDLE_Z + 0.1), pillarCol, layer);
        const bill = getBills()[0];
        Object.assign(bill.transform.pos, {z: MIDDLE_Z + 0.1});
        const eye = {x: MIDDLE_X, y: STANDING_Y + PLAYER_EYE_HEIGHT, z: MIDDLE_Z};
        const voxels = getRoom().voxelGrid.voxels;
        expect(VoxelQueryUtil.isLineClear(voxels, eye, bill.transform.pos)).toBe(false);
        expect(VoxelQueryUtil.isLineClear(voxels, eye, {...bill.transform.pos, z: bill.transform.pos.z - 0.15})).toBe(true);
        flush();
        expect(user.socketUserContext.inventory[DOLLAR]).toBe(1);
    });

    it("goes to the nearest of two who have it before them, once", async () => {
        const near = await join("near", {x: MIDDLE_X - 1, y: STANDING_Y, z: MIDDLE_Z});
        const far = await join("far", {x: MIDDLE_X + WITHIN_REACH, y: STANDING_Y, z: MIDDLE_Z});
        holdGusts();
        flush();
        const bill = spawnBill(28, 28);
        faceToward(near, MIDDLE_X, MIDDLE_Z);
        faceToward(far, MIDDLE_X, MIDDLE_Z);
        Object.assign(bill.transform.pos, {x: MIDDLE_X, z: MIDDLE_Z});
        flush();
        expect(near.socketUserContext.inventory[DOLLAR]).toBe(1);
        expect(far.socketUserContext.inventory[DOLLAR]).toBeUndefined();
    });

    it("goes to one looking at it, not to one nearer with their back to it", async () => {
        const nearer = await join("nearer", {x: MIDDLE_X - 1, y: STANDING_Y, z: MIDDLE_Z});
        const looking = await join("looking", {x: MIDDLE_X + WITHIN_REACH, y: STANDING_Y, z: MIDDLE_Z});
        holdGusts();
        flush();
        const bill = spawnBill(28, 28);
        faceToward(nearer, 4, MIDDLE_Z);
        faceToward(looking, MIDDLE_X, MIDDLE_Z);
        Object.assign(bill.transform.pos, {x: MIDDLE_X, z: MIDDLE_Z});
        flush();
        expect(looking.socketUserContext.inventory[DOLLAR]).toBe(1);
        expect(nearer.socketUserContext.inventory[DOLLAR]).toBeUndefined();
    });

    it("is done by a ghost as by anyone, told to the ghost alone: everyone else sees the bill only go", async () => {
        const ghost = await joinAsGhost("ghost", {x: MIDDLE_X, y: STANDING_Y, z: MIDDLE_Z});
        const other = await join("other", {x: 4, y: STANDING_Y, z: 4});
        holdGusts();
        const bill = spawnBill(28, 28);
        faceToward(ghost, MIDDLE_X + 1, MIDDLE_Z);
        Object.assign(bill.transform.pos, {x: MIDDLE_X + 1, z: MIDDLE_Z});
        flush();
        expect(getBills()).toHaveLength(0);
        expect(ghost.socketUserContext.inventory[DOLLAR]).toBe(1);
        expect(inventoriesSentTo(ghost)).toEqual([{[DOLLAR]: 1}]);
        expect(collectionsSentTo(ghost)).toEqual([{objectId: bill.objectId, collectorUserID: ghost.user.id}]);
        const sent = signalTypesSentTo(ghost);
        expect(sent.indexOf("objectCollectedSignal")).toBeLessThan(sent.indexOf("removeObjectSignal"));

        expect(collectionsSentTo(other)).toEqual([]);
        expect(removalsSentTo(other)).toContain(bill.objectId);
        expect(other.socketUserContext.inventory[DOLLAR]).toBeUndefined();
    });

    it("shows the whole room it gone, and tells only whoever collected it what they hold", async () => {
        const {user, bill} = await withBillBeforeUser(0.5);
        const other = await join("other", {x: 4, y: STANDING_Y, z: 4});
        flush();
        expect(removalsSentTo(user)).toContain(bill.objectId);
        expect(removalsSentTo(other)).toContain(bill.objectId);
        expect(inventoriesSentTo(user)).toEqual([{[DOLLAR]: 1}]);
        expect(inventoriesSentTo(other)).toEqual([]);
    });

    it("tells everyone who collected it, just before it goes, and only then what its collector holds", async () => {
        const {user, bill} = await withBillBeforeUser(0.5);
        const other = await join("other", {x: 4, y: STANDING_Y, z: 4});
        flush();
        const collected = [{objectId: bill.objectId, collectorUserID: user.user.id}];
        expect(collectionsSentTo(other)).toEqual(collected);
        expect(collectionsSentTo(user)).toEqual(collected);
        for (const told of [other, user])
        {
            const sent = signalTypesSentTo(told);
            expect(sent.indexOf("objectCollectedSignal")).toBeLessThan(sent.indexOf("removeObjectSignal"));
        }
        const sentToCollector = signalTypesSentTo(user);
        expect(sentToCollector.indexOf("removeObjectSignal")).toBeLessThan(sentToCollector.lastIndexOf("inventorySignal"));
    });

    it("counts up, once each, and keeps count in the row at once", async () => {
        const {user} = await withBillBeforeUser(0.5);
        flush();
        for (let i = 0; i < 2; ++i)
        {
            const bill = spawnBill(4, 4);
            Object.assign(bill.transform.pos, {x: MIDDLE_X + 0.5, z: MIDDLE_Z});
            flush();
        }
        expect(user.socketUserContext.inventory[DOLLAR]).toBe(3);
        expect(vi.mocked(DBInventoryUtil.addItem).mock.calls).toEqual([[user.user.id, DOLLAR, 1], [user.user.id, DOLLAR, 1],
            [user.user.id, DOLLAR, 1]]);
    });
});

describe("believing how someone got near a bill", () => {
    const WALK_SPEED = PLAYER_WALK_SPEED_PER_INPUT * PLAYER_MAX_WALK_INPUT;
    // How often a browser reports its player's move (see PeriodicTransformEmitter).
    const REPORT_MS = SIGNAL_BATCH_SEND_INTERVAL;
    const SUB_STEP = 1 / 60;

    // A move as their browser reports it, through the server's own handling of it.
    async function report(user: ConnectedUser, pos: Vec3): Promise<void>
    {
        const player = harness.getPlayerObject(user.user.id)!;
        const bufferState = EncodingUtil.startEncoding();
        new SetObjectTransformSignal(HUB_ID, player.objectId, new ObjectTransform({...pos}, {...player.transform.dir},
            {...player.transform.scale}), false).encode(bufferState);
        await UserSignalDispatchUtil.dispatch(user.socketUserContext, "setObjectTransformSignal",
            EncodingUtil.endEncoding(bufferState));
    }

    // Walks their body as the room's physics walks any, a browser's or an agent's, at a walk along a heading (standing
    // still where there is none), the server noting where it got to five times a second, as a browser reports it, or
    // all at once after a stall. Says whether it believed every move, and how many a stream had a part in.
    function walkByPhysics(user: ConnectedUser, heading: (seconds: number) => number | undefined, seconds: number,
        stall?: {from: number, to: number}): {believed: boolean, forced: number}
    {
        const player = harness.getPlayerObject(user.user.id)!;
        const ctx = user.socketUserContext;
        let pos = {...player.transform.pos};
        let reported = {...pos};
        const held: Vec3[] = [];
        const result = {believed: true, forced: 0};
        let forced = false;
        for (let step = 1; step <= Math.round(seconds / SUB_STEP); ++step)
        {
            const angle = heading(step * SUB_STEP);
            const steering = (angle == undefined) ? {x: 0, y: 0, z: 0}
                : {x: Math.cos(angle) * WALK_SPEED, y: 0, z: Math.sin(angle) * WALK_SPEED};
            const move = PhysicsManager.getStepVelocity(HUB_ID, player.objectId, steering, SUB_STEP);
            forced ||= move.underForce;
            pos = {...PhysicsManager.setObjectTransform(HUB_ID, player.objectId, new ObjectTransform(
                Vector3DUtil.add(pos, Vector3DUtil.scale(move.velocity, SUB_STEP)), player.transform.dir,
                player.transform.scale), false).transform.pos};
            if (step % Math.round(REPORT_MS / 1000 / SUB_STEP) != 0)
                continue;
            vi.setSystemTime(Date.now() + REPORT_MS);
            result.forced += forced ? 1 : 0;
            forced = false;
            held.push({...pos});
            if (stall != undefined && step * SUB_STEP >= stall.from && step * SUB_STEP < stall.to)
                continue;
            for (const at of held.splice(0))
            {
                PlayerMotionCheckUtil.noteMove(ctx, getRoom(), reported, at);
                reported = at;
                result.believed &&= PlayerMotionCheckUtil.isTrusted(ctx);
            }
        }
        Object.assign(player.transform.pos, pos);
        return result;
    }

    // Somewhere on the floor inside the room's walls, by hundredths, and somewhere along them, by half blocks.
    const FLOOR_SPOT = fc.record({x: fc.integer({min: 200, max: 3000}), z: fc.integer({min: 200, max: 3000})})
        .map(({x, z}) => ({x: x / 100, z: z / 100}));
    const HALF_SPOT = fc.integer({min: 4, max: 60}).map(halves => halves / 2);
    const HEADINGS = fc.array(fc.option(fc.integer({min: 0, max: 359}), {nil: undefined, freq: 5}),
        {minLength: 8, maxLength: 8});
    // Single blocks low in the room, and flights of steps up to a ledge as high as a person can't climb.
    const BLOCK_ANYWHERE_LOW = fc.record({row: fc.integer({min: 2, max: 61}), col: fc.integer({min: 2, max: 61}),
        layer: fc.integer({min: 0, max: 1})});
    const STAIRS = fc.record({row: fc.integer({min: 2, max: 61}), col: fc.integer({min: 2, max: 55})});
    // A fan on the floor blowing up, or on a wall of the room blowing across it, at any strength.
    const FAN = fc.record({onWall: fc.integer({min: 0, max: 4}), along: HALF_SPOT, across: HALF_SPOT,
        setting: fc.integer({min: 0, max: 2})});
    const WALL_FACE = GENERATED_WALL_THICKNESS * VOXEL_CELL_SIZE;
    const WALLS = [{pos: (at: number) => ({x: WALL_FACE, y: 0.5, z: at}), dir: {x: 1, y: 0, z: 0}},
        {pos: (at: number) => ({x: 32 - WALL_FACE, y: 0.5, z: at}), dir: {x: -1, y: 0, z: 0}},
        {pos: (at: number) => ({x: at, y: 0.5, z: WALL_FACE}), dir: {x: 0, y: 0, z: 1}},
        {pos: (at: number) => ({x: at, y: 0.5, z: 32 - WALL_FACE}), dir: {x: 0, y: 0, z: -1}}];

    it("believes any walk the room's physics makes: up steps, off ledges and thrown about by fans", async () => {
        let forced = 0;
        await fc.assert(fc.asyncProperty(FLOOR_SPOT, fc.array(BLOCK_ANYWHERE_LOW, {maxLength: 120}),
            fc.array(STAIRS, {maxLength: 6}), fc.array(FAN, {maxLength: 4}), HEADINGS,
            async (start, blocks, stairs, fans, headings) => {
                harness.reset();
                harness.seedHub(HUB_ID);
                const user = await join("walker", {x: start.x, y: STANDING_Y, z: start.z});
                const voxels = getRoom().voxelGrid.voxels;
                const steps = stairs.flatMap(({row, col}) => Array.from({length: 6}, (_, i) =>
                    Array.from({length: 1 + (i >> 1)}, (_, layer) => ({row, col: col + i, layer}))).flat());
                for (const {row, col, layer} of [...blocks, ...steps])
                {
                    if (Math.abs(row - rowOf(start.z)) > 1 || Math.abs(col - colOf(start.x)) > 1)
                        VoxelQueryUtil.getVoxel(voxels, row, col)!.blockLayerMask |= 1 << layer;
                }
                for (const [i, {onWall, along, across, setting}] of fans.entries())
                {
                    const wall = WALLS[onWall];
                    const fan = new AddObjectSignal(HUB_ID, ADMIN.id, ADMIN.userName, FAN_TYPE_INDEX, `fan${i}`,
                        new ObjectTransform(wall?.pos(along) ?? {x: along, y: 0, z: across},
                            wall?.dir ?? {x: 0, y: 1, z: 0}, {...UNIT_VEC3}),
                        {[ObjectMetadataKeyEnumMap.ForceProperties]: new EncodableByteString(
                            FanObjectTypeConfig.util.encodeForceProperties(FAN_SETTINGS[setting]))});
                    ServerObjectManager.addObjectAsServer(getRoom(), ADMIN, fan);
                }
                const walk = walkByPhysics(user, seconds => {
                    const degrees = headings[Math.floor(seconds) % headings.length];
                    return (degrees == undefined) ? undefined : degrees * Math.PI / 180;
                }, 8);
                forced += walk.forced;
                expect(walk.believed).toBe(true);
            }), {numRuns: 60});
        // Not believed for want of a fan to doubt (falls come too rarely here to count on; the walks off a ledge below
        // are sure of them).
        expect(forced).toBeGreaterThan(20);
    });

    it("believes a body its physics holds up against a wall, off a step, for as long as it walks into the wall", async () => {
        // Up a step in a corner of the room and on along its wall, pressing into it, which keeps it up at the step's height.
        const user = await join("hugger", {x: 2, y: STANDING_Y, z: 2});
        VoxelQueryUtil.getVoxel(getRoom().voxelGrid.voxels, 2, 3)!.blockLayerMask |= 1;
        const intoTheWall = 282 * Math.PI / 180;
        const walk = walkByPhysics(user, seconds => (seconds < 1) ? undefined : intoTheWall, 6);
        expect(harness.getPlayerObject(user.user.id)!.transform.pos.x).toBeGreaterThan(6);
        expect(walk.believed).toBe(true);
    });

    it("believes a body left standing on a mere corner of a block, as its physics holds it there", async () => {
        const user = await join("perched", {x: 2, y: STANDING_Y, z: 2});
        VoxelQueryUtil.getVoxel(getRoom().voxelGrid.voxels, 2, 4)!.blockLayerMask |= 1;
        const headings = [0, 134, undefined, 188, 5, 224, undefined, undefined];
        const walk = walkByPhysics(user, seconds => {
            const degrees = headings[Math.floor(seconds) % headings.length];
            return (degrees == undefined) ? undefined : degrees * Math.PI / 180;
        }, 7.5);
        const {pos} = harness.getPlayerObject(user.user.id)!.transform;
        // Up on it by a sliver of its corner.
        expect(pos.y - STANDING_Y).toBeCloseTo(COLLISION_LAYER_HEIGHT);
        const overlap = 5 * VOXEL_CELL_SIZE - (pos.x - PLAYER_RADIUS_XZ);
        expect(overlap).toBeGreaterThan(0);
        expect(overlap).toBeLessThan(0.05);
        expect(walk.believed).toBe(true);
    });

    it("believes a body tossed up by a fan on the floor, or thrown across the room by one on a wall", async () => {
        for (const [i, fan] of [{pos: {x: 12.5, y: 0, z: 12.5}, dir: {x: 0, y: 1, z: 0}, start: {x: 10, z: 12.5},
            heading: 0}, {pos: {x: 12.5, y: 0.5, z: 32 - WALL_FACE}, dir: {x: 0, y: 0, z: -1}, start: {x: 12.5, z: 28},
            heading: 90}].entries())
        {
            harness.reset();
            harness.seedHub(HUB_ID);
            const user = await join("tossed", {x: fan.start.x, y: STANDING_Y, z: fan.start.z});
            expect(ServerObjectManager.addObjectAsServer(getRoom(), ADMIN, new AddObjectSignal(HUB_ID, ADMIN.id,
                ADMIN.userName, FAN_TYPE_INDEX, "fan", new ObjectTransform(fan.pos, fan.dir, {...UNIT_VEC3}),
                {[ObjectMetadataKeyEnumMap.ForceProperties]: new EncodableByteString(
                    FanObjectTypeConfig.util.encodeForceProperties(FAN_SETTINGS[2]))}))).toBe(true);
            // Onto the floor's fan, or toward the wall's, then still while it has them.
            const walk = walkByPhysics(user, seconds => (seconds < 0.6) ? fan.heading * Math.PI / 180 : undefined, 6);
            expect(walk.forced, `fan ${i}`).toBeGreaterThan(3);
            expect(walk.believed, `fan ${i}`).toBe(true);
        }
    });

    it("believes a walk whose moves arrive together after a stall the allowance can take at once", async () => {
        // In tenths of a second, as long a walk as the allowance holds, with some to spare.
        const longestStall = Math.floor(0.8 * 10 * ALLOWANCE.capacity / WALK_SPEED);
        await fc.assert(fc.asyncProperty(fc.integer({min: 0, max: 359}), fc.integer({min: 0, max: 30}),
            fc.integer({min: 1, max: longestStall}), async (degrees, tenthsBefore, tenthsLong) => {
                harness.reset();
                harness.seedHub(HUB_ID);
                const user = await join("walker", {x: MIDDLE_X, y: STANDING_Y, z: MIDDLE_Z});
                const from = tenthsBefore / 10;
                const walk = walkByPhysics(user, () => degrees * Math.PI / 180, 5, {from, to: from + tenthsLong / 10});
                expect(walk.believed).toBe(true);
            }), {numRuns: 40});
    });

    it("doesn't believe a leap, for as long as walking there would have taken and a while after", async () => {
        const user = await join("leaper", {x: 4, y: STANDING_Y, z: MIDDLE_Z});
        const ctx = user.socketUserContext;
        const start = Date.now();
        const leap = 2 * ALLOWANCE.capacity;
        PlayerMotionCheckUtil.noteMove(ctx, getRoom(), {x: 4, y: STANDING_Y, z: MIDDLE_Z},
            {x: 4 + leap, y: STANDING_Y, z: MIDDLE_Z});
        // How long the allowance takes to make up what the leap went past it.
        const walkMs = 1000 * (leap - ALLOWANCE.capacity) / ALLOWANCE.refillPerSecond;
        expect(PlayerMotionCheckUtil.isTrusted(ctx, start + DISTRUST_MS + walkMs - 10)).toBe(false);
        expect(PlayerMotionCheckUtil.isTrusted(ctx, start + DISTRUST_MS + walkMs + 10)).toBe(true);
    });

    it("keeps doubting someone through a change of room", async () => {
        const OTHER_HUB_ID = "hubBBBBBBBBBBBBBBBBB";
        harness.seedHub(OTHER_HUB_ID);
        const user = await join("leaper", {x: 4, y: STANDING_Y, z: MIDDLE_Z});
        const ctx = user.socketUserContext;
        const leap = 2 * ALLOWANCE.capacity;
        PlayerMotionCheckUtil.noteMove(ctx, getRoom(), {x: 4, y: STANDING_Y, z: MIDDLE_Z}, {x: 4 + leap, y: STANDING_Y, z: MIDDLE_Z});
        await harness.joinRoom(user, OTHER_HUB_ID);
        const otherRoom = ServerRoomManager.roomRuntimeMemories[OTHER_HUB_ID].room;
        const {pos} = harness.getPlayerObject(user.user.id)!.transform;
        const step = 0.5;
        PlayerMotionCheckUtil.noteMove(ctx, otherRoom, {...pos}, {...pos, x: pos.x + step});
        expect(PlayerMotionCheckUtil.isTrusted(ctx)).toBe(false);
        // Once the allowance has made up the leap and the step after it.
        const madeUpMs = 1000 * (leap + step - ALLOWANCE.capacity) / ALLOWANCE.refillPerSecond;
        expect(PlayerMotionCheckUtil.isTrusted(ctx, Date.now() + DISTRUST_MS + madeUpMs + 100)).toBe(true);
    });

    it("doesn't believe running at twice the speed a walk is allowed, however smooth", async () => {
        const user = await join("runner", {x: 4, y: STANDING_Y, z: MIDDLE_Z});
        const ctx = user.socketUserContext;
        let at = {x: 4, y: STANDING_Y, z: MIDDLE_Z};
        let believed = true;
        // Twice as fast as the allowance lets through, for as long as it takes to go past all it holds at once.
        const speed = 2 * ALLOWANCE.refillPerSecond;
        const numReports = Math.ceil(ALLOWANCE.capacity / ((speed - ALLOWANCE.refillPerSecond) * REPORT_MS / 1000)) + 1;
        for (let i = 0; i < numReports; ++i)
        {
            vi.setSystemTime(Date.now() + REPORT_MS);
            const next = {...at, x: at.x + speed * REPORT_MS / 1000};
            PlayerMotionCheckUtil.noteMove(ctx, getRoom(), at, next);
            at = next;
            believed &&= PlayerMotionCheckUtil.isTrusted(ctx);
        }
        expect(believed).toBe(false);
    });

    // Steps up to a ledge a block and a half high, east of the middle of the room: x from 15 to 17 along it.
    function buildStepsToLedge(): void
    {
        for (const [col, height] of [[30, 1], [31, 2], [32, 3], [33, 3]])
        {
            for (let layer = 0; layer < height; ++layer)
                placeBlock(rowOf(MIDDLE_Z), col, layer);
        }
    }

    // Has the server note moves through places, each a report's while after the last, given by x and feet's height. Says
    // whether it believed each.
    function noteMoves(user: ConnectedUser, path: {x: number, feet: number}[]): boolean[]
    {
        const toPos = ({x, feet}: {x: number, feet: number}) => ({x, y: feet + STANDING_Y, z: MIDDLE_Z + 0.1});
        return path.slice(1).map((place, i) => {
            vi.setSystemTime(Date.now() + REPORT_MS);
            PlayerMotionCheckUtil.noteMove(user.socketUserContext, getRoom(), toPos(path[i]), toPos(place));
            return PlayerMotionCheckUtil.isTrusted(user.socketUserContext);
        });
    }

    it("believes climbing steps a block at a time and falling off the ledge they lead up to", async () => {
        const user = await join("climber");
        buildStepsToLedge();
        moveTo(user, {x: 14.4, y: STANDING_Y, z: MIDDLE_Z + 0.1});
        expect(noteMoves(user, [{x: 14.4, feet: 0}, {x: 15.2, feet: 0.5}, {x: 15.7, feet: 1}, {x: 16.4, feet: 1.5},
            {x: 17.2, feet: 1.5}, {x: 17.6, feet: 0.3}, {x: 18.2, feet: 0}, {x: 19, feet: 0}]))
            .toEqual([true, true, true, true, true, true, true]);
    });

    it("doesn't believe rising with nothing underfoot", async () => {
        const user = await join("riser", {x: MIDDLE_X, y: STANDING_Y, z: MIDDLE_Z + 0.1});
        expect(noteMoves(user, [{x: MIDDLE_X, feet: 0}, {x: MIDDLE_X, feet: 0.4}, {x: MIDDLE_X, feet: 0.8},
            {x: MIDDLE_X, feet: 1.2}])).toEqual([true, false, false]);
    });

    it("doesn't believe hanging in the air over a drop, past a moment", async () => {
        const user = await join("hanger");
        buildStepsToLedge();
        moveTo(user, {x: 16.4, y: STANDING_Y + 1.5, z: MIDDLE_Z + 0.1});
        const believed = noteMoves(user, Array.from({length: 9}, (_, i) => ({x: 16.4 + 0.4 * i, feet: 1.5})));
        // Off the ledge from the third on, which a moment's grace and a slow fall's allowance cover for a little.
        expect(believed.slice(0, 3)).toEqual([true, true, true]);
        expect(believed[believed.length - 1]).toBe(false);
    });

    it("keeps a bill from someone who leapt to it, until a while after, through the moves the server is sent", async () => {
        const user = await join("leaper", {x: 4, y: STANDING_Y, z: MIDDLE_Z});
        holdGusts();
        faceToward(user, 28, MIDDLE_Z);
        const bill = spawnBill(28, 4);
        Object.assign(bill.transform.pos, {x: MIDDLE_X + WITHIN_REACH, y: LYING_Y, z: MIDDLE_Z});
        await report(user, {x: MIDDLE_X, y: STANDING_Y, z: MIDDLE_Z});
        flushFor(DISTRUST_MS);
        expect(getBills()).toHaveLength(1);
        expect(user.socketUserContext.inventory[DOLLAR]).toBeUndefined();
        flushFor(2_000);
        expect(user.socketUserContext.inventory[DOLLAR]).toBe(1);
    });

    it("lets someone who walked up to a bill collect it as they come within reach", async () => {
        const user = await join("walker", {x: 4, y: STANDING_Y, z: MIDDLE_Z});
        holdGusts();
        faceToward(user, 28, MIDDLE_Z);
        const bill = spawnBill(28, 4);
        Object.assign(bill.transform.pos, {x: MIDDLE_X + 3, y: LYING_Y, z: MIDDLE_Z});
        let x = 4;
        while (user.socketUserContext.inventory[DOLLAR] == undefined && x < MIDDLE_X + 3)
        {
            x += WALK_SPEED * REPORT_MS / 1000;
            await report(user, {x, y: STANDING_Y, z: MIDDLE_Z});
            flush();
        }
        expect(user.socketUserContext.inventory[DOLLAR]).toBe(1);
        expect(MIDDLE_X + 3 - x).toBeGreaterThan(DOLLAR_BILL_REACH - WALK_SPEED * REPORT_MS / 1000);
    });
});

describe("what a browser makes of what it is told", () => {
    const gains: string[] = [];

    beforeEach(() => {
        gains.length = 0;
        inventoryGainObservable.addListener("inventoryTest", itemType => { gains.push(itemType); });
        dollarsInFlightObservable.set(0);
        ClientInventoryManager.onInventorySignalReceived(new InventorySignal({[DOLLAR]: 7}));
    });

    afterEach(() => {
        inventoryGainObservable.removeListener("inventoryTest");
    });

    it("shows what it is told, with no fuss over what the user held already", () => {
        expect(inventoryObservable.peek()).toEqual({[DOLLAR]: 7});
        expect(ClientInventoryManager.getDollarsShown()).toBe(7);
        expect(gains).toEqual([]);

        // A reconnection, or a gain elsewhere, with no bill to fly.
        ClientInventoryManager.onInventorySignalReceived(new InventorySignal({[DOLLAR]: 8}));
        expect(ClientInventoryManager.getDollarsShown()).toBe(8);
        expect(gains).toEqual([]);
    });

    it("holds a dollar back until its bill reaches the count, then says it has come", () => {
        ClientInventoryManager.onDollarTakingOff();
        ClientInventoryManager.onInventorySignalReceived(new InventorySignal({[DOLLAR]: 8}));
        expect(ClientInventoryManager.getDollarsShown()).toBe(7);
        expect(gains).toEqual([]);

        ClientInventoryManager.onDollarArrived();
        expect(ClientInventoryManager.getDollarsShown()).toBe(8);
        expect(gains).toEqual([DOLLAR]);
    });

    it("shows two bills in flight arriving one by one, whichever the server tells of first", () => {
        ClientInventoryManager.onInventorySignalReceived(new InventorySignal({[DOLLAR]: 8}));
        ClientInventoryManager.onDollarTakingOff();
        ClientInventoryManager.onDollarTakingOff();
        ClientInventoryManager.onInventorySignalReceived(new InventorySignal({[DOLLAR]: 9}));
        expect(ClientInventoryManager.getDollarsShown()).toBe(7);

        ClientInventoryManager.onDollarArrived();
        expect(ClientInventoryManager.getDollarsShown()).toBe(8);
        ClientInventoryManager.onDollarArrived();
        expect(ClientInventoryManager.getDollarsShown()).toBe(9);
        expect(gains).toEqual([DOLLAR, DOLLAR]);
    });

    it("never shows less than nothing", () => {
        ClientInventoryManager.onInventorySignalReceived(new InventorySignal({}));
        ClientInventoryManager.onDollarTakingOff();
        expect(ClientInventoryManager.getDollarsShown()).toBe(0);
    });
});

describe("a bill being drawn in", () => {
    it("starts where it lies at its full size and ends at its collector at none at all", () => {
        expect(DollarBillPoseUtil.getAbsorptionStep(0)).toEqual({across: 0, up: 0, size: 1});
        expect(DollarBillPoseUtil.getAbsorptionStep(1)).toEqual({across: 1, up: 1, size: 0});
    });

    it("leaps up well ahead of coming across, to clear a low step on its way", () => {
        const {across, up} = DollarBillPoseUtil.getAbsorptionStep(0.4);
        expect(up).toBeGreaterThan(0.6);
        expect(across).toBeLessThan(0.2);
    });

    it("shrinks only at the end", () => {
        expect(DollarBillPoseUtil.getAbsorptionStep(ABSORB_VANISHING_SHARE - 0.05).size).toBe(1);
        expect(DollarBillPoseUtil.getAbsorptionStep(ABSORB_VANISHING_SHARE + 0.6 * (1 - ABSORB_VANISHING_SHARE)).size)
            .toBeLessThan(0.5);
    });
});

describe("a bill flying to the count on the screen", () => {
    const COUNT = {x: -0.94, y: 0.92};
    const SCREEN_POINT = fc.record({x: fc.integer({min: -119, max: 119}), y: fc.integer({min: -119, max: 119})})
        .map(({x, y}) => ({x: x / 100, y: y / 100}));

    it("starts where the bill is, if it can be seen", () => {
        expect(DollarBillPoseUtil.getFlightStart(1, -0.5, 2)).toEqual({x: 0.5, y: -0.25});
    });

    it("comes in over the nearest edge from under the view, as one at the user's feet does", () => {
        // Straight below the view, as a bill just walked up to is.
        const start = DollarBillPoseUtil.getFlightStart(0, -3, 1);
        expect(start.x).toBeCloseTo(0, 9);
        expect(start.y).toBeCloseTo(-MAX_FLIGHT_START, 9);
    });

    it("comes in from just past the edge even from behind the camera, or from right where the camera is", () => {
        for (const [x, y, depth] of [[0.5, -1, -2], [2, 0.5, -0.1], [0, -1, 0], [0, 0, 0], [0, 0, -3]])
        {
            const start = DollarBillPoseUtil.getFlightStart(x, y, depth);
            expect(Math.max(Math.abs(start.x), Math.abs(start.y))).toBeCloseTo(MAX_FLIGHT_START);
        }
    });

    it("sets off at the size it is given, there being no gap between the bill lying and the bill flying, and ends at the count at no size at all", () => {
        fc.assert(fc.property(SCREEN_POINT, fc.integer({min: 20, max: 100}), (from, percent) => {
            const start = DollarBillPoseUtil.getFlightStep(0, from, COUNT, percent / 100);
            expect(start.x).toBeCloseTo(from.x);
            expect(start.y).toBeCloseTo(from.y);
            expect(start.size).toBeCloseTo(percent / 100);
            const end = DollarBillPoseUtil.getFlightStep(1, from, COUNT, percent / 100);
            expect(end.x).toBeCloseTo(COUNT.x);
            expect(end.y).toBeCloseTo(COUNT.y);
            expect(end.size).toBeCloseTo(0);
        }));
    });

    it("comes up to size, shrinks from then on, and most of all as it is sucked up at the end", () => {
        const sizes = Array.from({length: 21}, (_, i) => DollarBillPoseUtil.getFlightStep(i / 20, {x: 0, y: -1.2}, COUNT, 0.5).size);
        const grownAt = Math.ceil(GROWING_SHARE * 20), vanishingAt = Math.round(VANISHING_SHARE * 20);
        for (let i = 1; i <= grownAt; ++i)
            expect(sizes[i]).toBeGreaterThan(sizes[i - 1]);
        for (let i = grownAt + 1; i < sizes.length; ++i)
            expect(sizes[i]).toBeLessThan(sizes[i - 1]);
        // Nearly all of what it has left goes in the last fifth of the flight.
        expect(sizes[vanishingAt]).toBeGreaterThan(1 - FLIGHT_SHRINK * VANISHING_SHARE - 0.02);
        expect(sizes[19]).toBeLessThan(0.15);
    });

    it("picks up speed the whole way", () => {
        const speeds: number[] = [];
        let last = DollarBillPoseUtil.getFlightStep(0, {x: 0, y: -1.2}, COUNT, 1);
        for (let i = 1; i <= 20; ++i)
        {
            const step = DollarBillPoseUtil.getFlightStep(i / 20, {x: 0, y: -1.2}, COUNT, 1);
            speeds.push(Math.hypot(step.x - last.x, step.y - last.y));
            last = step;
        }
        expect(speeds[19]).toBeGreaterThan(4 * speeds[1]);
    });

    it("bows out toward the middle of the screen, whichever way it comes from", () => {
        fc.assert(fc.property(SCREEN_POINT, (from) => {
            fc.pre(Math.hypot(from.x - COUNT.x, from.y - COUNT.y) > 0.5);
            const halfway = DollarBillPoseUtil.getFlightStep(Math.SQRT1_2, from, COUNT, 1);
            const straightX = 0.5 * (from.x + COUNT.x), straightY = 0.5 * (from.y + COUNT.y);
            expect(Math.hypot(halfway.x - straightX, halfway.y - straightY)).toBeGreaterThan(0.1);
            expect((halfway.x - straightX) * straightX + (halfway.y - straightY) * straightY).toBeLessThanOrEqual(1e-9);
        }));
    });
});

describe("what coming back earns", () => {
    function rewardsSentTo(user: ConnectedUser): number[]
    {
        return getPendingSignals(user, "loginRewardSignal").map((signal: LoginRewardSignal) => signal.dollars);
    }

    // Someone joining this long after their last reward, or after they first came, holding this much.
    async function arrive(sinceLastReward: number, dollars: number = 3): Promise<ConnectedUser>
    {
        const user = harness.connectUser({id: "someone", userName: "someone"});
        (await DBUserUtil.findUserById("someone"))!.lastLoginRewardAt = Date.now() - sinceLastReward;
        user.socketUserContext.inventory[DOLLAR] = dollars;
        await UserSessionUtil.joinFirstRoom(user.socketUserContext);
        return user;
    }

    it("comes once its time is up, as they arrive, in what they are told they hold and then told of", async () => {
        const user = await arrive(LOGIN_REWARD_INTERVAL_MS);
        expect(inventoriesSentTo(user)).toEqual([{[DOLLAR]: 3 + LOGIN_REWARD_DOLLARS}]);
        expect(rewardsSentTo(user)).toEqual([LOGIN_REWARD_DOLLARS]);
        const sent = signalTypesSentTo(user);
        expect(sent.indexOf("inventorySignal")).toBeLessThan(sent.indexOf("loginRewardSignal"));
    });

    it("isn't there on someone's first login, nor on any visit before its time is up", async () => {
        const firstVisit = harness.connectUser({id: "new", userName: "new"});
        await UserSessionUtil.joinFirstRoom(firstVisit.socketUserContext);
        expect(rewardsSentTo(firstVisit)).toEqual([]);
        expect(inventoriesSentTo(firstVisit)).toEqual([{}]);

        const user = await arrive(LOGIN_REWARD_INTERVAL_MS - 1);
        expect(inventoriesSentTo(user)).toEqual([{[DOLLAR]: 3}]);
        expect(rewardsSentTo(user)).toEqual([]);
    });

    it("comes once however often they connect, and again the next time it is up", async () => {
        const user = await arrive(LOGIN_REWARD_INTERVAL_MS);

        const reconnected = await harness.reconnectCaseB(user);
        await UserSessionUtil.joinFirstRoom(reconnected.socketUserContext);
        expect(rewardsSentTo(reconnected)).toEqual([]);

        vi.setSystemTime(Date.now() + LOGIN_REWARD_INTERVAL_MS);
        const nextDay = await harness.reconnectCaseB(reconnected);
        await UserSessionUtil.joinFirstRoom(nextDay.socketUserContext);
        expect(rewardsSentTo(nextDay)).toEqual([LOGIN_REWARD_DOLLARS]);
    });

    it("still tells them what they hold if the row can't give it, and comes the next time they connect", async () => {
        vi.mocked(DBInventoryUtil.claimLoginReward).mockResolvedValueOnce(false);
        const user = await arrive(LOGIN_REWARD_INTERVAL_MS);
        expect(inventoriesSentTo(user)).toEqual([{[DOLLAR]: 3}]);
        expect(rewardsSentTo(user)).toEqual([]);

        const reconnected = await harness.reconnectCaseB(user);
        await UserSessionUtil.joinFirstRoom(reconnected.socketUserContext);
        expect(rewardsSentTo(reconnected)).toEqual([LOGIN_REWARD_DOLLARS]);
    });

    it("adds to what they go on to collect", async () => {
        const user = await arrive(LOGIN_REWARD_INTERVAL_MS);
        ServerInventoryManager.addItem(user.socketUserContext, DOLLAR, 1);
        expect(inventoriesSentTo(user).pop()).toEqual({[DOLLAR]: 3 + LOGIN_REWARD_DOLLARS + 1});
    });
});

describe("what a user holds", () => {
    it("is told to them as they join their first room", async () => {
        const user = harness.connectUser({id: "someone", userName: "someone"});
        user.socketUserContext.inventory[DOLLAR] = 12;
        await UserSessionUtil.joinFirstRoom(user.socketUserContext);
        expect(inventoriesSentTo(user)).toEqual([{[DOLLAR]: 12}]);
    });

    it("comes back after a reconnection, from the row", async () => {
        const user = await join("someone");
        ServerInventoryManager.addItem(user.socketUserContext, DOLLAR, 5);
        const again = await harness.reconnectCaseB(user);
        expect(again.socketUserContext.inventory).toEqual({[DOLLAR]: 5});
    });

    it("is a copy in what goes out, so that a change after a signal is queued doesn't rewrite it", async () => {
        const user = await join("someone");
        ServerInventoryManager.addItem(user.socketUserContext, DOLLAR, 1);
        ServerInventoryManager.addItem(user.socketUserContext, DOLLAR, 1);
        expect(inventoriesSentTo(user)).toEqual([{[DOLLAR]: 1}, {[DOLLAR]: 2}]);
    });
});
