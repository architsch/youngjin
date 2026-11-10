import Vec3 from "../../../shared/math/types/vec3";
import NumUtil from "../../../shared/math/util/numUtil";
import Vector3DUtil from "../../../shared/math/util/vector3DUtil";
import EncodableByteString from "../../../shared/networking/types/encodableByteString";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import { ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import ObjectTransform from "../../../shared/object/types/objectTransform";
import CannonBallObjectTypeConfig, { CANNON_BALL_BLAST_RADIUS } from "../../../shared/object/types/objectTypeConfig/cannonBallObjectTypeConfig";
import RemoveObjectSignal from "../../../shared/object/types/removeObjectSignal";
import SetObjectMetadataSignal from "../../../shared/object/types/setObjectMetadataSignal";
import CannonBallMotionUtil from "../../../shared/object/util/cannonBallMotionUtil";
import CannonBallStateUtil from "../../../shared/object/util/cannonBallStateUtil";
import CannonBlastUtil from "../../../shared/object/util/cannonBlastUtil";
import ObjectAttachmentUtil from "../../../shared/object/util/objectAttachmentUtil";
import ObjectIdUtil from "../../../shared/object/util/objectIdUtil";
import ObjectUpdateUtil from "../../../shared/object/util/objectUpdateUtil";
import PhysicsManager from "../../../shared/physics/physicsManager";
import PhysicsObject from "../../../shared/physics/types/physicsObject";
import PhysicsSphereHit from "../../../shared/physics/types/physicsSphereHit";
import PhysicsSphereUtil from "../../../shared/physics/util/physicsSphereUtil";
import Room from "../../../shared/room/types/room";
import RoomRuntimeMemory from "../../../shared/room/types/roomRuntimeMemory";
import { MAX_ROOM_X, MAX_ROOM_Y, MAX_ROOM_Z, UNIT_VEC3 } from "../../../shared/system/sharedConstants";
import ErrorUtil from "../../../shared/system/util/errorUtil";
import User from "../../../shared/user/types/user";
import { UserTypeEnumMap } from "../../../shared/user/types/userType";
import RemoveVoxelBlockSignal from "../../../shared/voxel/types/update/removeVoxelBlockSignal";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";
import VoxelUpdateUtil from "../../../shared/voxel/util/voxelUpdateUtil";
import AgentUserContext from "../../agent/types/agentUserContext";
import AgentBodyUtil from "../../agent/util/agentBodyUtil";
import DollarBillUtil from "../../inventory/util/dollarBillUtil";
import ServerRoomManager from "../../room/serverRoomManager";
import ServerLifecycleUtil from "../../system/util/serverLifecycleUtil";
import ServerUserManager from "../../user/serverUserManager";
import PlayerMotionCheckUtil from "../../user/util/playerMotionCheckUtil";
import ServerObjectManager from "../serverObjectManager";
import CannonBallFlight from "../types/cannonBallFlight";

const BALL_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType(CannonBallObjectTypeConfig.objectType);
const STATE_KEY = ObjectMetadataKeyEnumMap.CannonState;
// How many times in one step a ball may strike something that doesn't end it (another ball), before it rests until the
// next.
const MAX_STRIKES_PER_STEP = 4;
// The server flies and ends balls of its own accord, for nobody: and whatever a ball breaks, it breaks as nobody in
// particular might, by the rules that hold anyone (see breakBlock).
const NOBODY = new User("", "", UserTypeEnumMap.Guest, "", "");

// Kept with each room as long as it is loaded, whose unloading forgets it: its balls in the air, by object id.
const roomFlights = new WeakMap<RoomRuntimeMemory, Map<string, CannonBallFlight>>();

// Cannon balls, which cannons fire (see CannonUtil) and the server flies in multiplayer rooms while anyone is there
// (see CannonBallMotionUtil): each straight on until it strikes something, or is far out of the room, where it is
// taken away without a word. Where one strikes, everything within its blast's reach of that spot is looked at. Balls
// there bounce off it as billiard balls do. With a player there, a voxel block, the room's own floor or ceiling, or
// having struck anything else solid, it bursts: the players are thrown, each by whoever moves them (see
// CannonBlastUtil), the blocks are broken, with what hangs on them, where anybody at all could have taken them away,
// and it leaves a dollar bill behind if it threw nobody. Browsers fly each ball by themselves from what they are told
// of it: as it is fired, whenever something turns it, and that it burst, just before it goes. A room's saves keep its
// balls as they fly (see ObjectTypeConfigMap.isStoredWithRoom).
const CannonBallUtil =
{
    // Every room's balls, as time passes. From SocketsServer's flush, so what they do goes out with it. They keep still
    // once the server starts shutting down, as its last save keeps them.
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
                console.error(`CannonBallUtil.stepAll :: (roomID = ${memory.room.id}) Error: ${ErrorUtil.getErrorMessage(err)}`);
            }
        }
    },
    // Puts a ball in the air at a place, going at a velocity: whether the room had room for one more.
    launch: (room: Room, pos: Vec3, vel: Vec3): boolean =>
    {
        const memory = ServerRoomManager.roomRuntimeMemories[room.id];
        if (memory == undefined)
            return false;
        const flight: CannonBallFlight = {pos: {...pos}, vel: {...vel}};
        // Not one of the server's own ids (see ServerObjectManager.generateNonPersistentObjectId), which start over with
        // each restart that the room's saves keep it through.
        const ball = new AddObjectSignal(room.id, "", "", BALL_TYPE_INDEX, ObjectIdUtil.generateUniqueObjectId(room.objectById),
            getTransform(flight), {[STATE_KEY]: new EncodableByteString(encodeFlight(flight))});
        if (!ServerObjectManager.addObjectAsServer(room, NOBODY, ball))
            return false;
        getFlights(memory).set(ball.objectId, flight);
        return true;
    },
    // Ahead of the shutdown's save, which takes only rooms marked as changed: each room with a ball in the air.
    markRoomsToSave: (): void =>
    {
        for (const memory of Object.values(ServerRoomManager.roomRuntimeMemories))
        {
            if ((roomFlights.get(memory)?.size ?? 0) > 0)
                memory.room.dirty = true;
        }
    },
}

