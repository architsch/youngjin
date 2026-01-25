import PhysicsManager from "../../../shared/physics/physicsManager";
import RoomRuntimeMemory from "../../../shared/room/types/roomRuntimeMemory";
import DBRoomUtil from "../../db/util/dbRoomUtil";
import SocketRoomContext from "../../sockets/types/socketRoomContext";
import RoomManager from "../roomManager";

export async function loadRoom(roomID: string): Promise<RoomRuntimeMemory | null>
{
    console.log(`RoomManager.loadRoom :: roomID = ${roomID}`);
    if (RoomManager.roomRuntimeMemories[roomID] != undefined)
        throw new Error(`RoomManager.loadRoom :: RoomRuntimeMemory already exists (roomID = ${roomID})`);

    const room = await DBRoomUtil.getRoomContent(roomID);
    if (!room)
        return null;

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