import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableByteString from "../../networking/types/encodableByteString";
import EncodableRawByteNumber from "../../networking/types/encodableRawByteNumber";
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
        new EncodableRawByteNumber(this.userRole).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const userID = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const roomID = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const userRole = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        return new UserRoleUpdateParams(userID, roomID, userRole);
    }
}
