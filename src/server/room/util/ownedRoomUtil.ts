import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import DBRoomUtil from "../../db/util/dbRoomUtil";
import DBUserUtil from "../../db/util/dbUserUtil";

const OwnedRoomUtil =
{
    // Creates the user's owned room and records it; returns the ID or "". The caller must ensure the
    // user owns none (an existing one would be stranded).
    createOwnedRoom: async (userID: string, ownerUserName: string): Promise<string> =>
    {
        const createResult = await DBRoomUtil.createRoom("", RoomTypeEnumMap.Regular,
            userID, ownerUserName);
        if (!createResult.success || createResult.data.length == 0)
        {
            console.error(`OwnedRoomUtil.createOwnedRoom :: Failed to create a room (userID = ${userID}).`);
            return "";
        }

        const roomID = createResult.data[0].id;
        await DBUserUtil.setOwnedRoomID(userID, roomID);
        return roomID;
    },
    // Gives a new member their room and returns its ID; returns "" if they already own one (returning
    // member) or creation failed.
    setUpFirstOwnedRoom: async (userID: string): Promise<string> =>
    {
        const dbUser = await DBUserUtil.findUserById(userID);
        if (!dbUser)
        {
            console.error(`OwnedRoomUtil.setUpFirstOwnedRoom :: User not found (userID = ${userID}).`);
            return "";
        }
        if (dbUser.ownedRoomID && dbUser.ownedRoomID.length > 0)
            return "";

        return await OwnedRoomUtil.createOwnedRoom(userID, dbUser.userName);
    },
}

export default OwnedRoomUtil;
