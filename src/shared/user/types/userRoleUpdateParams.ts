import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableByteString from "../../networking/types/encodableByteString";
import { UserRole } from "./userRole";

export default class UserRoleUpdateParams extends EncodableData
{
    userID: string;
    roomID: string;
    userRole: UserRole;

    constructor(userID: string, roomID: string, userRole: UserRole)
    {
        super();
        this.userID = userID;
        this.roomID = roomID;
        this.userRole = userRole;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.userID).encode(bufferState);
        new EncodableByteString(this.roomID).encode(bufferState);
        new EncodableByteString(String(this.userRole)).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const userID = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const roomID = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const userRole = parseInt((EncodableByteString.decode(bufferState) as EncodableByteString).str);
        return new UserRoleUpdateParams(userID, roomID, userRole);
    }
}
