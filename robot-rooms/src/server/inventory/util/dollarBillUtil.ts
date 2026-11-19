import Vec3 from "../../../shared/math/types/vec3";
import Vector3DUtil from "../../../shared/math/util/vector3DUtil";
import { InventoryItemTypeEnumMap } from "../../../shared/inventory/types/inventoryItemType";
import EncodableData from "../../../shared/networking/types/encodableData";
import ObjectCategoryConfigMap from "../../../shared/object/maps/objectCategoryConfigMap";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import ObjectTransform from "../../../shared/object/types/objectTransform";
import DollarBillObjectTypeConfig, { DOLLAR_BILL_LENGTH, DOLLAR_BILL_REACH, DOLLAR_BILL_REST_HEIGHT,
    DOLLAR_BILL_SPAWN_CAP } from "../../../shared/object/types/objectTypeConfig/dollarBillObjectTypeConfig";
import { PLAYER_EYE_HEIGHT, PLAYER_HEIGHT } from "../../../shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import ObjectCollectedSignal from "../../../shared/object/types/objectCollectedSignal";
import ObjectWaypoint from "../../../shared/object/types/objectWaypoint";
import RemoveObjectSignal from "../../../shared/object/types/removeObjectSignal";
import SetObjectPathSignal from "../../../shared/object/types/setObjectPathSignal";
import AdminPrefsUtil from "../../../shared/object/util/adminPrefsUtil";
import ObjectIdUtil from "../../../shared/object/util/objectIdUtil";
import ObjectPathUtil from "../../../shared/object/util/objectPathUtil";
import PhysicsManager from "../../../shared/physics/physicsManager";
import Room from "../../../shared/room/types/room";
import RoomRuntimeMemory from "../../../shared/room/types/roomRuntimeMemory";
import { MAX_ROOM_X, MAX_ROOM_Z, UNIT_VEC3 } from "../../../shared/system/sharedConstants";
import ErrorUtil from "../../../shared/system/util/errorUtil";
import User from "../../../shared/user/types/user";
import { UserTypeEnumMap } from "../../../shared/user/types/userType";
import Voxel from "../../../shared/voxel/types/voxel";
import VoxelPathUtil from "../../../shared/voxel/util/voxelPathUtil";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";
import PlayerMotionCheckUtil from "../../user/util/playerMotionCheckUtil";
import ServerObjectManager from "../../object/serverObjectManager";
import ServerRoomManager from "../../room/serverRoomManager";
import UserContext from "../../sockets/types/userContext";
import ServerLifecycleUtil from "../../system/util/serverLifecycleUtil";
import ServerUserManager from "../../user/serverUserManager";
import ServerInventoryManager from "../serverInventoryManager";
import DollarBillFlight from "../types/dollarBillFlight";
import DollarBillRoomState from "../types/dollarBillRoomState";
import DollarBillFlightUtil from "./dollarBillFlightUtil";

// A new bill comes this long after the last (or after the room had room for one), somewhere at least this far from
// everyone, out of their reach as it flutters down, this high over the floor. Then gusts blow it about, each this long
// after the last.
export const SPAWN_INTERVAL_MS = [40_000, 120_000];
const SPAWN_MIN_DISTANCE = DOLLAR_BILL_REACH + 1.5;
const SPAWN_HEIGHT = 1.5;
export const GUST_INTERVAL_MS = [9_000, 26_000];
// A player draws in a bill no farther over or under their middle than this, in world units, which leaves out the storey
// below them, and no wider than this of the way they face, across the room, in radians.
export const REACH_UPWARD = 0.5 * PLAYER_HEIGHT + 0.35;
export const REACH_ANGLE = Math.PI / 4;
// Where on a bill an eye may see it, from the crease's middle, in world units: inside it however it is turned. Any of them
// in sight is the bill in sight.
const SIGHT_POINTS = [{x: 0, z: 0}, {x: 0.15, z: 0}, {x: -0.15, z: 0}, {x: 0, z: 0.15}, {x: 0, z: -0.15}];
// The most a room holds at once, whatever leaves them there (see drop).
const MAX_BILLS_PER_ROOM = ObjectCategoryConfigMap.getMaxCountPerRoom(DollarBillObjectTypeConfig.category);
// How far around a place one is dropped at room is looked for, where it has none there: in rings this far apart, in
// world units, each asked this many ways round.
const DROP_SEARCH_STEP = 0.15;
const DROP_SEARCH_RINGS = 4;
const DROP_SEARCH_DIRECTIONS = 8;

