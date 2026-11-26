import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import ObjectTransform from "../../../shared/object/types/objectTransform";
import PetObjectTypeConfig from "../../../shared/object/types/objectTypeConfig/petObjectTypeConfig";
import ObjectWaypoint from "../../../shared/object/types/objectWaypoint";
import SetObjectPathSignal from "../../../shared/object/types/setObjectPathSignal";
import PetBodyUtil from "../../../shared/object/util/petBodyUtil";
import PetPathSyncUtil, { PET_WAY_MAX_WAYPOINTS } from "../../../shared/object/util/petPathSyncUtil";
import PetShownStateUtil from "../../../shared/object/util/petShownStateUtil";
import PhysicsManager from "../../../shared/physics/physicsManager";
import RoomRuntimeMemory from "../../../shared/room/types/roomRuntimeMemory";
import ErrorUtil from "../../../shared/system/util/errorUtil";
import ServerRoomManager from "../../room/serverRoomManager";
import UserContext from "../../sockets/types/userContext";

const PET_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType(PetObjectTypeConfig.objectType);

// Kept with each room as long as it is loaded, whose unloading forgets it: the ways its pets are on, by object id, each
// with the waypoint it goes to next.
const roomWays = new WeakMap<RoomRuntimeMemory, Map<string, {waypoints: ObjectWaypoint[], next: number}>>();

// The ways the pets that browsers play are on (see PetPathSyncUtil): each browser tells the way its user's pet sets off
// on, the others are told it, and the server plays it out as they do, so that the room has the pet about where its
// owner does, for what the server flies or walks past it, and for whoever comes into the room, who is told the rest of
// the way.
const PetPathServerUtil =
{
    // A way a user's browser tells for one of their own pets: whether it was taken.
    onSetObjectPathSignalReceived: (ctx: UserContext, signal: SetObjectPathSignal): boolean =>
    {
        const roomID = ServerRoomManager.currentRoomIDByUserID[ctx.user.id];
        const memory = ServerRoomManager.roomRuntimeMemories[roomID];
        const pet = memory?.room.objectById[signal.objectId];
        if (memory == undefined || pet == undefined || pet.objectTypeIndex != PET_TYPE_INDEX
            || pet.sourceUserID != ctx.user.id || signal.waypoints.length > PET_WAY_MAX_WAYPOINTS)
        {
            return false;
        }
        getWays(memory).set(pet.objectId, {waypoints: signal.waypoints, next: 0});
        ServerRoomManager.socketRoomContexts[roomID].multicastSignalFromUser("setObjectPathSignal",
            new SetObjectPathSignal(roomID, pet.objectId, signal.waypoints), ctx);
        return true;
    },
    // Every room's pets on a way, as time passes. From SocketsServer's flush.
    stepAll: (seconds: number): void =>
    {
        for (const memory of Object.values(ServerRoomManager.roomRuntimeMemories))
        {
            try
            {
                stepRoom(memory, seconds);
            }
            catch (err)
            {
                console.error(`PetPathServerUtil.stepAll :: (roomID = ${memory.room.id}) Error: ${ErrorUtil.getErrorMessage(err)}`);
            }
        }
    },
    // A user just sent the room they come into (see ServerRoomManager.changeUserRoom): the rest of each way, from where
    // the room has its pet.
    tellNewcomer: (roomID: string, userID: string): void =>
    {
        const memory = ServerRoomManager.roomRuntimeMemories[roomID];
        for (const [objectId, way] of (memory == undefined) ? [] : (roomWays.get(memory) ?? []))
        {
            if (way.next < way.waypoints.length && memory.room.objectById[objectId] != undefined)
            {
                ServerRoomManager.socketRoomContexts[roomID].unicastSignal("setObjectPathSignal",
                    new SetObjectPathSignal(roomID, objectId, way.waypoints.slice(way.next)), userID);
            }
        }
    },
}

function getWays(memory: RoomRuntimeMemory): Map<string, {waypoints: ObjectWaypoint[], next: number}>
{
    let ways = roomWays.get(memory);
    if (ways == undefined)
        roomWays.set(memory, ways = new Map());
    return ways;
}

// A pet's collider goes with it, as each browser's does, and it faces the way it goes, or the way it shows it stands.
function stepRoom(memory: RoomRuntimeMemory, seconds: number): void
{
    const room = memory.room;
    for (const [objectId, way] of roomWays.get(memory) ?? [])
    {
        const pet = room.objectById[objectId];
        if (pet == undefined || way.next >= way.waypoints.length)
        {
            roomWays.get(memory)!.delete(objectId);
            continue;
        }
        const followed = PetPathSyncUtil.follow(way.waypoints, way.next, pet.transform.pos, seconds);
        way.next = followed.next;
        const facing = PetShownStateUtil.getObjectState(pet).facing ?? followed.facing;
        if (facing != undefined)
            Object.assign(pet.transform.dir, PetBodyUtil.getDir(facing));
        if (PhysicsManager.hasObject(room.id, objectId))
        {
            PhysicsManager.setObjectTransform(room.id, objectId, new ObjectTransform(pet.transform.pos, pet.transform.dir,
                pet.transform.scale), true);
        }
    }
}

export default PetPathServerUtil;
