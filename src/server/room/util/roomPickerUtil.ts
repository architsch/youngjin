import RoomRuntimeMemory from "../../../shared/room/types/roomRuntimeMemory";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import SocketUserContext from "../../sockets/types/socketUserContext";
import ServerRoomManager from "../serverRoomManager";

const RoomPickerUtil =
{
    pickBestRoomID: async (socketUserContext: SocketUserContext, pickContext: "appStart" | "requestFromUser"): Promise<string> =>
    {
        const user = socketUserContext.user;
        const socket = socketUserContext.socket;
        const targetRoomID = socket.handshake.auth.targetRoomID as string | undefined;

        let roomID: string;
        if (pickContext == "appStart" && user.singlePlayerMode && user.singlePlayerMode.length > 0) // If the user is supposed to enter a single-player mode (e.g. tutorial),
            roomID = user.singlePlayerMode; // User should join the corresponding single-player room. (If targetRoomID exists, the user should join it AFTER finishing the single-player mode first.)
        else if (targetRoomID && targetRoomID.length > 0) // If roomID was explicitly specified in the URL as a parameter,
        {
            if (targetRoomID == "hub") // If the specified ID is the reserved "hub" keyword,
                roomID = await RoomPickerUtil.pickBestHubRoomID(socketUserContext); // User should join any one of the available hubs (Not just a randomly chosen one, but the one that is the most appropriate.)
            else
                roomID = targetRoomID; // User should join the room with the specified ID.
        }
        else if (user.lastRoomID && user.lastRoomID.length > 0) // If the user has ever visited a multiplayer room before,
            roomID = user.lastRoomID; // User should join the most recently visited multiplayer room ([lastRoomID == ""] if the user hasn't visited any multiplayer room yet)
        else
            roomID = await RoomPickerUtil.pickBestHubRoomID(socketUserContext); // User should join any one of the available hubs (Not just a randomly chosen one, but the one that is the most appropriate.)

        return roomID;
    },
    pickBestHubRoomID: async (socketUserContext: SocketUserContext): Promise<string> =>
    {
        // Note: It is assumed here that all Hub rooms are preloaded in ServerRoomManager.
        const hubRooms: RoomRuntimeMemory[] = [];
        for (const roomRuntimeMemory of Object.values(ServerRoomManager.roomRuntimeMemories))
        {
            if (roomRuntimeMemory.room.roomType == RoomTypeEnumMap.Hub)
                hubRooms.push(roomRuntimeMemory);
        }
        // TODO: Implement the following logic:
        /*
        if (All Hub rooms are over-populated)
        {
            Create a new Hub room and let the user join it.
        }
        else if (There is at least one under-populated Hub room)
        {
            The user should join the under-populated Hub room whose ID's lexicographic order is the smallest.
            (If computing the lexicographic order is not feasible or reliable, use a
            different heuristic which is deterministic in nature (i.e. always giving the same order
            as long as the room's ID stays the same).)
        }
        else
        {
            The user should join the Hub room with the least number of players in it.
        }
        */
        return "";
    },
}

export default RoomPickerUtil;