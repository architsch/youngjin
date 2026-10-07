import BufferState from "../../../networking/types/bufferState";
import EncodableByteString from "../../../networking/types/encodableByteString";
import EncodableData from "../../../networking/types/encodableData";
import EncodableRaw4ByteNumber from "../../../networking/types/encodableRaw4ByteNumber";
import EncodableRawByteNumber from "../../../networking/types/encodableRawByteNumber";

// Gives the block a quad belongs to another shape where it stands (see VoxelBlockShapeUtil).
export default class SetVoxelBlockShapeSignal extends EncodableData
{
    roomID: string;
    quadIndex: number;
    shape: number;

    constructor(roomID: string, quadIndex: number, shape: number)
    {
        super();
        this.roomID = roomID;
        this.quadIndex = quadIndex;
        this.shape = shape;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.roomID).encode(bufferState);
        new EncodableRaw4ByteNumber(this.quadIndex).encode(bufferState);
        new EncodableRawByteNumber(this.shape).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const roomID = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const quadIndex = (EncodableRaw4ByteNumber.decode(bufferState) as EncodableRaw4ByteNumber).n;
        const shape = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        return new SetVoxelBlockShapeSignal(roomID, quadIndex, shape);
    }
}
