import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableByteString from "../../networking/types/encodableByteString";
import EncodableRawByteNumber from "../../networking/types/encodableRawByteNumber";

export default class SetObjectMetadataSignal extends EncodableData
{
    roomID: string;
    objectId: string;
    metadataKey: number;
    metadataValue: string;

    constructor(roomID: string, objectId: string, metadataKey: number, metadataValue: string)
    {
        super();
        this.roomID = roomID;
        this.objectId = objectId;
        this.metadataKey = metadataKey;
        this.metadataValue = metadataValue;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.roomID).encode(bufferState);
        new EncodableByteString(this.objectId).encode(bufferState);
        new EncodableRawByteNumber(this.metadataKey).encode(bufferState);
        new EncodableByteString(this.metadataValue).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const roomID = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const objectId = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const metadataKey = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        const metadataValue = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        return new SetObjectMetadataSignal(roomID, objectId, metadataKey, metadataValue);
    }
}
