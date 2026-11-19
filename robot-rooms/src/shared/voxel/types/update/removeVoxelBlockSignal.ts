import BufferState from "../../../networking/types/bufferState";
import EncodableByteString from "../../../networking/types/encodableByteString";
import EncodableData from "../../../networking/types/encodableData";
import EncodableRaw4ByteNumber from "../../../networking/types/encodableRaw4ByteNumber";

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
        new EncodableRaw4ByteNumber(this.quadIndex).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const roomID = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const quadIndex = (EncodableRaw4ByteNumber.decode(bufferState) as EncodableRaw4ByteNumber).n;
        return new RemoveVoxelBlockSignal(roomID, quadIndex);
    }
}
