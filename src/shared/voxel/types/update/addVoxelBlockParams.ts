import BufferState from "../../../networking/types/bufferState";
import EncodableData from "../../../networking/types/encodableData";
import EncodableRawByteNumber from "../../../networking/types/encodableRawByteNumber";
import VoxelBlockIdentifiers from "../voxelBlockIdentifiers";

export default class AddVoxelBlockParams extends EncodableData
{
    voxelBlockIdentifiers: VoxelBlockIdentifiers;
    quadTextureIndicesWithinLayer: number[];

    constructor(voxelBlockIdentifiers: VoxelBlockIdentifiers, quadTextureIndicesWithinLayer: number[])
    {
        super();
        this.voxelBlockIdentifiers = voxelBlockIdentifiers;
        this.quadTextureIndicesWithinLayer = quadTextureIndicesWithinLayer;
    }

    encode(bufferState: BufferState)
    {
        this.voxelBlockIdentifiers.encode(bufferState);
        new EncodableRawByteNumber(this.quadTextureIndicesWithinLayer.length).encode(bufferState);
        for (const index of this.quadTextureIndicesWithinLayer)
            new EncodableRawByteNumber(index).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const voxelBlockIdentifiers = (VoxelBlockIdentifiers.decode(bufferState) as VoxelBlockIdentifiers);
        const numTextureIndices = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        const quadTextureIndicesWithinLayer = new Array<number>(numTextureIndices);
        for (let i = 0; i < numTextureIndices; ++i)
            quadTextureIndicesWithinLayer[i] = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;

        return new AddVoxelBlockParams(voxelBlockIdentifiers, quadTextureIndicesWithinLayer);
    }
}