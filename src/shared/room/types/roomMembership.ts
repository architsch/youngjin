export default interface RoomMembership
{
    roomID: number;
    userID: string;
    userStatus: string; // "owner" | "member" | "invited" | "requested"
}