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
    lastX: number;
    lastY: number;
    lastZ: number;
    lastDirX: number;
    lastDirY: number;
    lastDirZ: number;
    playerMetadata: {[key: string]: string};
    lastLoginAt: number;
}