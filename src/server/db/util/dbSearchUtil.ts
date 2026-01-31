import DBQueryResponse from "../types/dbQueryResponse";
import { RoomType } from "../../../shared/room/types/roomType";
import DBUser from "../../../server/db/types/row/dbUser";
import DBQuery from "../types/dbQuery";
import DBRoom from "../../../server/db/types/row/dbRoom";
import LogUtil from "../../../shared/system/util/logUtil";

const DBSearchUtil =
{
    rooms: {
        all: async (page: number): Promise<DBQueryResponse<DBRoom>> => {
            LogUtil.log("DBSearchUtil.rooms.all", {page}, "low", "info");
            return await new DBQuery<DBRoom>()
                .select()
                .from("rooms")
                .orderBy("roomName")
                .limit(10)
                .offset(page * 10)
                .run();
        },
        withRoomName: async (roomName: string): Promise<DBQueryResponse<DBRoom>> => {
            LogUtil.log("DBSearchUtil.rooms.withRoomName", {roomName}, "low", "info");
            return await new DBQuery<DBRoom>()
                .select()
                .from("rooms")
                .where("roomName", "==", roomName)
                .run();
        },
        withRoomType: async (roomType: RoomType): Promise<DBQueryResponse<DBRoom>> => {
            LogUtil.log("DBSearchUtil.rooms.withRoomType", {roomType}, "low", "info");
            return await new DBQuery<DBRoom>()
                .select()
                .from("rooms")
                .where("roomType", "==", roomType)
                .run();
        },
    },
    users: {
        all: async (page: number): Promise<DBQueryResponse<DBUser>> => {
            LogUtil.log("DBSearchUtil.users.all", {page}, "low", "info");
            return await new DBQuery<DBUser>()
                .select()
                .from("users")
                .orderBy("userName")
                .limit(10)
                .offset(page * 10)
                .run();
        },
        withUserName: async (userName: string): Promise<DBQueryResponse<DBUser>> => {
            LogUtil.log("DBSearchUtil.users.withUserName", {userName}, "low", "info");
            return await new DBQuery<DBUser>()
                .select()
                .from("users")
                .where("userName", "==", userName)
                .run();
        },
        withEmail: async (email: string): Promise<DBQueryResponse<DBUser>> => {
            LogUtil.log("DBSearchUtil.users.withEmail", {email}, "low", "info");
            return await new DBQuery<DBUser>()
                .select()
                .from("users")
                .where("email", "==", email)
                .run();
        },
        withUserNameOrEmail: async (userName: string, email: string): Promise<DBQueryResponse<DBUser>> => {
            LogUtil.log("DBSearchUtil.users.withUserNameOrEmail", {userName, email}, "low", "info");
            return await new DBQuery<DBUser>()
                .select()
                .from("users")
                .where("userName", "==", userName)
                .or()
                .where("email", "==", email)
                .run();
        },
    },
}

export default DBSearchUtil;