import { DBRow } from "./dbRow";
import { UserType } from "../../../../shared/user/types/userType";

export default interface DBUser extends DBRow
{
    id?: string;
    version: number;
    userName: string;
    userType: UserType;
    email: string;
    tutorialStep: number;
    lastRoomID: string;
    lastLoginAt: number;
    createdAt: number;
    loginCount: number;
    totalPlaytimeMs: number;
}