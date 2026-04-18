import { RoomType } from "./roomType";

// Lightweight room metadata returned by the room-list/search endpoints.
// Excludes voxel/object content so listings stay cheap.
export default interface RoomListEntry
{
    id: string;
    roomType: RoomType;
    ownerUserID: string;
    ownerUserName: string;
}
