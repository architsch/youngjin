import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableByteString from "../../networking/types/encodableByteString";

export default class UserCommandParams extends EncodableData
{
    message: string;

    constructor(message: string)
    {
        super();
        this.message = message;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.message).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const message = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        return new UserCommandParams(message);
    }
}