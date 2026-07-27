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

        // If no hub is found in the DB, create one to make sure that
        // at least one hub is available for the incoming users.
        // Also, make sure that all the hub rooms are preloaded in ServerRoomManager,
        // so as to let us allocate incoming users to the available hubs without
        // running DB queries repeatedly.
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
    // Creates a brand new hub, preloads it into ServerRoomManager, and returns its ID
    // (or an empty string if the hub could not be made available).
    // Concurrent callers share a single creation, so a burst of users arriving while every
    // existing hub is over-populated opens exactly one new hub instead of one hub per user.
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
    const result = await DBRoomUtil.createRoom("", RoomTypeEnumMap.Hub, "", "", "default");
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