const BILL_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType(DollarBillObjectTypeConfig.objectType);
// The server adds and removes bills of its own accord, for nobody.
const NOBODY = new User("", "", UserTypeEnumMap.Guest, "", "");

// Kept with each room as long as it is loaded, whose unloading forgets it.
const roomStates = new WeakMap<RoomRuntimeMemory, DollarBillRoomState>();

// $1 bills, which the server spawns in multiplayer rooms while anyone but a ghost is there, until a room holds a few
// (see DOLLAR_BILL_SPAWN_CAP), at places someone can walk to, since each counts until it is gone; and which a cannon
// ball that threw nobody leaves where it burst (see drop), up to a room's cap. It flies them along paths (see
// DollarBillFlightUtil), which clients play out by themselves: blown about by gusts now and then, and by fans' streams
// as they meet them, dropping onto whatever is under them. Whoever comes near one, looking its way with nothing
// between them, collects it at once (see ServerInventoryManager), if all they have done is believable (see
// PlayerMotionCheckUtil): the room is told (see tellCollected), and each browser shows it go to them (see
// DollarBillGameObject.onCollected). A block laid over one destroys it, with no one the richer. A room's saves keep
// its bills (see ObjectTypeConfigMap.isStoredWithRoom), taken up again where they are when it loads (see getRoomState).
const DollarBillUtil =
{
    // Every room's bills, as time passes. From SocketsServer's flush, so what they do goes out with it. They keep still
    // once the server starts shutting down, as its last save keeps them: nobody collects one that the save brings back.
    stepAll: (seconds: number): void =>
    {
        if (ServerLifecycleUtil.isShuttingDown())
            return;
        const now = Date.now();
        for (const memory of Object.values(ServerRoomManager.roomRuntimeMemories))
        {
            try
            {
                stepRoom(memory, seconds, now);
            }
            catch (err)
            {
                console.error(`DollarBillUtil.stepAll :: (roomID = ${memory.room.id}) Error: ${ErrorUtil.getErrorMessage(err)}`);
            }
        }
    },
    // What one sent a room is to be told of its bills besides, right after it: the rest of each flight under way, since
    // the room says only where each is.
    getCatchUpSignals: (roomID: string): {signalType: string, signal: EncodableData}[] =>
    {
        const signals: {signalType: string, signal: EncodableData}[] = [];
        const memory = ServerRoomManager.roomRuntimeMemories[roomID];
        for (const [objectId, flight] of (memory && roomStates.get(memory))?.flights ?? [])
        {
            if (flight.next < flight.waypoints.length)
            {
                signals.push({signalType: "setObjectPathSignal",
                    signal: new SetObjectPathSignal(roomID, objectId, flight.waypoints.slice(flight.next))});
            }
        }
        return signals;
    },
    // A user just sent the room they come into (see ServerRoomManager.changeUserRoom), told at once.
    tellNewcomer: (roomID: string, userID: string): void =>
    {
        for (const {signalType, signal} of DollarBillUtil.getCatchUpSignals(roomID))
            ServerRoomManager.socketRoomContexts[roomID].unicastSignal(signalType, signal, userID);
    },
    // Leaves a bill in the air at a place, or as near to it as a bill has room (what leaves one may be nearer a wall
    // than a bill keeps from one), to flutter down from there, unless the room holds as many as it may: whether it
    // did.
    drop: (room: Room, pos: Vec3, now: number = Date.now()): boolean =>
    {
        const memory = ServerRoomManager.roomRuntimeMemories[room.id];
        if (memory == undefined)
            return false;
        const place = findRoomNear(room.voxelGrid.voxels, pos);
        return place != undefined && add(room, getRoomState(memory, now), place, now);
    },
    // Ahead of the shutdown's save, which takes only rooms marked as changed: each room stepped since it loaded, whose
    // bills may have changed with it.
    markRoomsToSave: (): void =>
    {
        for (const memory of Object.values(ServerRoomManager.roomRuntimeMemories))
        {
            if (roomStates.has(memory))
                memory.room.dirty = true;
        }
    },
}

