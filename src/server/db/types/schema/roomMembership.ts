interface RoomMembership
{
    roomID: string;
    userID: string;
    userStatus: string; // "owner" | "member" | "invited" | "requested"
}