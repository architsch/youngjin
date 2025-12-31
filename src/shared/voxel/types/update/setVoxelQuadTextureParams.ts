import BufferState from "../../../networking/types/bufferState";
import EncodableData from "../../../networking/types/encodableData";
import EncodableRaw2ByteNumber from "../../../networking/types/encodableRaw2ByteNumber";
import EncodableRawByteNumber from "../../../networking/types/encodableRawByteNumber";

export default class SetVoxelQuadTextureParams extends EncodableData
{
    quadIndex: number;
    textureIndex: number;

    constructor(quadIndex: number, textureIndex: number)
    {
        super();
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