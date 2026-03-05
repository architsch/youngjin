import { DBRow } from "./dbRow";
import { UserRole } from "../../../../shared/user/types/userRole";

export default interface DBUserRoomState extends DBRow
{
    id?: string; // composite key: `${userID}_${roomID}`
    version: number;
    userID: string;
    userName: string;
    email: string;
    roomID: string;
    userRole: UserRole;
    lastX: number;
    lastY: number;
    lastZ: number;
    lastDirX: number;
    lastDirY: number;
    lastDirZ: number;
    playerMetadata: {[key: string]: string};
}
