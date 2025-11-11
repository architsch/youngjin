import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableByteString from "../../networking/types/encodableByteString";

export default class ObjectDespawnParams extends EncodableData
{
    objectId: string;

    constructor(objectId: string)
    {
        super();
        this.objectId = objectId;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.objectId).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const objectId = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        return new ObjectDespawnParams(objectId);
    }
}