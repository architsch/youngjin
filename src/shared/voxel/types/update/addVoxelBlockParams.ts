import BufferState from "../../../networking/types/bufferState";
import EncodableData from "../../../networking/types/encodableData";
import EncodableRaw2ByteNumber from "../../../networking/types/encodableRaw2ByteNumber";
import EncodableRawByteNumber from "../../../networking/types/encodableRawByteNumber";
import { NUM_VOXEL_QUADS_PER_COLLISION_LAYER, VOXEL_GRID_TASK_TYPE_ADD } from "../../../system/sharedConstants";
import UpdateVoxelGridTaskParams from "./updateVoxelGridTaskParams";

export default class AddVoxelBlockParams extends UpdateVoxelGridTaskParams
{
    quadIndex: number;
    quadTextureIndicesWithinLayer: number[];

    constructor(quadIndex: number, quadTextureIndicesWithinLayer: number[])
    {
        super(VOXEL_GRID_TASK_TYPE_ADD);
        this.quadIndex = quadIndex;
        this.quadTextureIndicesWithinLayer = quadTextureIndicesWithinLayer;
    }

    encode(bufferState: BufferState)
    {
        new EncodableRaw2ByteNumber(this.quadIndex).encode(bufferState);

        for (let i = 0; i < NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
            new EncodableRawByteNumber(this.quadTextureIndicesWithinLayer[i]).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const quadIndex = (EncodableRaw2ByteNumber.decode(bufferState) as EncodableRaw2ByteNumber).n;

        const quadTextureIndicesWithinLayer = new Array<number>(NUM_VOXEL_QUADS_PER_COLLISION_LAYER);
        for (let i = 0; i < NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
            quadTextureIndicesWithinLayer[i] = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;

        return new AddVoxelBlockParams(quadIndex, quadTextureIndicesWithinLayer);
    }
}