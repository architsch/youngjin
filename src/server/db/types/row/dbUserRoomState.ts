import { DBRow } from "./dbRow";

export default interface DBUserRoomState extends DBRow
{
    id?: string; // composite key: `${userID}_${roomID}`
    version: number;
    userID: string;
    roomID: string;
    lastX: number;
    lastY: number;
    lastZ: number;
    lastDirX: number;
    lastDirY: number;
    lastDirZ: number;
    playerMetadata: {[key: string]: string};
}
