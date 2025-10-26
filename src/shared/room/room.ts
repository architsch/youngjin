export default interface Room
{
    roomID: string;
    roomName: string;
    ownerUserName: string;
    texturePackURL: string;
    encodedVoxelGrid: string;
    linkedRoomIDs: string; // A comma-separated list of roomIDs.
}