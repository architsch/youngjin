import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableRawByteNumber from "../../networking/types/encodableRawByteNumber";
import { RoomChangeRejectionReason } from "./roomChangeRejectionReason";

export default class RoomChangeRejectedSignal extends EncodableData
{
    reason: RoomChangeRejectionReason;

    constructor(reason: RoomChangeRejectionReason)
    {
        super();
        this.reason = reason;
    }

    encode(bufferState: BufferState)
    {
        new EncodableRawByteNumber(this.reason).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const reason = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        return new RoomChangeRejectedSignal(reason);
    }
}