function stepRoom(memory: RoomRuntimeMemory, seconds: number): void
{
    const room = memory.room;
    if (!roomFlights.has(memory) && room.objectGroup.getCategoryCount(CannonBallObjectTypeConfig.category) == 0)
        return;

    const flights = getFlights(memory);
    for (const [objectId, flight] of [...flights])
    {
        const ball = room.objectById[objectId];
        // (One ended by another's burst, or by a room file loaded over the room.)
        if (ball == undefined)
            flights.delete(objectId);
        else if (flights.has(objectId))
            stepBall(room, flights, ball, flight, seconds);
    }
}

// Made as the room is first stepped since it loaded, taking up the balls it was stored with as they flew.
function getFlights(memory: RoomRuntimeMemory): Map<string, CannonBallFlight>
{
    let flights = roomFlights.get(memory);
    if (flights == undefined)
    {
        flights = new Map();
        for (const obj of Object.values(memory.room.objectById))
        {
            if (obj.objectTypeIndex != BALL_TYPE_INDEX)
                continue;
            const {pos, vel} = CannonBallStateUtil.getObjectState(obj);
            flights.set(obj.objectId, {pos, vel});
        }
        roomFlights.set(memory, flights);
    }
    return flights;
}

function stepBall(room: Room, flights: Map<string, CannonBallFlight>, ball: AddObjectSignal, flight: CannonBallFlight,
    seconds: number): void
{
    const velBefore = {...flight.vel};
    const ignoredObjectIds = new Set<string>([ball.objectId]);
    let secondsLeft = seconds;
    for (let strikes = 0; strikes < MAX_STRIKES_PER_STEP && secondsLeft > 0; ++strikes)
    {
        const flown = CannonBallMotionUtil.advance(room.id, flight.pos, flight.vel, secondsLeft, ignoredObjectIds);
        secondsLeft = flown.secondsLeft;
        if (flown.hit == undefined)
            break;
        if (strike(room, flights, ball, flight, flown.hit, ignoredObjectIds))
            return;
    }

    if (CannonBallMotionUtil.isGone(flight.pos))
    {
        end(room, flights, ball);
        return;
    }
    place(room, ball, flight);
    if (!Vector3DUtil.equal(velBefore, flight.vel))
        tell(room, ball);
}

