import BufferState from "../../../networking/types/bufferState";
import EncodableData from "../../../networking/types/encodableData";
import EncodableRaw2ByteNumber from "../../../networking/types/encodableRaw2ByteNumber";
import EncodableRawByteNumber from "../../../networking/types/encodableRawByteNumber";

export default class AddVoxelBlockParams extends EncodableData
{
    quadIndex: number;
    quadTextureIndicesWithinLayer: number[];

    constructor(quadIndex: number, quadTextureIndicesWithinLayer: number[])
    {
        super();
        this.quadIndex = quadIndex;
        this.quadTextureIndicesWithinLayer = quadTextureIndicesWithinLayer;
    }

    encode(bufferState: BufferState)
    {
        new EncodableRaw2ByteNumber(this.quadIndex).encode(bufferState);
        new EncodableRawByteNumber(this.quadTextureIndicesWithinLayer.length).encode(bufferState);
        for (const index of this.quadTextureIndicesWithinLayer)
            new EncodableRawByteNumber(index).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const quadIndex = (EncodableRaw2ByteNumber.decode(bufferState) as EncodableRaw2ByteNumber).n;
        const numTextureIndices = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        const quadTextureIndicesWithinLayer = new Array<number>(numTextureIndices);
        for (let i = 0; i < numTextureIndices; ++i)
            quadTextureIndicesWithinLayer[i] = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;

        return new AddVoxelBlockParams(quadIndex, quadTextureIndicesWithinLayer);
    }
}