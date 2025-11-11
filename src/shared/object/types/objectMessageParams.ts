import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableByteString from "../../networking/types/encodableByteString";

export default class ObjectMessageParams extends EncodableData
{
    senderObjectId: string;
    message: string;

    constructor(senderObjectId: string, message: string)
    {
        super();
        this.senderObjectId = senderObjectId;
        this.message = message;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.senderObjectId).encode(bufferState);
        new EncodableByteString(this.message).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const senderObjectId = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const message = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        return new ObjectMessageParams(senderObjectId, message);
    }
}