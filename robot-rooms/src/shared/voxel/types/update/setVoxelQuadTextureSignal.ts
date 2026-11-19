import BufferState from "../../../networking/types/bufferState";
import EncodableByteString from "../../../networking/types/encodableByteString";
import EncodableData from "../../../networking/types/encodableData";
import EncodableRaw4ByteNumber from "../../../networking/types/encodableRaw4ByteNumber";
import EncodableRawByteNumber from "../../../networking/types/encodableRawByteNumber";

export default class SetVoxelQuadTextureSignal extends EncodableData
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
        new EncodableRaw4ByteNumber(this.quadIndex).encode(bufferState);
        new EncodableRawByteNumber(this.textureIndex).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const roomID = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const quadIndex = (EncodableRaw4ByteNumber.decode(bufferState) as EncodableRaw4ByteNumber).n;
        const textureIndex = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        return new SetVoxelQuadTextureSignal(roomID, quadIndex, textureIndex);
    }
}
