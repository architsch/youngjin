import BufferState from "../../../networking/types/bufferState";
import EncodableData from "../../../networking/types/encodableData";
import EncodableRaw2ByteNumber from "../../../networking/types/encodableRaw2ByteNumber";
import EncodableRawSignedByteNumber from "../../../networking/types/encodableRawSignedByteNumber";
import { VOXEL_GRID_TASK_TYPE_MOVE } from "../../../system/constants";
import UpdateVoxelGridTaskParams from "./updateVoxelGridTaskParams";

export default class MoveVoxelBlockParams extends UpdateVoxelGridTaskParams
{
    quadIndex: number;
    rowOffset: number;
    colOffset: number;
    collisionLayerOffset: number;

    constructor(quadIndex: number,
        rowOffset: number, colOffset: number, collisionLayerOffset: number)
    {
        super(VOXEL_GRID_TASK_TYPE_MOVE);
        this.quadIndex = quadIndex;
        this.rowOffset = rowOffset;
        this.colOffset = colOffset;
        this.collisionLayerOffset = collisionLayerOffset;
    }

    encode(bufferState: BufferState)
    {
        new EncodableRaw2ByteNumber(this.quadIndex).encode(bufferState);
        new EncodableRawSignedByteNumber(this.rowOffset).encode(bufferState);
        new EncodableRawSignedByteNumber(this.colOffset).encode(bufferState);
        new EncodableRawSignedByteNumber(this.collisionLayerOffset).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const quadIndex = (EncodableRaw2ByteNumber.decode(bufferState) as EncodableRaw2ByteNumber).n;
        const rowOffset = (EncodableRawSignedByteNumber.decode(bufferState) as EncodableRawSignedByteNumber).n;
        const colOffset = (EncodableRawSignedByteNumber.decode(bufferState) as EncodableRawSignedByteNumber).n;
        const collisionLayerOffset = (EncodableRawSignedByteNumber.decode(bufferState) as EncodableRawSignedByteNumber).n;
        return new MoveVoxelBlockParams(quadIndex, rowOffset, colOffset, collisionLayerOffset);
    }
}