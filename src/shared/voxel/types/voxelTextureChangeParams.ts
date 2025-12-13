import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableRawByteNumber from "../../networking/types/encodableRawByteNumber";

export default class VoxelTextureChangeParams extends EncodableData
{
    row: number;
    col: number;
    quadIndex: number;
    textureIndex: number;

    constructor(row: number, col: number, quadIndex: number, textureIndex: number)
    {
        super();
        this.row = row;
        this.col = col;
        this.quadIndex = quadIndex;
        this.textureIndex = textureIndex;
    }

    encode(bufferState: BufferState)
    {
        new EncodableRawByteNumber(this.row).encode(bufferState);
        new EncodableRawByteNumber(this.col).encode(bufferState);
        new EncodableRawByteNumber(this.quadIndex).encode(bufferState);

        new EncodableRawByteNumber(this.textureIndex).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const row = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        const col = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        const quadIndex = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;

        const textureIndex = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        return new VoxelTextureChangeParams(row, col, quadIndex, textureIndex);
    }
}