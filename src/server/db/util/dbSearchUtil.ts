import DBQueryResponse from "../types/dbQueryResponse";
import { RoomType, RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import DBUser from "../../../server/db/types/row/dbUser";
import DBQuery from "../types/dbQuery";
import DBRoom from "../../../server/db/types/row/dbRoom";
import LogUtil from "../../../shared/system/util/logUtil";
import { COLLECTION_ROOMS, COLLECTION_USERS } from "../../system/serverConstants";

const DBSearchUtil =
{
    rooms: {
        // Single page (offset-based) used by the room-list endpoint. Caller chooses pageSize
        // so the same helper can serve both the default list (10/page) and the search scan.
        page: async (offset: number, limit: number): Promise<DBQueryResponse<DBRoom>> => {
            LogUtil.log("DBSearchUtil.rooms.page", {offset, limit}, "low", "info");
            return await new DBQuery<DBRoom>()
                .select()
                .from(COLLECTION_ROOMS)
                .where("roomType", "!=", RoomTypeEnumMap.SinglePlayer) // Don't include singleplayer rooms in the search result.
                .limit(limit)
                .offset(offset)
                .run();
        },
        withRoomNameAndType: async (roomName: string, roomType: RoomType): Promise<DBQueryResponse<DBRoom>> => {
            LogUtil.log("DBSearchUtil.rooms.withRoomNameAndType", {roomName, roomType}, "low", "info");
            return await new DBQuery<DBRoom>()
                .select()
                .from(COLLECTION_ROOMS)
                .where("roomName", "==", roomName)
                .where("roomType", "==", roomType)
                .run();
        },
        withRoomType: async (roomType: RoomType): Promise<DBQueryResponse<DBRoom>> => {
            LogUtil.log("DBSearchUtil.rooms.withRoomType", {roomType}, "low", "info");
            return await new DBQuery<DBRoom>()
                .select()
                .from(COLLECTION_ROOMS)
                .where("roomType", "==", roomType)
                .run();
        },
    },
    users: {
        withUserName: async (userName: string): Promise<DBQueryResponse<DBUser>> => {
            LogUtil.log("DBSearchUtil.users.withUserName", {userName}, "low", "info");
            return await new DBQuery<DBUser>()
                .select()
                .from(COLLECTION_USERS)
                .where("userName", "==", userName)
                .run();
        },
        withEmail: async (email: string): Promise<DBQueryResponse<DBUser>> => {
            LogUtil.log("DBSearchUtil.users.withEmail", {email}, "low", "info");
            return await new DBQuery<DBUser>()
                .select()
                .from(COLLECTION_USERS)
                .where("email", "==", email)
                .run();
        },
        withUserNameOrEmail: async (userName: string, email: string): Promise<DBQueryResponse<DBUser>> => {
            LogUtil.log("DBSearchUtil.users.withUserNameOrEmail", {userName, email}, "low", "info");
            return await new DBQuery<DBUser>()
                .select()
                .from(COLLECTION_USERS)
                .where("userName", "==", userName)
                .or()
                .where("email", "==", email)
                .run();
        },
    },
}

export default DBSearchUtil;
