import BufferState from "../../networking/types/bufferState";
import EncodableByteString from "../../networking/types/encodableByteString";
import EncodableData from "../../networking/types/encodableData";

export default class RequestRoomChangeSignal extends EncodableData
{
    roomID: string;
    allowFallback: boolean;

    constructor(roomID: string, allowFallback: boolean)
    {
        super();
        this.roomID = roomID;
        this.allowFallback = allowFallback;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.roomID).encode(bufferState);
        bufferState.view[bufferState.byteIndex++] = this.allowFallback ? 1 : 0;
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const roomID = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const allowFallback = (bufferState.view[bufferState.byteIndex++] === 1);
        return new RequestRoomChangeSignal(roomID, allowFallback);
    }
}