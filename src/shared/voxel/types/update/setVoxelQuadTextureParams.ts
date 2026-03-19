import BufferState from "../../../networking/types/bufferState";
import EncodableByteString from "../../../networking/types/encodableByteString";
import EncodableData from "../../../networking/types/encodableData";
import EncodableRaw2ByteNumber from "../../../networking/types/encodableRaw2ByteNumber";
import EncodableRawByteNumber from "../../../networking/types/encodableRawByteNumber";

export default class SetVoxelQuadTextureParams extends EncodableData
{
    roomID: string;
    quadIndex: number;
    textureIndex: number;

    constructor(roomID: string, quadIndex: number, textureIndex: number)
    {
        super();
        this.roomID = roomID;
        this.quadIndex = quadIndex;
        this.textureIndex = textureIndex;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.roomID).encode(bufferState);
        new EncodableRaw2ByteNumber(this.quadIndex).encode(bufferState);
        new EncodableRawByteNumber(this.textureIndex).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const roomID = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const quadIndex = (EncodableRaw2ByteNumber.decode(bufferState) as EncodableRaw2ByteNumber).n;
        const textureIndex = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        return new SetVoxelQuadTextureParams(roomID, quadIndex, textureIndex);
    }
}
