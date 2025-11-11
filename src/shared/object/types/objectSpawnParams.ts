import ObjectTransform from "./objectTransform";
import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableByteString from "../../networking/types/encodableByteString";
import EncodableRawByteNumber from "../../networking/types/encodableRawByteNumber";

export default class ObjectSpawnParams extends EncodableData
{
    sourceUserName: string;
    objectTypeIndex: number;
    objectId: string;
    transform: ObjectTransform;
    metadata: string;

    constructor(sourceUserName: string, objectTypeIndex: number, objectId: string,
        transform: ObjectTransform, metadata: string)
    {
        super();
        this.sourceUserName = sourceUserName;
        this.objectTypeIndex = objectTypeIndex;
        this.objectId = objectId;
        this.transform = transform;
        this.metadata = metadata;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.sourceUserName).encode(bufferState);
        new EncodableRawByteNumber(this.objectTypeIndex).encode(bufferState);
        new EncodableByteString(this.objectId).encode(bufferState);
        this.transform.encode(bufferState);
        new EncodableByteString(this.metadata).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const sourceUserName = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const objectTypeIndex = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        const objectId = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const transform = ObjectTransform.decode(bufferState) as ObjectTransform;
        const metadata = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        return new ObjectSpawnParams(sourceUserName, objectTypeIndex, objectId, transform, metadata);
    }
}