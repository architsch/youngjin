import BufferState from "../../../networking/types/bufferState";
import EncodableByteString from "../../../networking/types/encodableByteString";
import EncodableData from "../../../networking/types/encodableData";
import EncodableRaw4ByteNumber from "../../../networking/types/encodableRaw4ByteNumber";
import EncodableRawSignedByteNumber from "../../../networking/types/encodableRawSignedByteNumber";

export default class MoveVoxelBlockSignal extends EncodableData
{
    roomID: string;
    quadIndex: number;
    rowOffset: number;
    colOffset: number;
    collisionLayerOffset: number;

    constructor(roomID: string, quadIndex: number,
        rowOffset: number, colOffset: number, collisionLayerOffset: number)
    {
        super();
        this.roomID = roomID;
        this.quadIndex = quadIndex;
        this.rowOffset = rowOffset;
        this.colOffset = colOffset;
        this.collisionLayerOffset = collisionLayerOffset;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.roomID).encode(bufferState);
        new EncodableRaw4ByteNumber(this.quadIndex).encode(bufferState);
        new EncodableRawSignedByteNumber(this.rowOffset).encode(bufferState);
        new EncodableRawSignedByteNumber(this.colOffset).encode(bufferState);
        new EncodableRawSignedByteNumber(this.collisionLayerOffset).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const roomID = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const quadIndex = (EncodableRaw4ByteNumber.decode(bufferState) as EncodableRaw4ByteNumber).n;
        const rowOffset = (EncodableRawSignedByteNumber.decode(bufferState) as EncodableRawSignedByteNumber).n;
        const colOffset = (EncodableRawSignedByteNumber.decode(bufferState) as EncodableRawSignedByteNumber).n;
        const collisionLayerOffset = (EncodableRawSignedByteNumber.decode(bufferState) as EncodableRawSignedByteNumber).n;
        return new MoveVoxelBlockSignal(roomID, quadIndex, rowOffset, colOffset, collisionLayerOffset);
    }
}
