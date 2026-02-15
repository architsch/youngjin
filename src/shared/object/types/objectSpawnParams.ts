import ObjectTransform from "./objectTransform";
import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableByteString from "../../networking/types/encodableByteString";
import EncodableRawByteNumber from "../../networking/types/encodableRawByteNumber";
import { ObjectMetadata } from "./objectMetadata";
import EncodableMap from "../../networking/types/encodableMap";
import { ObjectMetadataKey } from "./objectMetadataKey";

export default class ObjectSpawnParams extends EncodableData
{
    sourceUserID: string;
    objectTypeIndex: number;
    objectId: string;
    transform: ObjectTransform;
    metadata: ObjectMetadata;

    constructor(sourceUserID: string, objectTypeIndex: number, objectId: string,
        transform: ObjectTransform, metadata: ObjectMetadata = {})
    {
        super();
        this.sourceUserID = sourceUserID;
        this.objectTypeIndex = objectTypeIndex;
        this.objectId = objectId;
        this.transform = transform;
        this.metadata = metadata;
    }

    getMetadata(key: ObjectMetadataKey): string
    {
        if (this.metadata[key] == undefined)
        {
            console.error(`Object metadata key '${key}' doesn't exist.`);
            return "";
        }
        return this.metadata[key].str;
    }

    hasMetadata(key: ObjectMetadataKey): boolean
    {
        return this.metadata[key] != undefined;
    }

    setMetadata(key: ObjectMetadataKey, value: string)
    {
        this.metadata[key] = new EncodableByteString(value);
    }

    deleteMetadata(key: ObjectMetadataKey)
    {
        if (this.metadata[key] == undefined)
            console.warn(`Object metadata key '${key}' doesn't exist.`);
        else
            delete this.metadata[key];
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.sourceUserID).encode(bufferState);
        new EncodableRawByteNumber(this.objectTypeIndex).encode(bufferState);
        new EncodableByteString(this.objectId).encode(bufferState);
        this.transform.encode(bufferState);
        new EncodableMap(this.metadata).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const sourceUserID = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const objectTypeIndex = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        const objectId = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const transform = ObjectTransform.decode(bufferState) as ObjectTransform;
        const metadata = (EncodableMap.decodeWithParams(bufferState, EncodableByteString.decode) as EncodableMap).map as ObjectMetadata;
        return new ObjectSpawnParams(sourceUserID, objectTypeIndex, objectId, transform, metadata);
    }
}