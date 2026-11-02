import Vec3 from "../../../shared/math/types/vec3";
import Vector3DUtil from "../../../shared/math/util/vector3DUtil";
import { InventoryItemTypeEnumMap } from "../../../shared/inventory/types/inventoryItemType";
import EncodableData from "../../../shared/networking/types/encodableData";
import ObjectCategoryConfigMap from "../../../shared/object/maps/objectCategoryConfigMap";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import ObjectTransform from "../../../shared/object/types/objectTransform";
import DollarBillObjectTypeConfig, { DOLLAR_BILL_LENGTH, DOLLAR_BILL_REACH,
    DOLLAR_BILL_REST_HEIGHT } from "../../../shared/object/types/objectTypeConfig/dollarBillObjectTypeConfig";
import { PLAYER_EYE_HEIGHT, PLAYER_HEIGHT } from "../../../shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import ObjectCollectedSignal from "../../../shared/object/types/objectCollectedSignal";
import ObjectWaypoint from "../../../shared/object/types/objectWaypoint";
import RemoveObjectSignal from "../../../shared/object/types/removeObjectSignal";
import SetObjectPathSignal from "../../../shared/object/types/setObjectPathSignal";
import AdminPrefsUtil from "../../../shared/object/util/adminPrefsUtil";
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
import ServerObjectManager from "../../object/serverObjectManager";
import ServerRoomManager from "../../room/serverRoomManager";
import UserContext from "../../sockets/types/userContext";
import ServerUserManager from "../../user/serverUserManager";
import ServerInventoryManager from "../serverInventoryManager";
import DollarBillFlight from "../types/dollarBillFlight";
import DollarBillRoomState from "../types/dollarBillRoomState";
import DollarBillFlightUtil from "./dollarBillFlightUtil";

// A new bill comes this long after the last (or after the room had room for one), somewhere at least this far from
// everyone, out of their reach as it flutters down, this high over the floor. Then gusts blow it about, each this long
// after the last.
const SPAWN_INTERVAL_MS = [20_000, 60_000];
const SPAWN_MIN_DISTANCE = DOLLAR_BILL_REACH + 1.5;
const SPAWN_HEIGHT = 1.5;
const GUST_INTERVAL_MS = [4_000, 12_000];
// A player draws in a bill no farther over or under their middle than this, in world units, which leaves out the storey
// below them, and no wider than this of the way they face, across the room, in radians.
const REACH_UPWARD = 0.5 * PLAYER_HEIGHT + 0.35;
const REACH_ANGLE = Math.PI / 4;
const MAX_BILLS_PER_ROOM = ObjectCategoryConfigMap.getMaxCountPerRoom(DollarBillObjectTypeConfig.category);

const BILL_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType(DollarBillObjectTypeConfig.objectType);
// The server adds and removes bills of its own accord, for nobody.
const NOBODY = new User("", "", UserTypeEnumMap.Guest, "", "");

// Kept with each room as long as it is loaded, whose unloading forgets it.
const roomStates = new WeakMap<RoomRuntimeMemory, DollarBillRoomState>();

// $1 bills, which the server spawns in multiplayer rooms while someone is there to see it (a ghost isn't, as no bill
// makes way for one), up to a room's cap, at places someone can walk to, since a room's cap is spent on each until it is
// gone. It flies them along paths (see DollarBillFlightUtil), which clients play out by themselves: blown about by gusts
// now and then, and by fans' streams as they meet them, dropping onto whatever is under them. Whoever comes near one,
// looking its way with nothing between them, collects it at once (see ServerInventoryManager): the room is told, and each
// browser shows it go to them (see DollarBillGameObject.onCollected). A block laid over one destroys it, with no one the
// richer.
const DollarBillUtil =
{
    // Every room's bills, as time passes. From SocketsServer's flush, so what they do goes out with it.
    stepAll: (seconds: number): void =>
    {
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
}

function stepRoom(memory: RoomRuntimeMemory, seconds: number, now: number): void
{
    const people = getPeople(memory);
    if (people.length == 0)
        return;

    const state = getRoomState(memory);
    for (const [objectId, flight] of state.flights)
    {
        const bill = memory.room.objectById[objectId];
        if (bill == undefined)
            state.flights.delete(objectId);
        else
            stepBill(memory.room, state, bill, flight, people, seconds, now);
    }
    spawnWhenDue(memory.room, state, people, now);
}

function getRoomState(memory: RoomRuntimeMemory): DollarBillRoomState
{
    let state = roomStates.get(memory);
    if (state == undefined)
    {
        state = {flights: new Map(), nextSpawnAt: undefined};
        roomStates.set(memory, state);
    }
    return state;
}

// The players in a room who count: anyone but a ghost.
function getPeople(memory: RoomRuntimeMemory): {ctx: UserContext, player: AddObjectSignal}[]
{
    const people: {ctx: UserContext, player: AddObjectSignal}[] = [];
    for (const userID of Object.keys(memory.participantUserNameByID))
    {
        const ctx = ServerUserManager.getSocketUserContext(userID);
        const player = ServerUserManager.getPlayerObject(userID);
        if (ctx != undefined && player != undefined && !AdminPrefsUtil.isGhost(player))
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
    const collector = findCollector(voxels, pos, people);
    if (collector != undefined)
    {
        ServerRoomManager.socketRoomContexts[room.id].multicastSignal("objectCollectedSignal",
            new ObjectCollectedSignal(room.id, bill.objectId, collector.user.id));
        destroy(room, state, bill);
        ServerInventoryManager.addItem(collector, InventoryItemTypeEnumMap.Dollar, 1);
        return;
    }

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

// Whoever has it within reach, in front of them and in sight: the nearest, if several do.
function findCollector(voxels: Voxel[], pos: Vec3,
    people: {ctx: UserContext, player: AddObjectSignal}[]): UserContext | undefined
{
    let collector: UserContext | undefined = undefined;
    let nearest = DOLLAR_BILL_REACH;
    for (const {ctx, player} of people)
    {
        const {pos: at, dir} = player.transform;
        const across = Math.hypot(pos.x - at.x, pos.z - at.z);
        if (across <= nearest && Math.abs(pos.y - at.y) <= REACH_UPWARD && isFaced(at, dir, pos)
            && DollarBillFlightUtil.isInSight(voxels, {x: at.x, y: at.y + PLAYER_EYE_HEIGHT, z: at.z}, pos))
        {
            collector = ctx;
            nearest = across;
        }
    }
    return collector;
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

// The wait for the next bill starts as soon as the room has room for one.
function spawnWhenDue(room: Room, state: DollarBillRoomState, people: {player: AddObjectSignal}[], now: number): void
{
    if (state.flights.size >= MAX_BILLS_PER_ROOM)
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
    if (place == undefined)
        return;
    const bill = new AddObjectSignal(room.id, "", "", BILL_TYPE_INDEX, ServerObjectManager.generateNonPersistentObjectId(),
        new ObjectTransform(place, {x: 0, y: 0, z: 1}, {...UNIT_VEC3}));
    if (ServerObjectManager.addObjectAsServer(room, NOBODY, bill))
    {
        state.flights.set(bill.objectId, {waypoints: [], next: 0, blown: false,
            nextGustAt: now + randomBetween(GUST_INTERVAL_MS)});
    }
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