// What becomes of a ball that has struck something, and of whatever its blast reaches: whether it burst. One that
// only met other balls flies on, turned by those it was closing in on, and through any it wasn't.
function strike(room: Room, flights: Map<string, CannonBallFlight>, ball: AddObjectSignal, flight: CannonBallFlight,
    hit: PhysicsSphereHit, ignoredObjectIds: Set<string>): boolean
{
    const physicsRoom = PhysicsManager.physicsRooms[room.id];
    const reached = PhysicsManager.getReachedBySphere(room.id, hit.contact, CANNON_BALL_BLAST_RADIUS,
        new Set<string>([ball.objectId]));
    const thrown = reached.objects.filter(object => PhysicsSphereUtil.isBody(physicsRoom, object));
    const struckBall = hit.object != undefined && hit.object.objectTypeIndex == BALL_TYPE_INDEX;

    for (const object of reached.objects)
    {
        const other = flights.get(object.objectId);
        if (other == undefined)
            continue;
        if (CannonBallMotionUtil.bounce(flight.pos, flight.vel, other.pos, other.vel))
        {
            const otherBall = room.objectById[object.objectId];
            place(room, otherBall, other);
            tell(room, otherBall);
        }
        else
            ignoredObjectIds.add(object.objectId);
    }
    if (struckBall && thrown.length == 0 && reached.blocks.length == 0)
        return false;

    burst(room, flights, ball, flight, thrown, reached.blocks);
    return true;
}

// The ball's end where it struck: told first, so that it is what browsers show and sound of all that follows from it.
function burst(room: Room, flights: Map<string, CannonBallFlight>, ball: AddObjectSignal, flight: CannonBallFlight,
    thrown: PhysicsObject[], blocks: {row: number, col: number, collisionLayer: number}[]): void
{
    ball.metadata[STATE_KEY] = new EncodableByteString(CannonBallStateUtil.encode({pos: flight.pos,
        vel: {x: 0, y: 0, z: 0}, exploded: true, hitObjectIds: thrown.map(object => object.objectId)}));
    tell(room, ball);

    for (const object of thrown)
        throwPlayer(room, flight.pos, object);
    const nearness = (block: {row: number, col: number, collisionLayer: number}) => Vector3DUtil.distSqr(flight.pos,
        VoxelQueryUtil.getVoxelBlockBox(block.row, block.col, block.collisionLayer).center);
    for (const block of [...blocks].sort((a, b) => nearness(a) - nearness(b)))
        breakBlock(room, block);

    end(room, flights, ball);
    if (thrown.length == 0)
        DollarBillUtil.drop(room, flight.pos);
}

// A browser throws its own user's player as it is told of the burst; an agent's, which the server walks, is thrown
// here. Either way their moves are believed for a while, however far and high they go (see PlayerMotionCheckUtil).
function throwPlayer(room: Room, burstPos: Vec3, object: PhysicsObject): void
{
    const player = room.objectById[object.objectId];
    const ctx = (player == undefined) ? undefined : ServerUserManager.getSocketUserContext(player.sourceUserID);
    if (player == undefined || ctx == undefined)
        return;
    PlayerMotionCheckUtil.noteBlast(ctx);
    if (ctx instanceof AgentUserContext)
    {
        AgentBodyUtil.push(ctx, CannonBlastUtil.getThrow(burstPos, player.transform.pos));
        ctx.inbox.noteThrown();
    }
}

