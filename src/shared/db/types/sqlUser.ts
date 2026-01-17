import { UserType } from "../../user/types/userType";

export default interface SQLUser
{
    userID: number;
    userName: string;
    userType: UserType;
    passwordHash: string;
    email: string;
    tutorialStep: number;
}