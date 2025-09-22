export default interface User
{
    userID: string;
    userName: string;
    userType: string; // "admin" | "member" | "guest"
    passwordHash: string;
    email: string;
}