import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableRawByteNumber from "../../networking/types/encodableRawByteNumber";

export default class VoxelCubeChangeYParams extends EncodableData
{
    row: number;
    col: number;
    yCenter: number;
    moveUp: boolean;

    constructor(row: number, col: number, yCenter: number, moveUp: boolean)
    {
        super();
        this.row = row;
        this.col = col;
        this.yCenter = yCenter;
        this.moveUp = moveUp;
    }

    encode(bufferState: BufferState)
    {
        new EncodableRawByteNumber(this.row).encode(bufferState);
        new EncodableRawByteNumber(this.col).encode(bufferState);
        new EncodableRawByteNumber(this.yCenter * 2).encode(bufferState);
        new EncodableRawByteNumber(this.moveUp ? 1 : 0).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const row = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        const col = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        const yCenter = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n * 0.5;
        const moveUp = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n == 0 ? false : true;
        return new VoxelCubeChangeYParams(row, col, yCenter, moveUp);
    }
}