// With only ghosts there, bills neither come nor move, as with nobody, but a ghost still collects one.
function stepRoom(memory: RoomRuntimeMemory, seconds: number, now: number): void
{
    const people = getPeople(memory);
    if (people.length == 0)
        return;

    const onlyGhosts = people.every(({player}) => AdminPrefsUtil.isGhost(player));
    const state = getRoomState(memory, now);
    for (const [objectId, flight] of state.flights)
    {
        const bill = memory.room.objectById[objectId];
        if (bill == undefined)
            state.flights.delete(objectId);
        else if (onlyGhosts)
            collectIfReached(memory.room, state, bill, people, now);
        else
            stepBill(memory.room, state, bill, flight, people, seconds, now);
    }
    if (!onlyGhosts)
        spawnWhenDue(memory.room, state, people, now);
}

// Made as the room is first stepped since it loaded, taking up the bills it was stored with where they are.
function getRoomState(memory: RoomRuntimeMemory, now: number): DollarBillRoomState
{
    let state = roomStates.get(memory);
    if (state == undefined)
    {
        state = {flights: new Map(), nextSpawnAt: undefined};
        for (const obj of Object.values(memory.room.objectById))
        {
            if (obj.objectTypeIndex == BILL_TYPE_INDEX)
                state.flights.set(obj.objectId, createFlight(now));
        }
        roomStates.set(memory, state);
    }
    return state;
}

// Ghosts included: bills make way for one, and go to one, as for anyone (see stepRoom).
function getPeople(memory: RoomRuntimeMemory): {ctx: UserContext, player: AddObjectSignal}[]
{
    const people: {ctx: UserContext, player: AddObjectSignal}[] = [];
    for (const userID of Object.keys(memory.participantUserNameByID))
    {
        const ctx = ServerUserManager.getSocketUserContext(userID);
        const player = ServerUserManager.getPlayerObject(userID);
        if (ctx != undefined && player != undefined)
            people.push({ctx, player});
    }
    return people;
}

function stepBill(room: Room, state: DollarBillRoomState, bill: AddObjectSignal, flight: DollarBillFlight,
    people: {ctx: UserContext, player: AddObjectSignal}[], seconds: number, now: number): void
{
    const voxels = room.voxelGrid.voxels;
    const pos = bill.transform.pos;
    if (DollarBillFlightUtil.isInBlock(voxels, pos))
    {
        destroy(room, state, bill);
        return;
    }

    advance(flight, pos, seconds);
    if (collectIfReached(room, state, bill, people, now))
        return;

    const stream = flight.blown ? undefined : PhysicsManager.getStrongestStream(room.id, getBox(pos));
    const blow = (stream == undefined) ? [] : DollarBillFlightUtil.planBlow(voxels, pos, stream);
    if (blow.length > 0)
    {
        fly(room, bill, flight, blow);
        flight.blown = true;
    }
    else if (flight.waypoints.length > 0)
        return;
    else if (!DollarBillFlightUtil.isLying(voxels, pos))
        fly(room, bill, flight, DollarBillFlightUtil.planFlutterDown(voxels, pos));
    else if (now >= flight.nextGustAt)
    {
        const gust = DollarBillFlightUtil.planGust(voxels, pos, people.map(({player}) => player.transform.pos));
        // The wait for the next starts as it lands, a long blow being no shorter than that wait can be.
        flight.nextGustAt = now + 1000 * ObjectPathUtil.getSeconds(gust, pos) + randomBetween(GUST_INTERVAL_MS);
        fly(room, bill, flight, gust);
    }
}

// Moves it on along its path, in place. A path's end is where a stream lets go of it.
function advance(flight: DollarBillFlight, pos: Vec3, seconds: number): void
{
    flight.next = ObjectPathUtil.advance(flight.waypoints, flight.next, pos, seconds);
    if (flight.next >= flight.waypoints.length)
    {
        flight.waypoints = [];
        flight.next = 0;
        flight.blown = false;
    }
}

