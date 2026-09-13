import { RoomType } from "./roomType";

// Room list/search entry, without voxel or object content.
export default interface RoomListEntry
{
    id: string;
    roomType: RoomType;
    ownerUserID: string;
    ownerUserName: string;
}
