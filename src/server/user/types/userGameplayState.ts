import { UserRole } from "../../../shared/user/types/userRole";

export default interface UserGameplayState
{
    userID: string;
    userName: string;
    email: string;
    lastRoomID: string;
    userRole: UserRole;
    lastX: number;
    lastY: number;
    lastZ: number;
    lastDirX: number;
    lastDirY: number;
    lastDirZ: number;
    playerMetadata: {[key: string]: string};
    sessionDurationMs?: number;
}