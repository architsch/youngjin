export default interface SerializedRoom
{
    roomID: number;
    roomName: string;
    roomType: string;
    ownerUserName: string;
    texturePackURL: string;
    voxelGrid: ArrayBuffer;
    persistentObjectGroup: ArrayBuffer;
}