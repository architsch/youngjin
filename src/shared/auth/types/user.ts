export default interface User
{
    userID: number;
    userName: string;
    userType: string; // "admin" | "member" | "guest"
    passwordHash: string;
}