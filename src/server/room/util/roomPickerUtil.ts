import RoomRuntimeMemory from "../../../shared/room/types/roomRuntimeMemory";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import { MAX_PLAYERS_PER_ROOM, ROOM_ALMOST_FULL_MARGIN, ROOM_OVER_POPULATION_THRESHOLD, ROOM_UNDER_POPULATION_THRESHOLD } from "../../../shared/system/sharedConstants";
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
            if (targetRoomID == "hub") // If the specified ID is the reserved "hub" keyword,
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
    // Picks the hub that the next user should be routed into, keeping every hub's population
    // inside the healthy band (i.e. neither so empty that its visitors have nobody to meet,
    // nor so crowded that everyone's performance degrades).
    // Returns an empty string only if no hub could be made available at all.
    pickBestHubRoomID: async (): Promise<string> =>
    {
        // Note: It is assumed here that all Hub rooms are preloaded in ServerRoomManager.
        // A hub that has already reached the hard player cap can never be a destination,
        // so it is left out before any of the balancing decisions below.
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
            // Every existing hub is over-populated (or there is no hub at all yet), so open a
            // brand new one rather than pushing yet another user into a crowded room.
            const newHubRoomID = await HubRoomUtil.createHub();
            if (newHubRoomID.length > 0)
                return newHubRoomID;

            // The new hub could not be made available. Rather than leaving the user roomless,
            // fall back to the emptiest hub that still has a free slot (if there is one).
            console.error(`RoomPickerUtil.pickBestHubRoomID :: Failed to open a new hub. Falling back to an over-populated one.`);
            return pickLeastPopulatedRoomID(hubRooms);
        }

        const underPopulatedHubRooms = hubRooms.filter(mem =>
            RoomPickerUtil.getRoomPopulation(mem) <= ROOM_UNDER_POPULATION_THRESHOLD);

        if (underPopulatedHubRooms.length > 0)
        {
            // "Fill one up to a sufficient level, then start filling the next one":
            // every user keeps landing in the same under-populated hub until that hub grows past
            // the under-population threshold. Distributing them evenly instead would leave a set
            // of near-empty hubs, which is the worse outcome — a hub is a meeting place, so a
            // handful of users spread one per room would each end up alone.
            // Ordering the candidates by their room ID keeps the choice deterministic (i.e. the
            // same hub is chosen for as long as the set of under-populated hubs stays the same).
            return underPopulatedHubRooms
                .map(mem => mem.room.id)
                .sort()[0];
        }

        // Every remaining hub sits in the medium band (i.e. neither under- nor over-populated),
        // so spread the incoming users evenly and let those hubs fill up at the same rate.
        return pickLeastPopulatedRoomID(hubRooms);
    },
    getRoomPopulation: (roomRuntimeMemory: RoomRuntimeMemory): number =>
    {
        return Object.keys(roomRuntimeMemory.participantUserNameByID).length;
    },
    // The admission test for every route into a room. It stops short of the hard cap by a margin,
    // so that the joins which may already be in flight cannot carry the room past it. Should a
    // burst of simultaneous joins overrun the margin anyway, the room simply holds more players
    // than its clients have mesh instances for, and the surplus body parts go undrawn.
    isRoomAlmostFull: (roomRuntimeMemory: RoomRuntimeMemory): boolean =>
    {
        return RoomPickerUtil.getRoomPopulation(roomRuntimeMemory) >= MAX_PLAYERS_PER_ROOM - ROOM_ALMOST_FULL_MARGIN;
    },
}

// Returns the ID of the least populated room among the given candidates
// (or an empty string if there is no candidate at all).
// Ties are broken by the room ID, so that the outcome stays deterministic.
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
