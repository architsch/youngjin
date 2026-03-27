import ObjectTransform from "./objectTransform";
import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableByteString from "../../networking/types/encodableByteString";
import EncodableRawByteNumber from "../../networking/types/encodableRawByteNumber";
import { ObjectMetadata } from "./objectMetadata";
import EncodableMap from "../../networking/types/encodableMap";

export default class AddObjectSignal extends EncodableData
{
    roomID: string;
    sourceUserID: string;
    sourceUserName: string;
    objectTypeIndex: number;
    objectId: string;
    transform: ObjectTransform;
    metadata: ObjectMetadata;

    constructor(roomID: string, sourceUserID: string, sourceUserName: string, objectTypeIndex: number, objectId: string,
        transform: ObjectTransform, metadata: ObjectMetadata = {})
    {
        super();
        this.roomID = roomID;
        this.sourceUserID = sourceUserID;
        this.sourceUserName = sourceUserName;
        this.objectTypeIndex = objectTypeIndex;
        this.objectId = objectId;
        this.transform = transform;
        this.metadata = metadata;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.roomID).encode(bufferState);
        new EncodableByteString(this.sourceUserID).encode(bufferState);
        new EncodableByteString(this.sourceUserName).encode(bufferState);
        new EncodableRawByteNumber(this.objectTypeIndex).encode(bufferState);
        new EncodableByteString(this.objectId).encode(bufferState);
        this.transform.encode(bufferState);
        new EncodableMap(this.metadata).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const roomID = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const sourceUserID = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const sourceUserName = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const objectTypeIndex = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        const objectId = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const transform = ObjectTransform.decode(bufferState) as ObjectTransform;
        const metadata = (EncodableMap.decodeWithParams(bufferState, EncodableByteString.decode) as EncodableMap).map as ObjectMetadata;
        return new AddObjectSignal(roomID, sourceUserID, sourceUserName, objectTypeIndex, objectId, transform, metadata);
    }
}