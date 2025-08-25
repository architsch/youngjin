interface User
{
    userID: string;
    userName: string;
    userType: string; // "admin" | "member"
    passwordHash: string;
    email: string;
    ownedRoomCount: number;
    ownedRoomCountMax: number;
}