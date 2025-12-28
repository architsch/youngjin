import BufferState from "../../../networking/types/bufferState";
import EncodableData from "../../../networking/types/encodableData";
import EncodableRawByteNumber from "../../../networking/types/encodableRawByteNumber";
import VoxelQuadIdentifiers from "../voxelQuadIdentifiers";

export default class SetVoxelQuadTextureParams extends EncodableData
{
    voxelQuadIdentifiers: VoxelQuadIdentifiers;
    textureIndex: number;

    constructor(voxelQuadIdentifiers: VoxelQuadIdentifiers, textureIndex: number)
    {
        super();
        this.voxelQuadIdentifiers = voxelQuadIdentifiers;
        this.textureIndex = textureIndex;
    }

    encode(bufferState: BufferState)
    {
        this.voxelQuadIdentifiers.encode(bufferState);
        new EncodableRawByteNumber(this.textureIndex).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const voxelQuadIdentifiers = (VoxelQuadIdentifiers.decode(bufferState) as VoxelQuadIdentifiers);
        const textureIndex = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        return new SetVoxelQuadTextureParams(voxelQuadIdentifiers, textureIndex);
    }
}