import BufferState from "../../../networking/types/bufferState";
import EncodableData from "../../../networking/types/encodableData";
import EncodableRaw2ByteNumber from "../../../networking/types/encodableRaw2ByteNumber";
import EncodableRawByteNumber from "../../../networking/types/encodableRawByteNumber";
import { VOXEL_GRID_TASK_TYPE_TEX } from "../../../system/constants";
import UpdateVoxelGridTaskParams from "./updateVoxelGridTaskParams";

export default class SetVoxelQuadTextureParams extends UpdateVoxelGridTaskParams
{
    quadIndex: number;
    textureIndex: number;

    constructor(quadIndex: number, textureIndex: number)
    {
        super(VOXEL_GRID_TASK_TYPE_TEX);
        this.quadIndex = quadIndex;
        this.textureIndex = textureIndex;
    }

    encode(bufferState: BufferState)
    {
        new EncodableRaw2ByteNumber(this.quadIndex).encode(bufferState);
        new EncodableRawByteNumber(this.textureIndex).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const quadIndex = (EncodableRaw2ByteNumber.decode(bufferState) as EncodableRaw2ByteNumber).n;
        const textureIndex = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        return new SetVoxelQuadTextureParams(quadIndex, textureIndex);
    }
}