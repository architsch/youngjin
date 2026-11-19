import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableByteString from "../../networking/types/encodableByteString";

export default class RoomTexturePackChangedSignal extends EncodableData
{
    roomID: string;
    texturePackPath: string;

    constructor(roomID: string, texturePackPath: string)
    {
        super();
        this.roomID = roomID;
        this.texturePackPath = texturePackPath;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.roomID).encode(bufferState);
        new EncodableByteString(this.texturePackPath).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const roomID = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const texturePackPath = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        return new RoomTexturePackChangedSignal(roomID, texturePackPath);
    }
}
