import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import DBRoomUtil from "../../db/util/dbRoomUtil";
import DBUserUtil from "../../db/util/dbUserUtil";

const OwnedRoomUtil =
{
    // Opens the one room that belongs to this user and records it on their account, returning the
    // new room's ID (or an empty string if it could not be created).
    // A user owns at most one room, so the caller is responsible for having established that this
    // user owns none yet — calling it for a user who already owns one strands the room they had.
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
    // Hands a user who has just signed up the room that comes with being a member, returning its
    // ID so that the caller can send them straight into it. Owning a room already means this is a
    // returning member rather than a first-time sign-up, so nothing is created and an empty string
    // comes back — the same answer as a failed creation, since in both cases there is no new room
    // to send anyone to and the user simply resumes wherever they were.
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
