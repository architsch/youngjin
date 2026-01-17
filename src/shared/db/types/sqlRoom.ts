import { RoomType } from "../../room/types/roomType";

export default interface SQLRoom
{
    roomID: number;
    roomName: string;
    roomType: RoomType;
    ownerUserName: string;
    texturePackURL: string;
    voxelGrid: ArrayBuffer;
    persistentObjectGroup: ArrayBuffer;
}