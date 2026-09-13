import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import DBRoomUtil from "../../db/util/dbRoomUtil";
import DBSearchUtil from "../../db/util/dbSearchUtil";
import ServerRoomManager from "../serverRoomManager";

let pendingHubCreation: Promise<string> | undefined = undefined;

const HubRoomUtil =
{
    setupHubs: async () =>
    {
        // Look up the hubs in the DB.
        const roomSearchResult = await DBSearchUtil.rooms.withRoomType(RoomTypeEnumMap.Hub);
        if (!roomSearchResult.success)
        {
            console.error(`HubRoomUtil :: Failed to search for hubs.`);
            return;
        }

        // Ensure at least one hub exists, and preload all hubs so balancing needs no DB queries.
        if (roomSearchResult.data.length == 0)
        {
            await HubRoomUtil.createHub();
        }
        else
        {
            for (const dataEntry of roomSearchResult.data)
            {
                if (!dataEntry.id)
                    console.error(`HubRoomUtil :: Hub ID is undefined.`);
                else
                    await ServerRoomManager.loadRoom(dataEntry.id);
            }
        }
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
    if (!await ServerRoomManager.loadRoom(roomID))
    {
        console.error(`HubRoomUtil.createHub :: Failed to preload the newly created hub (roomID = ${roomID}).`);
        return "";
    }
    return roomID;
}

export default HubRoomUtil;