// Whoever has it within reach, in front of them and in sight, and is trusted to have got there: the nearest, if several
// do.
function findCollector(room: Room, pos: Vec3, people: {ctx: UserContext, player: AddObjectSignal}[],
    now: number): {ctx: UserContext, player: AddObjectSignal} | undefined
{
    let collector: {ctx: UserContext, player: AddObjectSignal} | undefined = undefined;
    let nearest = DOLLAR_BILL_REACH;
    for (const person of people)
    {
        const {ctx, player} = person;
        const {pos: at, dir} = player.transform;
        const across = Math.hypot(pos.x - at.x, pos.z - at.z);
        if (across <= nearest && Math.abs(pos.y - at.y) <= REACH_UPWARD && isFaced(at, dir, pos)
            && isInSight(room, player, pos) && PlayerMotionCheckUtil.isTrusted(ctx, now))
        {
            collector = person;
            nearest = across;
        }
    }
    return collector;
}

function collectIfReached(room: Room, state: DollarBillRoomState, bill: AddObjectSignal,
    people: {ctx: UserContext, player: AddObjectSignal}[], now: number): boolean
{
    const collector = findCollector(room, bill.transform.pos, people, now);
    if (collector == undefined)
        return false;
    tellCollected(room, bill, collector);
    destroy(room, state, bill);
    ServerInventoryManager.addItem(collector.ctx, InventoryItemTypeEnumMap.Dollar, 1);
    return true;
}

// Told to the room, but a ghost's collecting to the ghost alone: everyone else sees the bill only go, as one destroyed,
// rather than drawn into somebody they can't see.
function tellCollected(room: Room, bill: AddObjectSignal, collector: {ctx: UserContext, player: AddObjectSignal}): void
{
    const signal = new ObjectCollectedSignal(room.id, bill.objectId, collector.ctx.user.id);
    const roomContext = ServerRoomManager.socketRoomContexts[room.id];
    if (AdminPrefsUtil.isGhost(collector.player))
        roomContext.unicastSignal("objectCollectedSignal", signal, collector.ctx.user.id);
    else
        roomContext.multicastSignal("objectCollectedSignal", signal);
}

// Whether any of a bill shows to a player's eyes, with no block, nobody else and nothing drawn in between: wherever it is
// on their screen, or below it.
function isInSight(room: Room, player: AddObjectSignal, pos: Vec3): boolean
{
    const {pos: at} = player.transform;
    const eye = {x: at.x, y: at.y + PLAYER_EYE_HEIGHT, z: at.z};
    return SIGHT_POINTS.some(offset => {
        const point = {x: pos.x + offset.x, y: pos.y, z: pos.z + offset.z};
        return VoxelQueryUtil.isLineClear(room.voxelGrid.voxels, eye, point)
            && PhysicsManager.isLineClearOfObjects(room.id, eye, point, player.objectId);
    });
}

// Whether someone at a place, with their transform's direction, is facing within reach of the way to another, across the
// room. That direction points behind a player (see SpawnHotspotUtil).
function isFaced(at: Vec3, dir: Vec3, pos: Vec3): boolean
{
    const toX = pos.x - at.x, toZ = pos.z - at.z;
    const lengths = Math.hypot(toX, toZ) * Math.hypot(dir.x, dir.z);
    return lengths == 0 || -(toX * dir.x + toZ * dir.z) / lengths >= Math.cos(REACH_ANGLE);
}

function destroy(room: Room, state: DollarBillRoomState, bill: AddObjectSignal): void
{
    state.flights.delete(bill.objectId);
    ServerObjectManager.removeObjectAsServer(room, NOBODY, new RemoveObjectSignal(room.id, bill.objectId));
}

// Sets it on a path, told to the room. None leaves it where it is.
function fly(room: Room, bill: AddObjectSignal, flight: DollarBillFlight, waypoints: ObjectWaypoint[]): void
{
    if (waypoints.length == 0)
        return;
    flight.waypoints = waypoints;
    flight.next = 0;
    flight.blown = false;
    ServerRoomManager.socketRoomContexts[room.id].multicastSignal("setObjectPathSignal",
        new SetObjectPathSignal(room.id, bill.objectId, waypoints));
}

