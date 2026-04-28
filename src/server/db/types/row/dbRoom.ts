import { DBRow } from "./dbRow";
import { RoomType } from "../../../../shared/room/types/roomType";

export default interface DBRoom extends DBRow
{
    id?: string;
    version: number;
    roomType: RoomType;
    ownerUserID: string;
    ownerUserName: string;
    texturePackPath: string;
}