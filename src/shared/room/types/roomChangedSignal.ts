import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableRawByteNumber from "../../networking/types/encodableRawByteNumber";
import { UserRole } from "../../user/types/userRole";
import RoomRuntimeMemory from "./roomRuntimeMemory";

export default class RoomChangedSignal extends EncodableData
{
    roomRuntimeMemory: RoomRuntimeMemory;
    currentUserRole: UserRole;

    constructor(roomRuntimeMemory: RoomRuntimeMemory, currentUserRole: UserRole)
    {
        super();
        this.roomRuntimeMemory = roomRuntimeMemory;
        this.currentUserRole = currentUserRole;
    }

    encode(bufferState: BufferState)
    {
        this.roomRuntimeMemory.encode(bufferState);
        new EncodableRawByteNumber(this.currentUserRole).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const roomRuntimeMemory = RoomRuntimeMemory.decode(bufferState) as RoomRuntimeMemory;
        const currentUserRole = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        return new RoomChangedSignal(roomRuntimeMemory, currentUserRole);
    }
}
