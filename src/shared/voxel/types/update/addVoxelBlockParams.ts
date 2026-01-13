import BufferState from "../../../networking/types/bufferState";
import EncodableData from "../../../networking/types/encodableData";
import EncodableRaw2ByteNumber from "../../../networking/types/encodableRaw2ByteNumber";
import EncodableRawByteNumber from "../../../networking/types/encodableRawByteNumber";
import { NUM_VOXEL_QUADS_PER_COLLISION_LAYER, VOXEL_GRID_TASK_TYPE_ADD } from "../../../system/constants";
import UpdateVoxelGridTaskParams from "./updateVoxelGridTaskParams";

export default class AddVoxelBlockParams extends UpdateVoxelGridTaskParams
{
    quadIndex: number;
    /*xShrink: boolean;
    zShrink: boolean;*/
    quadTextureIndicesWithinLayer: number[];

    constructor(quadIndex: number, /*xShrink: boolean, zShrink: boolean,*/ quadTextureIndicesWithinLayer: number[])
    {
        super(VOXEL_GRID_TASK_TYPE_ADD);
        this.quadIndex = quadIndex;
        /*this.xShrink = xShrink;
        this.zShrink = zShrink;*/
        this.quadTextureIndicesWithinLayer = quadTextureIndicesWithinLayer;
    }

    encode(bufferState: BufferState)
    {
        new EncodableRaw2ByteNumber(this.quadIndex).encode(bufferState);
        
        /*bufferState.view[bufferState.byteIndex++] = (this.xShrink ? 0b10 : 0) | (this.zShrink ? 1 : 0);*/

        for (let i = 0; i < NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
            new EncodableRawByteNumber(this.quadTextureIndicesWithinLayer[i]).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const quadIndex = (EncodableRaw2ByteNumber.decode(bufferState) as EncodableRaw2ByteNumber).n;

        /*const shrinkByte = bufferState.view[bufferState.byteIndex++];
        const xShrink = (shrinkByte & 0b10) != 0;
        const zShrink = (shrinkByte & 1) != 0;*/

        const quadTextureIndicesWithinLayer = new Array<number>(NUM_VOXEL_QUADS_PER_COLLISION_LAYER);
        for (let i = 0; i < NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
            quadTextureIndicesWithinLayer[i] = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;

        return new AddVoxelBlockParams(quadIndex, /*xShrink, zShrink,*/ quadTextureIndicesWithinLayer);
    }
}