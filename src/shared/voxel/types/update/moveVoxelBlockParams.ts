import BufferState from "../../../networking/types/bufferState";
import EncodableData from "../../../networking/types/encodableData";
import EncodableRawByteNumber from "../../../networking/types/encodableRawByteNumber";
import VoxelBlockIdentifiers from "../voxelBlockIdentifiers";

export default class MoveVoxelBlockParams extends EncodableData
{
    voxelBlockIdentifiers: VoxelBlockIdentifiers;
    rowOffset: number;
    colOffset: number;
    collisionLayerOffset: number;

    constructor(voxelBlockIdentifiers: VoxelBlockIdentifiers,
        rowOffset: number, colOffset: number, collisionLayerOffset: number)
    {
        super();
        this.voxelBlockIdentifiers = voxelBlockIdentifiers;
        this.rowOffset = rowOffset;
        this.colOffset = colOffset;
        this.collisionLayerOffset = collisionLayerOffset;
    }

    encode(bufferState: BufferState)
    {
        this.voxelBlockIdentifiers.encode(bufferState);
        new EncodableRawByteNumber(this.rowOffset).encode(bufferState);
        new EncodableRawByteNumber(this.colOffset).encode(bufferState);
        new EncodableRawByteNumber(this.collisionLayerOffset).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const voxelBlockIdentifiers = (VoxelBlockIdentifiers.decode(bufferState) as VoxelBlockIdentifiers);
        const rowOffset = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        const colOffset = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        const collisionLayerOffset = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        return new MoveVoxelBlockParams(voxelBlockIdentifiers, rowOffset, colOffset, collisionLayerOffset);
    }
}