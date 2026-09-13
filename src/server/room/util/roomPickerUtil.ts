import RoomRuntimeMemory from "../../../shared/room/types/roomRuntimeMemory";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import { MAX_PLAYERS_PER_ROOM } from "../../../shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import { HUB_ROOM_ID_KEYWORD, ROOM_ALMOST_FULL_MARGIN, ROOM_OVER_POPULATION_THRESHOLD, ROOM_UNDER_POPULATION_THRESHOLD } from "../../../shared/system/sharedConstants";
import SocketUserContext from "../../sockets/types/socketUserContext";
import ServerRoomManager from "../serverRoomManager";
import HubRoomUtil from "./hubRoomUtil";

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
            if (targetRoomID == HUB_ROOM_ID_KEYWORD) // If the specified ID is the reserved "hub" keyword,
                roomID = await RoomPickerUtil.pickBestHubRoomID(); // User should join any one of the available hubs (Not just a randomly chosen one, but the one that is the most appropriate.)
            else
                roomID = targetRoomID; // User should join the room with the specified ID.
        }
        else if (user.lastRoomID && user.lastRoomID.length > 0) // If the user has ever visited a multiplayer room before,
            roomID = user.lastRoomID; // User should join the most recently visited multiplayer room ([lastRoomID == ""] if the user hasn't visited any multiplayer room yet)
        else
            roomID = await RoomPickerUtil.pickBestHubRoomID(); // User should join any one of the available hubs (Not just a randomly chosen one, but the one that is the most appropriate.)

        return roomID;
    },
    // Picks a hub keeping populations in the healthy band. Returns "" only if no hub is available.
    pickBestHubRoomID: async (): Promise<string> =>
    {
        // Assumes hubs are preloaded. Almost-full hubs are excluded first.
        const hubRooms: RoomRuntimeMemory[] = [];
        for (const roomRuntimeMemory of Object.values(ServerRoomManager.roomRuntimeMemories))
        {
            if (roomRuntimeMemory.room.roomType == RoomTypeEnumMap.Hub &&
                !RoomPickerUtil.isRoomAlmostFull(roomRuntimeMemory))
            {
                hubRooms.push(roomRuntimeMemory);
            }
        }

        if (hubRooms.length == 0 || hubRooms.every(mem =>
            RoomPickerUtil.getRoomPopulation(mem) >= ROOM_OVER_POPULATION_THRESHOLD))
        {
            // All over-populated (or none exist): open a new hub.
            const newHubRoomID = await HubRoomUtil.createHub();
            if (newHubRoomID.length > 0)
                return newHubRoomID;

            // Creation failed: fall back to the emptiest hub with space.
            console.error(`RoomPickerUtil.pickBestHubRoomID :: Failed to open a new hub. Falling back to an over-populated one.`);
            return pickLeastPopulatedRoomID(hubRooms);
        }

        const underPopulatedHubRooms = hubRooms.filter(mem =>
            RoomPickerUtil.getRoomPopulation(mem) <= ROOM_UNDER_POPULATION_THRESHOLD);

        if (underPopulatedHubRooms.length > 0)
        {
            // Fill one under-populated hub (lowest room ID, deterministic) past the threshold before
            // the next, so visitors meet instead of being spread thin.
            return underPopulatedHubRooms
                .map(mem => mem.room.id)
                .sort()[0];
        }

        // All medium: pick the least populated.
        return pickLeastPopulatedRoomID(hubRooms);
    },
    getRoomPopulation: (roomRuntimeMemory: RoomRuntimeMemory): number =>
    {
        return Object.keys(roomRuntimeMemory.participantUserNameByID).length;
    },
    // Admission test with a margin below the hard cap for in-flight joins. Overruns just leave some
    // body parts undrawn on clients.
    isRoomAlmostFull: (roomRuntimeMemory: RoomRuntimeMemory): boolean =>
    {
        return RoomPickerUtil.getRoomPopulation(roomRuntimeMemory) >= MAX_PLAYERS_PER_ROOM - ROOM_ALMOST_FULL_MARGIN;
    },
}

// Least populated candidate (ties by room ID), or "".
function pickLeastPopulatedRoomID(candidates: RoomRuntimeMemory[]): string
{
    let bestRoomID = "";
    let bestPopulation = Number.MAX_SAFE_INTEGER;
    for (const roomRuntimeMemory of candidates)
    {
        const population = RoomPickerUtil.getRoomPopulation(roomRuntimeMemory);
        if (population < bestPopulation ||
            (population == bestPopulation && roomRuntimeMemory.room.id < bestRoomID))
        {
            bestRoomID = roomRuntimeMemory.room.id;
            bestPopulation = population;
        }
    }
    return bestRoomID;
}

export default RoomPickerUtil;
