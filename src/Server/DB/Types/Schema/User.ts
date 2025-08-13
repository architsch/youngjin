interface User
{
    userID: string;
    userName: string;
    passwordHash: string;
    email: string;
    ownedRoomCount: number;
    ownedRoomCountMax: number;
}