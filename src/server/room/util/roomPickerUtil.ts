import RoomRuntimeMemory from "../../../shared/room/types/roomRuntimeMemory";
import ObjectCategoryConfigMap from "../../../shared/object/maps/objectCategoryConfigMap";
import { ObjectCategoryEnumMap } from "../../../shared/object/types/objectCategory";
import RoomValidationUtil from "../../../shared/room/util/roomValidationUtil";
import { HUB_ROOM_ID_KEYWORD, ROOM_ALMOST_FULL_MARGIN, ROOM_EDITOR_SINGLE_PLAYER_MODE, ROOM_OVER_POPULATION_THRESHOLD, ROOM_UNDER_POPULATION_THRESHOLD, TUTORIAL_SINGLE_PLAYER_MODE } from "../../../shared/system/sharedConstants";
import UserContext from "../../sockets/types/userContext";
import DBUserUtil from "../../db/util/dbUserUtil";
import ServerRoomManager from "../serverRoomManager";
import HubRoomCandidate from "../types/hubRoomCandidate";
import HubRoomUtil from "./hubRoomUtil";

const RoomPickerUtil =
{
    pickBestRoomID: async (socketUserContext: UserContext, pickContext: "appStart" | "requestFromUser"): Promise<string> =>
    {
        const user = socketUserContext.user;
        const joinHints = socketUserContext.getJoinHints();
        const targetRoomID = joinHints.targetRoomID;

        // A room named in the URL skips a pending tutorial altogether, for good.
        if (pickContext == "appStart" && user.singlePlayerMode == TUTORIAL_SINGLE_PLAYER_MODE
            && typeof targetRoomID == "string" && targetRoomID.length > 0)
        {
            user.singlePlayerMode = "";
            await DBUserUtil.setSinglePlayerMode(user.id, "");
        }

        let roomID: string;
        if (pickContext == "appStart" && joinHints.roomEditorOpen === true && RoomValidationUtil.userIsAdmin(user)) // If the connection came back to a client that is still in the room editor (see SocketsClient),
            roomID = ROOM_EDITOR_SINGLE_PLAYER_MODE; // User should be left there, as the room being edited is kept nowhere else.
        else if (pickContext == "appStart" && user.singlePlayerMode && user.singlePlayerMode.length > 0) // If the user is supposed to enter a single-player mode (e.g. tutorial),
            roomID = user.singlePlayerMode; // User should join the corresponding single-player room. (If targetRoomID exists, the user should join it AFTER finishing the single-player mode first, unless it was the tutorial, skipped above.)
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
        // Hubs are known by the registry rather than being held in memory (see HubRoomUtil).
        // Almost-full hubs are excluded first.
        const hubRooms: HubRoomCandidate[] = [];
        for (const [hubRoomID, initialJoinPriority] of Object.entries(HubRoomUtil.initialJoinPriorityByHubRoomID))
        {
            const population = RoomPickerUtil.getRoomPopulationByID(hubRoomID);
            if (!RoomPickerUtil.isPopulationAlmostFull(population))
                hubRooms.push({roomID: hubRoomID, initialJoinPriority, population});
        }

        if (hubRooms.length == 0 || hubRooms.every(hubRoom =>
            hubRoom.population >= ROOM_OVER_POPULATION_THRESHOLD))
        {
            // All over-populated (or none exist): open a new hub.
            const newHubRoomID = await HubRoomUtil.createHub();
            if (newHubRoomID.length > 0)
                return newHubRoomID;

            // Creation failed: fall back to the emptiest hub with space.
            console.error(`RoomPickerUtil.pickBestHubRoomID :: Failed to open a new hub. Falling back to an over-populated one.`);
            return pickLeastPopulatedRoomID(hubRooms);
        }

        const underPopulatedHubRooms = hubRooms.filter(hubRoom =>
            hubRoom.population <= ROOM_UNDER_POPULATION_THRESHOLD);

        if (underPopulatedHubRooms.length > 0)
        {
            // Fill one under-populated hub past the threshold before the next, so visitors meet
            // instead of being spread thin. Which one goes first is the admins' to order.
            return pickEarliestByPriorityRoomID(underPopulatedHubRooms);
        }

        // All medium: pick the least populated.
        return pickLeastPopulatedRoomID(hubRooms);
    },
    // The hub quiet hubs fill from, where a newcomer most often lands: the earliest in the admins' order, however
    // full. "" with no hub.
    getFirstHubRoomID: (): string =>
    {
        return pickEarliestByPriorityRoomID(Object.entries(HubRoomUtil.initialJoinPriorityByHubRoomID)
            .map(([roomID, initialJoinPriority]) => ({roomID, initialJoinPriority, population: 0})));
    },
    getRoomPopulation: (roomRuntimeMemory: RoomRuntimeMemory): number =>
    {
        return Object.keys(roomRuntimeMemory.participantUserNameByID).length;
    },
    // Rooms load only when somebody joins, so an unloaded room is an empty one.
    getRoomPopulationByID: (roomID: string): number =>
    {
        const roomRuntimeMemory = ServerRoomManager.roomRuntimeMemories[roomID];
        return (roomRuntimeMemory != undefined)
            ? RoomPickerUtil.getRoomPopulation(roomRuntimeMemory) : 0;
    },
    // Admission test with a margin below the hard cap for in-flight joins. Overruns just leave some
    // body parts undrawn on clients.
    isPopulationAlmostFull: (population: number): boolean =>
    {
        const maxPlayersPerRoom = ObjectCategoryConfigMap.getMaxCountPerRoom(ObjectCategoryEnumMap.Player);
        return population >= maxPlayersPerRoom - ROOM_ALMOST_FULL_MARGIN;
    },
    isRoomAlmostFull: (roomRuntimeMemory: RoomRuntimeMemory): boolean =>
    {
        return RoomPickerUtil.isPopulationAlmostFull(
            RoomPickerUtil.getRoomPopulation(roomRuntimeMemory));
    },
}

// Earliest in the admins' order (ties by room ID), or "".
function pickEarliestByPriorityRoomID(candidates: HubRoomCandidate[]): string
{
    return pickBestRoomID(candidates, (candidate, best) =>
        (candidate.initialJoinPriority != best.initialJoinPriority)
            ? candidate.initialJoinPriority < best.initialJoinPriority
            : candidate.roomID < best.roomID);
}

// Least populated candidate (ties by priority, then room ID), or "".
function pickLeastPopulatedRoomID(candidates: HubRoomCandidate[]): string
{
    return pickBestRoomID(candidates, (candidate, best) =>
        (candidate.population != best.population)
            ? candidate.population < best.population
            : (candidate.initialJoinPriority != best.initialJoinPriority)
                ? candidate.initialJoinPriority < best.initialJoinPriority
                : candidate.roomID < best.roomID);
}

function pickBestRoomID(candidates: HubRoomCandidate[],
    isBetter: (candidate: HubRoomCandidate, best: HubRoomCandidate) => boolean): string
{
    let best: HubRoomCandidate | undefined = undefined;
    for (const candidate of candidates)
    {
        if (best == undefined || isBetter(candidate, best))
            best = candidate;
    }
    return (best != undefined) ? best.roomID : "";
}

export default RoomPickerUtil;
