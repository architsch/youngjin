import dotenv from "dotenv";
import DBQueryResponse from "../types/dbQueryResponse";
import { RoomType } from "../../../shared/room/types/roomType";
import DBUser from "../../../server/db/types/row/dbUser";
import DBQuery from "../types/dbQuery";
import DBRoom from "../../../server/db/types/row/dbRoom";
dotenv.config();

const DBSearchUtil =
{
    rooms: {
        all: async (page: number): Promise<DBQueryResponse<DBRoom>> => {
            return await new DBQuery<DBRoom>()
                .select()
                .from("rooms")
                .orderBy("roomName")
                .limit(10)
                .offset(page * 10)
                .run();
        },
        withRoomName: async (roomName: string): Promise<DBQueryResponse<DBRoom>> => {
            return await new DBQuery<DBRoom>()
                .select()
                .from("rooms")
                .where("roomName", "==", roomName)
                .run();
        },
        withRoomType: async (roomType: RoomType): Promise<DBQueryResponse<DBRoom>> => {
            return await new DBQuery<DBRoom>()
                .select()
                .from("rooms")
                .where("roomType", "==", roomType)
                .run();
        },
    },
    users: {
        all: async (page: number): Promise<DBQueryResponse<DBUser>> => {
            return await new DBQuery<DBUser>()
                .select()
                .from("users")
                .orderBy("userName")
                .limit(10)
                .offset(page * 10)
                .run();
        },
        withUserName: async (userName: string): Promise<DBQueryResponse<DBUser>> => {
            return await new DBQuery<DBUser>()
                .select()
                .from("users")
                .where("userName", "==", userName)
                .run();
        },
        withEmail: async (email: string): Promise<DBQueryResponse<DBUser>> => {
            return await new DBQuery<DBUser>()
                .select()
                .from("users")
                .where("email", "==", email)
                .run();
        },
        withUserNameOrEmail: async (userName: string, email: string): Promise<DBQueryResponse<DBUser>> => {
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