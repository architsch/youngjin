export default interface Room
{
    roomID: string;
    roomName: string;
    ownerUserName: string;
    texturePackURL: string;
    encodedVoxelGrid: ArrayBuffer;
    encodedPersistentObjects: ArrayBuffer;
}