import { DBRow } from "./dbRow";
import { RoomType } from "../../../../shared/room/types/roomType";
import DBRoomEditor from "./dbRoomEditor";

export default interface DBRoom extends DBRow
{
    id?: string;
    version: number;
    roomName: string;
    roomType: RoomType;
    ownerUserID: string;
    ownerUserName: string;
    texturePackPath: string;
    editors: DBRoomEditor[];
}
