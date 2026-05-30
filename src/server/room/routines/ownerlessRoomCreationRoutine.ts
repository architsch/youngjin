import { RoomType } from "../../../shared/room/types/roomType";
import DBRoomUtil from "../../db/util/dbRoomUtil";
import DBSearchUtil from "../../db/util/dbSearchUtil";

const OwnerlessRoomCreationRoutine =
{
    createIfMissing: async (roomName: string, roomType: RoomType) =>
    {
        const roomSearchResult = (roomName == "")
            ? (await DBSearchUtil.rooms.withRoomType(roomType))
            : (await DBSearchUtil.rooms.withRoomNameAndType(roomName, roomType));
        if (!roomSearchResult.success)
        {
            console.error(`[Server Routine Failure] :: Failed to search for a room of type ${roomType}.`);
            return;
        }

        if (roomSearchResult.data.length == 0)
        {
            let result = await DBRoomUtil.createRoom(roomName, roomType, "", "", "default");
            if (!result.success)
            {
                console.error(`[Server Routine Failure] :: Failed to create a room of type ${roomType}.`);
                return;
            }
        }
    },
}

export default OwnerlessRoomCreationRoutine;