// The wait for the next bill starts as soon as the room holds few enough for another of its own.
function spawnWhenDue(room: Room, state: DollarBillRoomState, people: {player: AddObjectSignal}[], now: number): void
{
    if (state.flights.size >= DOLLAR_BILL_SPAWN_CAP)
        state.nextSpawnAt = undefined;
    else if (state.nextSpawnAt == undefined)
        state.nextSpawnAt = now + randomBetween(SPAWN_INTERVAL_MS);
    else if (now >= state.nextSpawnAt)
    {
        spawn(room, state, people.map(({player}) => player.transform.pos), now);
        state.nextSpawnAt = undefined;
    }
}

function spawn(room: Room, state: DollarBillRoomState, people: Vec3[], now: number): void
{
    const place = pickSpawnPlace(room.voxelGrid.voxels, people);
    if (place != undefined)
        add(room, state, place, now);
}

// Whether a bill was added at a place: none past the room's cap.
function add(room: Room, state: DollarBillRoomState, place: Vec3, now: number): boolean
{
    if (state.flights.size >= MAX_BILLS_PER_ROOM)
        return false;
    // Not one of the server's own ids (see ServerObjectManager.generateNonPersistentObjectId), which start over with each
    // restart that the room's saves keep it through.
    const objectId = ObjectIdUtil.generateUniqueObjectId(room.objectById);
    const bill = new AddObjectSignal(room.id, "", "", BILL_TYPE_INDEX, objectId,
        new ObjectTransform({...place}, {x: 0, y: 0, z: 1}, {...UNIT_VEC3}));
    if (!ServerObjectManager.addObjectAsServer(room, NOBODY, bill))
        return false;
    state.flights.set(bill.objectId, createFlight(now));
    return true;
}

// A place a bill has room at: the one given, or the nearest of those around it at its own height, in rings a step
// apart. None within the last ring.
function findRoomNear(voxels: Voxel[], pos: Vec3): Vec3 | undefined
{
    if (!DollarBillFlightUtil.isInBlock(voxels, pos))
        return pos;
    for (let ring = 1; ring <= DROP_SEARCH_RINGS; ++ring)
    {
        for (let i = 0; i < DROP_SEARCH_DIRECTIONS; ++i)
        {
            const angle = 2 * Math.PI * i / DROP_SEARCH_DIRECTIONS;
            const place = {x: pos.x + ring * DROP_SEARCH_STEP * Math.cos(angle), y: pos.y,
                z: pos.z + ring * DROP_SEARCH_STEP * Math.sin(angle)};
            if (!DollarBillFlightUtil.isInBlock(voxels, place))
                return place;
        }
    }
    return undefined;
}

// With no flight under way, its first gust a while off.
function createFlight(now: number): DollarBillFlight
{
    return {waypoints: [], next: 0, blown: false, nextGustAt: now + randomBetween(GUST_INTERVAL_MS)};
}

// A random place over a floor that someone in the room can walk to, and far enough from all of them. There is no such
// place in a room too small for it, and none is needed: the next try may find one.
function pickSpawnPlace(voxels: Voxel[], people: Vec3[]): Vec3 | undefined
{
    const someone = people[Math.floor(Math.random() * people.length)];
    const start = VoxelPathUtil.findStandingVertexNear(voxels, VoxelPathUtil.feetOf(someone));
    if (start == undefined)
        return undefined;
    const places = VoxelPathUtil.findReach(voxels, start, MAX_ROOM_X + MAX_ROOM_Z).vertices.map(VoxelPathUtil.toWorld)
        .filter(place => people.every(person => Math.sqrt(Vector3DUtil.distSqr(VoxelPathUtil.feetOf(person), place))
            >= SPAWN_MIN_DISTANCE));
    if (places.length == 0)
        return undefined;
    const place = places[Math.floor(Math.random() * places.length)];
    return {x: place.x, y: place.y + SPAWN_HEIGHT, z: place.z};
}

// A bill's box, for what a stream reaches of it.
function getBox(pos: Vec3)
{
    const halfLength = 0.5 * DOLLAR_BILL_LENGTH;
    return {center: pos, halfSize: {x: halfLength, y: DOLLAR_BILL_REST_HEIGHT, z: halfLength}};
}

function randomBetween(range: number[]): number
{
    return range[0] + Math.random() * (range[1] - range[0]);
}

export default DollarBillUtil;
