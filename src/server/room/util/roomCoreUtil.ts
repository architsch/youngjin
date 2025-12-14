import PhysicsManager from "../../../shared/physics/physicsManager";
import RoomGenerator from "../../../shared/room/roomGenerator";
import Room from "../../../shared/room/types/room";
import RoomRuntimeMemory from "../../../shared/room/types/roomRuntimeMemory";
import SocketRoomContext from "../../sockets/types/socketRoomContext";
import NetworkUtil from "../../util/networkUtil";
import RoomManager from "../roomManager";

export async function loadRoom(roomID: string): Promise<RoomRuntimeMemory>
{
    console.log(`RoomManager.loadRoom :: roomID = ${roomID}`);
    if (RoomManager.roomRuntimeMemories[roomID] != undefined)
        throw new Error(`RoomManager.loadRoom :: RoomRuntimeMemory already exists (roomID = ${roomID})`);

    let room: Room;

    if (roomID.startsWith("s")) // static room (procedurally generated)
    {
        const roomData = RoomGenerator.generateRoom(roomID);
        room = new Room(
            roomID,
            roomID, // roomName
            "", // ownerUserName (static room is not owned by anyone)
            `${process.env.MODE == "dev" ? `http://${NetworkUtil.getLocalIpAddress()}:${process.env.PORT}` : process.env.URL_STATIC}/app/assets/texture_packs/default.jpg`,
            roomData.voxelGrid,
            roomData.persistentObjects
        );
    }
    else
    {
        throw new Error(`Fetching room from database is not supported yet (roomID = ${roomID})`);
    }

    const roomRuntimeMemory = new RoomRuntimeMemory(room, {}, {});
    RoomManager.roomRuntimeMemories[roomID] = roomRuntimeMemory;
    RoomManager.socketRoomContexts[roomID] = new SocketRoomContext();

    PhysicsManager.load(roomRuntimeMemory);
    return roomRuntimeMemory;
}

export function unloadRoom(roomID: string)
{
    console.log(`RoomManager.unloadRoom :: roomID = ${roomID}`);
    const roomRuntimeMemory = RoomManager.roomRuntimeMemories[roomID];
    if (RoomManager.roomRuntimeMemories[roomID] == undefined)
        throw new Error(`RoomManager.unloadRoom :: RoomRuntimeMemory doesn't exist (roomID = ${roomID})`);
    if (Object.keys(roomRuntimeMemory.participantUserNames).length > 0)
        throw new Error(`RoomManager.unloadRoom :: There are still participants in the room (participants = [${JSON.stringify(roomRuntimeMemory.participantUserNames)}])`);
    delete RoomManager.roomRuntimeMemories[roomID];
    delete RoomManager.socketRoomContexts[roomID];

    PhysicsManager.unload(roomID);
}