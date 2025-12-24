import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableRawByteNumber from "../../networking/types/encodableRawByteNumber";

export default class VoxelCubeAddParams extends EncodableData
{
    row: number;
    col: number;
    yCenter: number;
    textureIndex: number;

    constructor(row: number, col: number, yCenter: number, textureIndex: number)
    {
        super();
        this.row = row;
        this.col = col;
        this.yCenter = yCenter;
        this.textureIndex = textureIndex;
    }

    encode(bufferState: BufferState)
    {
        new EncodableRawByteNumber(this.row).encode(bufferState);
        new EncodableRawByteNumber(this.col).encode(bufferState);

        // 3 bits for yCenter (i.e. cube's center position)
        // (000 => 0.0, 001 => 0.5, 010 => 1.0, 011 => 1.5, 100 => 2.0, 101 => 2.5, 110 => 3.0, 111 => 3.5)
        bufferState.view[bufferState.byteIndex++] = (Math.round(this.yCenter * 2) & 0b111);

        new EncodableRawByteNumber(this.textureIndex).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const row = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        const col = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;

        // 3 bits for yCenter (i.e. cube's center position)
        // (000 => 0.0, 001 => 0.5, 010 => 1.0, 011 => 1.5, 100 => 2.0, 101 => 2.5, 110 => 3.0, 111 => 3.5)
        const yCenter = bufferState.view[bufferState.byteIndex++] * 0.5;

        const textureIndex = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        return new VoxelCubeAddParams(row, col, yCenter, textureIndex);
    }
}