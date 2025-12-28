import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableRawByteNumber from "../../networking/types/encodableRawByteNumber";

export default class VoxelQuadIdentifiers extends EncodableData
{
    row: number;
    col: number;
    quadIndex: number;

    constructor(row: number, col: number, quadIndex: number)
    {
        super();
        this.row = row;
        this.col = col;
        this.quadIndex = quadIndex;
    }

    encode(bufferState: BufferState)
    {
        new EncodableRawByteNumber(this.row).encode(bufferState);
        new EncodableRawByteNumber(this.col).encode(bufferState);
        new EncodableRawByteNumber(this.quadIndex).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const row = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        const col = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        const quadIndex = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;

        return new VoxelQuadIdentifiers(row, col, quadIndex);
    }
}