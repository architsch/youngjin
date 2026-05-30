import { DBRow } from "./dbRow";
import { UserType } from "../../../../shared/user/types/userType";

export default interface DBUser extends DBRow
{
    id?: string;
    version: number;
    userName: string;
    userType: UserType;
    email: string;
    singlePlayerMode: string; // "" if not in singlePlayer mode.
    lastRoomID: string;
    lastLoginAt: number;
    createdAt: number;
    loginCount: number;
    ownedRoomID: string;
    playerMetadata: {[key: string]: string};
}