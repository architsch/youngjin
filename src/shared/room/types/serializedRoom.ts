export default interface SerializedRoom
{
    roomID: number;
    roomName: string;
    ownerUserName: string;
    texturePackURL: string;
    voxelGrid: ArrayBuffer;
    persistentObjectGroup: ArrayBuffer;
}