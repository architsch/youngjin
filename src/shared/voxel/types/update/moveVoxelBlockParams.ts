import BufferState from "../../../networking/types/bufferState";
import EncodableData from "../../../networking/types/encodableData";
import EncodableRaw2ByteNumber from "../../../networking/types/encodableRaw2ByteNumber";
import EncodableRawByteNumber from "../../../networking/types/encodableRawByteNumber";

export default class MoveVoxelBlockParams extends EncodableData
{
    quadIndex: number;
    rowOffset: number;
    colOffset: number;
    collisionLayerOffset: number;

    constructor(quadIndex: number,
        rowOffset: number, colOffset: number, collisionLayerOffset: number)
    {
        super();
        this.quadIndex = quadIndex;
        this.rowOffset = rowOffset;
        this.colOffset = colOffset;
        this.collisionLayerOffset = collisionLayerOffset;
    }

    encode(bufferState: BufferState)
    {
        new EncodableRaw2ByteNumber(this.quadIndex).encode(bufferState);
        new EncodableRawByteNumber(this.rowOffset).encode(bufferState);
        new EncodableRawByteNumber(this.colOffset).encode(bufferState);
        new EncodableRawByteNumber(this.collisionLayerOffset).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const quadIndex = (EncodableRaw2ByteNumber.decode(bufferState) as EncodableRaw2ByteNumber).n;
        const rowOffset = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        const colOffset = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        const collisionLayerOffset = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        return new MoveVoxelBlockParams(quadIndex, rowOffset, colOffset, collisionLayerOffset);
    }
}