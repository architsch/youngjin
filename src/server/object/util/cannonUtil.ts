import Vector3DUtil from "../../../shared/math/util/vector3DUtil";
import EncodableByteString from "../../../shared/networking/types/encodableByteString";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import { CannonPhaseEnumMap } from "../../../shared/object/types/cannonPhase";
import CannonState from "../../../shared/object/types/cannonState";
import { ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import { CANNON_BALL_SPEED } from "../../../shared/object/types/objectTypeConfig/cannonBallObjectTypeConfig";
import CannonObjectTypeConfig, { CANNON_AIM_TOLERANCE, CANNON_FIRE_INTERVAL_SECONDS, CANNON_LOCK_SECONDS,
    CANNON_MAX_RANGE, CANNON_MIN_RANGE, CANNON_READY_SECONDS, CANNON_REST_SECONDS, CANNON_SPENT_SECONDS,
    CANNON_TURN_RATE } from "../../../shared/object/types/objectTypeConfig/cannonObjectTypeConfig";
import RemoveObjectSignal from "../../../shared/object/types/removeObjectSignal";
import SetObjectMetadataSignal from "../../../shared/object/types/setObjectMetadataSignal";
import AdminPrefsUtil from "../../../shared/object/util/adminPrefsUtil";
import CannonAimUtil from "../../../shared/object/util/cannonAimUtil";
import CannonStateUtil from "../../../shared/object/util/cannonStateUtil";
import PhysicsManager from "../../../shared/physics/physicsManager";
import PhysicsSphereUtil from "../../../shared/physics/util/physicsSphereUtil";
import Room from "../../../shared/room/types/room";
import RoomRuntimeMemory from "../../../shared/room/types/roomRuntimeMemory";
import ErrorUtil from "../../../shared/system/util/errorUtil";
import User from "../../../shared/user/types/user";
import { UserTypeEnumMap } from "../../../shared/user/types/userType";
import ServerRoomManager from "../../room/serverRoomManager";
import ServerLifecycleUtil from "../../system/util/serverLifecycleUtil";
import ServerUserManager from "../../user/serverUserManager";
import ServerObjectManager from "../serverObjectManager";
import CannonPlay from "../types/cannonPlay";
import CannonBallUtil from "./cannonBallUtil";

const CANNON_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType(CannonObjectTypeConfig.objectType);
const STATE_KEY = ObjectMetadataKeyEnumMap.CannonState;
// The server takes a spent cannon away of its own accord, for nobody.
const NOBODY = new User("", "", UserTypeEnumMap.Guest, "", "");

// Kept with each room as long as it is loaded, whose unloading forgets it: its cannons as they are played, by object
// id.
const roomPlays = new WeakMap<RoomRuntimeMemory, Map<string, CannonPlay>>();

// Cannons, which the server plays in multiplayer rooms while anyone is there. One just installed, or switched on,
// rests a moment. Then, each time a wait of some seconds runs out, it turns toward the player nearest its pivot,
// slowly, and goes on turning after them wherever they go, for as long as it takes to have them in its sights a
// while without a break: pointing at them, from where it may fire at them (in range, not too near, where its barrel
// tilts to, with nothing between). So whoever keeps going round it faster than it turns is never fired at. Aimed, it
// stands a moment and fires that way, wherever they have gone by then (see CannonBallUtil), and waits again. Its last
// ball fired, it stands a moment more and is taken away. Switched off, it does nothing, and starts over rested when
// switched on. A ghost is nobody to it (see AdminPrefsUtil.isGhost).
//
// All of it is kept in the cannon's own CannonState, so that a room's saves keep it: written as it changes, and told
// to the room only where a browser shows it (see CannonStateUtil.getShownPart), the time left never. Its switch is
// its user's, and only read here.
const CannonUtil =
{
    // Every room's cannons, as time passes. From SocketsServer's flush, so what they do goes out with it. They keep
    // still once the server starts shutting down, as its last save keeps them.
    stepAll: (seconds: number): void =>
    {
        if (ServerLifecycleUtil.isShuttingDown())
            return;
        for (const memory of Object.values(ServerRoomManager.roomRuntimeMemories))
        {
            try
            {
                if (Object.keys(memory.participantUserNameByID).length > 0)
                    stepRoom(memory, seconds);
            }
            catch (err)
            {
                console.error(`CannonUtil.stepAll :: (roomID = ${memory.room.id}) Error: ${ErrorUtil.getErrorMessage(err)}`);
            }
        }
    },
    // Ahead of the shutdown's save, which takes only rooms marked as changed: each room whose cannons were played.
    markRoomsToSave: (): void =>
    {
        for (const memory of Object.values(ServerRoomManager.roomRuntimeMemories))
        {
            if ((roomPlays.get(memory)?.size ?? 0) > 0)
                memory.room.dirty = true;
        }
    },
}

function stepRoom(memory: RoomRuntimeMemory, seconds: number): void
{
    const room = memory.room;
    let plays = roomPlays.get(memory);
    if (room.objectGroup.getCategoryCount(CannonObjectTypeConfig.category) == 0)
    {
        plays?.clear();
        return;
    }
    if (plays == undefined)
    {
        plays = new Map();
        roomPlays.set(memory, plays);
    }

    for (const objectId of [...plays.keys()])
    {
        if (room.objectById[objectId] == undefined)
            plays.delete(objectId);
    }
    const players = getPlayers(memory);
    for (const cannon of Object.values(room.objectById))
    {
        if (cannon.objectTypeIndex == CANNON_TYPE_INDEX)
            stepCannon(room, plays, cannon, players, seconds);
    }
}

// The room's players a cannon may fire at.
function getPlayers(memory: RoomRuntimeMemory): AddObjectSignal[]
{
    const players: AddObjectSignal[] = [];
    for (const userID of Object.keys(memory.participantUserNameByID))
    {
        const player = ServerUserManager.getPlayerObject(userID);
        if (player != undefined && memory.room.objectById[player.objectId] != undefined && !AdminPrefsUtil.isGhost(player))
            players.push(player);
    }
    return players;
}

function stepCannon(room: Room, plays: Map<string, CannonPlay>, cannon: AddObjectSignal, players: AddObjectSignal[],
    seconds: number): void
{
    const stored = CannonStateUtil.getObjectState(cannon);
    let play = plays.get(cannon.objectId);
    // Taken up as its room keeps it: as it was stored, or as its user just added it.
    if (play == undefined)
    {
        play = {state: stored, targetObjectId: undefined, inSightsSeconds: undefined,
            told: CannonStateUtil.getShownPart(CannonStateUtil.encode(stored))};
        plays.set(cannon.objectId, play);
    }
    const state = play.state;

    // Its switch thrown either way, it starts over rested.
    if (stored.on != state.on)
    {
        state.on = stored.on;
        setPhase(state, CannonPhaseEnumMap.Resting, CANNON_REST_SECONDS);
    }
    else if (state.on)
    {
        // Its turning to someone has no time to run out: it lasts until it is aimed.
        if (state.phase == CannonPhaseEnumMap.Aiming)
            aim(room, cannon, play, players, seconds);
        else
        {
            state.timeLeft -= seconds;
            if (state.timeLeft <= 0 && !advance(room, cannon, play))
            {
                plays.delete(cannon.objectId);
                return;
            }
        }
    }
    keep(room, cannon, play);
}

// What a cannon does as its rest, its wait or its standing aimed runs out. False once it is gone.
function advance(room: Room, cannon: AddObjectSignal, play: CannonPlay): boolean
{
    const state = play.state;
    switch (state.phase)
    {
        case CannonPhaseEnumMap.Resting:
            wait(state);
            return true;
        case CannonPhaseEnumMap.Waiting:
            if (state.ballsLeft <= 0)
            {
                ServerObjectManager.removeObjectAsServer(room, NOBODY, new RemoveObjectSignal(room.id, cannon.objectId));
                return false;
            }
            play.targetObjectId = undefined;
            play.inSightsSeconds = undefined;
            setPhase(state, CannonPhaseEnumMap.Aiming, 0);
            return true;
        default:
            fire(room, cannon, play);
            return true;
    }
}

// Turns the barrel toward whoever is nearest, wherever they are and whether or not it may fire at them, for as long
// as it takes. It is aimed once it has had them in its sights long enough without a break: pointing near enough at
// them, from where it may fire at them. With nobody to turn to, it keeps still.
function aim(room: Room, cannon: AddObjectSignal, play: CannonPlay, players: AddObjectSignal[], seconds: number): void
{
    const state = play.state;
    const target = getNearestPlayer(cannon, players);
    if (target?.objectId != play.targetObjectId)
    {
        play.targetObjectId = target?.objectId;
        play.inSightsSeconds = undefined;
    }
    if (target == undefined)
        return;

    const {pos, dir} = cannon.transform;
    const wanted = CannonAimUtil.getAim(dir, Vector3DUtil.subtract(target.transform.pos, CannonAimUtil.getPivot(pos, dir))).aim;
    state.aim = CannonAimUtil.turnToward(state.aim, wanted, CANNON_TURN_RATE * seconds);
    const inSights = CannonAimUtil.getAngleBetween(state.aim, wanted) <= CANNON_AIM_TOLERANCE
        && mayFireAt(room, cannon, target);
    // Counted from the step they came into them, so that they have stayed there at least as long as it counts.
    if (!inSights)
        play.inSightsSeconds = undefined;
    else
        play.inSightsSeconds = (play.inSightsSeconds == undefined) ? 0 : play.inSightsSeconds + seconds;

    if (play.inSightsSeconds != undefined && play.inSightsSeconds >= CANNON_LOCK_SECONDS)
        setPhase(state, CannonPhaseEnumMap.Ready, CANNON_READY_SECONDS);
}

// Fires the way the barrel points. A ball the room has no room for is not spent. Emptied, it has one short wait
// left, at the end of which it goes.
function fire(room: Room, cannon: AddObjectSignal, play: CannonPlay): void
{
    const state = play.state;
    const {pos, dir} = cannon.transform;
    const velocity = Vector3DUtil.scale(CannonAimUtil.getDirection(dir, state.aim), CANNON_BALL_SPEED);
    if (CannonBallUtil.launch(room, CannonAimUtil.getMuzzle(pos, dir, state.aim), velocity))
        --state.ballsLeft;
    if (state.ballsLeft > 0)
        wait(state);
    else
        setPhase(state, CannonPhaseEnumMap.Waiting, CANNON_SPENT_SECONDS);
}

function getNearestPlayer(cannon: AddObjectSignal, players: AddObjectSignal[]): AddObjectSignal | undefined
{
    const pivot = CannonAimUtil.getPivot(cannon.transform.pos, cannon.transform.dir);
    let nearest: AddObjectSignal | undefined = undefined;
    let nearestDistSqr = Infinity;
    for (const player of players)
    {
        const distSqr = Vector3DUtil.distSqr(pivot, player.transform.pos);
        if (distSqr < nearestDistSqr)
        {
            nearest = player;
            nearestDistSqr = distSqr;
        }
    }
    return nearest;
}

// Whether a cannon may fire at a player: in range and not too near, where its barrel tilts to, and with nothing
// between the barrel's mouth, pointed at their middle, and them, but what a ball bounces off (a mirror, an NPC, another
// cannon), which hides nobody from it.
function mayFireAt(room: Room, cannon: AddObjectSignal, player: AddObjectSignal): boolean
{
    const {pos, dir} = cannon.transform;
    const middle = player.transform.pos;
    const toward = Vector3DUtil.subtract(middle, CannonAimUtil.getPivot(pos, dir));
    const distance = Vector3DUtil.length(toward);
    if (distance > CANNON_MAX_RANGE || distance < CANNON_MIN_RANGE)
        return false;
    const {aim, reachable} = CannonAimUtil.getAim(dir, toward);
    if (!reachable)
        return false;
    const muzzle = CannonAimUtil.getMuzzle(pos, dir, aim);
    const lookedPast = new Set<string>([cannon.objectId]);
    while (true)
    {
        const struck = PhysicsManager.castSphere(room.id, muzzle, middle, 0, lookedPast);
        if (struck == undefined || struck.object?.objectId == player.objectId)
            return true;
        if (struck.object == undefined || !PhysicsSphereUtil.bounces(struck.object))
            return false;
        lookedPast.add(struck.object.objectId);
    }
}

// Until it next turns to someone.
function wait(state: CannonState): void
{
    const [shortest, longest] = CANNON_FIRE_INTERVAL_SECONDS;
    setPhase(state, CannonPhaseEnumMap.Waiting, shortest + Math.random() * (longest - shortest));
}

function setPhase(state: CannonState, phase: number, seconds: number): void
{
    state.phase = phase;
    state.timeLeft = seconds;
}

// Writes a cannon's state where its room keeps it, and tells the room if what shows of it changed.
function keep(room: Room, cannon: AddObjectSignal, play: CannonPlay): void
{
    const encoded = CannonStateUtil.encode(play.state);
    cannon.metadata[STATE_KEY] = new EncodableByteString(encoded);
    const shown = CannonStateUtil.getShownPart(encoded);
    if (shown == play.told)
        return;
    play.told = shown;
    room.dirty = true;
    ServerRoomManager.socketRoomContexts[room.id].multicastSignal("setObjectMetadataSignal",
        new SetObjectMetadataSignal(room.id, cannon.objectId, STATE_KEY, encoded));
}

export default CannonUtil;
