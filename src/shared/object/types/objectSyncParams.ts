import ObjectTransform from "./objectTransform";
import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableByteString from "../../networking/types/encodableByteString";

export default class ObjectSyncParams extends EncodableData
{
    objectId: string;
    transform: ObjectTransform;

    constructor(objectId: string, transform: ObjectTransform)
    {
        super();
        this.objectId = objectId;
        this.transform = transform;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.objectId).encode(bufferState);
        this.transform.encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const objectId = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const transform = ObjectTransform.decode(bufferState) as ObjectTransform;
        return new ObjectSyncParams(objectId, transform);
    }
}