// Breaks a block and takes what hangs on it with it, if anybody at all could: one in nobody's restricted zone, with
// nothing on it that only an admin or the room's superuser may take off (see VoxelEditUtil, where a user does the
// same). Otherwise all of it stays.
function breakBlock(room: Room, block: {row: number, col: number, collisionLayer: number}): void
{
    const quadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(block.row, block.col, block.collisionLayer);
    if (!VoxelUpdateUtil.canRemoveVoxelBlockWithItsAttachments(NOBODY, room, quadIndex))
        return;
    const attachedIds = ObjectAttachmentUtil.getObjectIdsAttachedToVoxelBlock(room, quadIndex);
    if (!attachedIds.every(objectId => ObjectUpdateUtil.canRemoveObject(NOBODY, room, new RemoveObjectSignal(room.id, objectId))))
        return;

    for (const objectId of attachedIds)
        ServerObjectManager.removeObjectAsServer(room, NOBODY, new RemoveObjectSignal(room.id, objectId));
    if (VoxelUpdateUtil.removeVoxelBlock(NOBODY, room.voxelGrid.voxels, quadIndex, room))
    {
        ServerRoomManager.socketRoomContexts[room.id].multicastSignal("removeVoxelBlockSignal",
            new RemoveVoxelBlockSignal(room.id, quadIndex));
    }
}

function end(room: Room, flights: Map<string, CannonBallFlight>, ball: AddObjectSignal): void
{
    flights.delete(ball.objectId);
    ServerObjectManager.removeObjectAsServer(room, NOBODY, new RemoveObjectSignal(room.id, ball.objectId));
}

// Keeps what the room holds of a ball where the ball is: its collider, for whatever else flies, and its stored state,
// for a save or a newcomer. Nobody is told: browsers fly it there themselves.
function place(room: Room, ball: AddObjectSignal, flight: CannonBallFlight): void
{
    const transform = getTransform(flight);
    Object.assign(ball.transform.pos, transform.pos);
    Object.assign(ball.transform.dir, transform.dir);
    if (PhysicsManager.hasObject(room.id, ball.objectId))
    {
        PhysicsManager.setObjectTransform(room.id, ball.objectId,
            new ObjectTransform(flight.pos, transform.dir, transform.scale), true);
    }
    ball.metadata[STATE_KEY] = new EncodableByteString(encodeFlight(flight));
}

// Tells the room what a ball's state now is.
function tell(room: Room, ball: AddObjectSignal): void
{
    ServerRoomManager.socketRoomContexts[room.id].multicastSignal("setObjectMetadataSignal",
        new SetObjectMetadataSignal(room.id, ball.objectId, STATE_KEY, ball.metadata[STATE_KEY].str));
}

function encodeFlight(flight: CannonBallFlight): string
{
    return CannonBallStateUtil.encode({pos: flight.pos, vel: flight.vel, exploded: false, hitObjectIds: []});
}

// A ball's transform, which holds no place past the room (see ObjectTransform): the nearest in it. It faces the way
// it flies.
function getTransform(flight: CannonBallFlight): ObjectTransform
{
    const {pos, vel} = flight;
    const dir = (Vector3DUtil.lengthSqr(vel) > 0) ? Vector3DUtil.normalize(vel) : {x: 0, y: 0, z: 1};
    return new ObjectTransform({x: NumUtil.clampInRange(pos.x, 0, MAX_ROOM_X), y: NumUtil.clampInRange(pos.y, 0, MAX_ROOM_Y),
        z: NumUtil.clampInRange(pos.z, 0, MAX_ROOM_Z)}, dir, {...UNIT_VEC3});
}

export default CannonBallUtil;
