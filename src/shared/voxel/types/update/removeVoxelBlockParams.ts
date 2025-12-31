import BufferState from "../../../networking/types/bufferState";
import EncodableData from "../../../networking/types/encodableData";
import EncodableRaw2ByteNumber from "../../../networking/types/encodableRaw2ByteNumber";

export default class RemoveVoxelBlockParams extends EncodableData
{
    quadIndex: number;

    constructor(quadIndex: number)
    {
        super();
        this.quadIndex = quadIndex;
    }

    encode(bufferState: BufferState)
    {
        new EncodableRaw2ByteNumber(this.quadIndex).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const quadIndex = (EncodableRaw2ByteNumber.decode(bufferState) as EncodableRaw2ByteNumber).n;
        return new RemoveVoxelBlockParams(quadIndex);
    }
}