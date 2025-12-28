import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableRawByteNumber from "../../networking/types/encodableRawByteNumber";

export default class VoxelBlockIdentifiers extends EncodableData
{
    row: number;
    col: number;
    collisionLayer: number;

    constructor(row: number, col: number, collisionLayer: number)
    {
        super();
        this.row = row;
        this.col = col;
        this.collisionLayer = collisionLayer;
    }

    encode(bufferState: BufferState)
    {
        new EncodableRawByteNumber(this.row).encode(bufferState);
        new EncodableRawByteNumber(this.col).encode(bufferState);
        new EncodableRawByteNumber(this.collisionLayer).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const row = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        const col = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        const collisionLayer = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;

        return new VoxelBlockIdentifiers(row, col, collisionLayer);
    }
}