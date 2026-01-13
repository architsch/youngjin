/*import BufferState from "../../../networking/types/bufferState";
import EncodableData from "../../../networking/types/encodableData";
import EncodableRaw2ByteNumber from "../../../networking/types/encodableRaw2ByteNumber";
import { VOXEL_GRID_TASK_TYPE_SHRINK_OR_EXPAND } from "../../../system/constants";
import UpdateVoxelGridTaskParams from "./updateVoxelGridTaskParams";

export default class ShrinkOrExpandVoxelBlockParams extends UpdateVoxelGridTaskParams
{
    quadIndex: number;

    constructor(quadIndex: number)
    {
        super(VOXEL_GRID_TASK_TYPE_SHRINK_OR_EXPAND);
        this.quadIndex = quadIndex;
    }

    encode(bufferState: BufferState)
    {
        new EncodableRaw2ByteNumber(this.quadIndex).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const quadIndex = (EncodableRaw2ByteNumber.decode(bufferState) as EncodableRaw2ByteNumber).n;
        return new ShrinkOrExpandVoxelBlockParams(quadIndex);
    }
}*/