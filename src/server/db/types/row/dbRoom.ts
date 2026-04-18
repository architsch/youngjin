import { DBRow } from "./dbRow";
import { RoomType } from "../../../../shared/room/types/roomType";

export default interface DBRoom extends DBRow
{
    id?: string;
    version: number;
    roomType: RoomType;
    ownerUserID: string;
    // Denormalized owner userName so room listings can render the owner's name without
    // an extra DB query per row. Populated when the room is created and refreshed
    // on owner-userName changes (or lazily backfilled at server startup).
    ownerUserName: string;
    texturePackPath: string;
}