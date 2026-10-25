import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import { UserTypeEnumMap } from "../../../shared/user/types/userType";
import User from "../../../shared/user/types/user";
import DBRoomUtil from "../../db/util/dbRoomUtil";
import DBUserUtil from "../../db/util/dbUserUtil";

const OwnedRoomUtil =
{
    // Creates the owner's room and records it; returns the ID or "". Only an AI agent ever gets a room of its own;
    // people build in hubs and in rooms others leave open. The caller must ensure the owner has none (an existing one
    // would be stranded).
    createOwnedRoom: async (owner: User): Promise<string> =>
    {
        if (owner.userType != UserTypeEnumMap.Agent)
        {
            console.error(`OwnedRoomUtil.createOwnedRoom :: Refused a room to a non-agent (userID = ${owner.id}).`);
            return "";
        }

        const createResult = await DBRoomUtil.createRoom("", RoomTypeEnumMap.Regular,
            owner.id, owner.userName);
        if (!createResult.success || createResult.data.length == 0)
        {
            console.error(`OwnedRoomUtil.createOwnedRoom :: Failed to create a room (userID = ${owner.id}).`);
            return "";
        }

        const roomID = createResult.data[0].id;
        await DBUserUtil.setOwnedRoomID(owner.id, roomID);
        return roomID;
    },
}

export default OwnedRoomUtil;
