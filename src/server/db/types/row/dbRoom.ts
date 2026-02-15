import { DBRow } from "./dbRow";
import { RoomType } from "../../../../shared/room/types/roomType";

export default interface DBRoom extends DBRow
{
    id?: string;
    version: number;
    roomName: string;
    roomType: RoomType;
    ownerUserID: string;
    texturePackPath: string;
}