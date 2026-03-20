import BufferState from "../../../networking/types/bufferState";
import EncodableByteString from "../../../networking/types/encodableByteString";
import EncodableData from "../../../networking/types/encodableData";
import EncodableRaw2ByteNumber from "../../../networking/types/encodableRaw2ByteNumber";

export default class RemoveVoxelBlockSignal extends EncodableData
{
    roomID: string;
    quadIndex: number;

    constructor(roomID: string, quadIndex: number)
    {
        super();
        this.roomID = roomID;
        this.quadIndex = quadIndex;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.roomID).encode(bufferState);
        new EncodableRaw2ByteNumber(this.quadIndex).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const roomID = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const quadIndex = (EncodableRaw2ByteNumber.decode(bufferState) as EncodableRaw2ByteNumber).n;
        return new RemoveVoxelBlockSignal(roomID, quadIndex);
    }
}
