import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import RoomPrefsUtil from "../../../shared/room/util/roomPrefsUtil";
import DBRoomUtil from "../../db/util/dbRoomUtil";
import DBSearchUtil from "../../db/util/dbSearchUtil";
import ServerRoomManager from "../serverRoomManager";

let pendingHubCreation: Promise<string> | undefined = undefined;

// Every hub's join priority, by room ID. This is all that balancing needs of a hub nobody is in, so
// hubs are held no differently from any other room (see RoomPickerUtil).
const initialJoinPriorityByHubRoomID: {[hubRoomID: string]: number} = {};

const HubRoomUtil =
{
    initialJoinPriorityByHubRoomID,
    setupHubs: async () =>
    {
        // Look up the hubs in the DB.
        const roomSearchResult = await DBSearchUtil.rooms.withRoomType(RoomTypeEnumMap.Hub);
        if (!roomSearchResult.success)
        {
            console.error(`HubRoomUtil :: Failed to search for hubs.`);
            return;
        }

        for (const dataEntry of roomSearchResult.data)
        {
            if (!dataEntry.id)
                console.error(`HubRoomUtil :: Hub ID is undefined.`);
            else
                HubRoomUtil.registerHub(dataEntry.id, dataEntry.prefs);
        }

        // Ensure at least one hub exists, so balancing always has somewhere to send an arrival.
        if (Object.keys(initialJoinPriorityByHubRoomID).length == 0)
            await HubRoomUtil.createHub();
    },
    // Records a hub's join priority from its stored prefs (decoding is total; see RoomPrefsUtil).
    registerHub: (hubRoomID: string, prefs: string) =>
    {
        initialJoinPriorityByHubRoomID[hubRoomID] = RoomPrefsUtil.decode(prefs).initialJoinPriority;
    },
    // Creates and preloads a hub; returns its ID or "". Concurrent callers share one creation.
    createHub: async (): Promise<string> =>
    {
        if (pendingHubCreation != undefined)
            return pendingHubCreation;

        pendingHubCreation = _createHub();
        try
        {
            return await pendingHubCreation;
        }
        finally
        {
            pendingHubCreation = undefined;
        }
    },
}

async function _createHub(): Promise<string>
{
    const result = await DBRoomUtil.createRoom("", RoomTypeEnumMap.Hub, "", "");
    if (!result.success || !result.data[0] || !result.data[0].id)
    {
        console.error(`HubRoomUtil.createHub :: Failed to create a hub.`);
        return "";
    }

    const roomID = result.data[0].id;
    const roomRuntimeMemory = await ServerRoomManager.loadRoom(roomID);
    if (!roomRuntimeMemory)
    {
        console.error(`HubRoomUtil.createHub :: Failed to preload the newly created hub (roomID = ${roomID}).`);
        return "";
    }

    // Registered from the loaded room, so the priority is the one generation chose for it.
    HubRoomUtil.registerHub(roomID, roomRuntimeMemory.room.prefs);
    return roomID;
}

export default HubRoomUtil;
