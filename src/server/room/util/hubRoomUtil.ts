import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import DBRoomUtil from "../../db/util/dbRoomUtil";
import DBSearchUtil from "../../db/util/dbSearchUtil";
import ServerRoomManager from "../serverRoomManager";

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
            let result = await DBRoomUtil.createRoom("", RoomTypeEnumMap.Hub, "", "", "default");
            if (!result.success)
            {
                console.error(`HubRoomUtil :: Failed to create a hub.`);
                return;
            }
            await ServerRoomManager.loadRoom(result.data[0].id);
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
}

export default HubRoomUtil;