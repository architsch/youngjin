import BufferState from "../../../networking/types/bufferState";
import EncodableData from "../../../networking/types/encodableData";
import EncodableByteString from "../../../networking/types/encodableByteString";
import EncodableRawByteNumber from "../../../networking/types/encodableRawByteNumber";
import { PERSISTENT_OBJ_TASK_TYPE_SET_METADATA } from "../../../system/sharedConstants";
import UpdatePersistentObjectGroupTaskParams from "./updatePersistentObjectGroupTaskParams";

export default class SetPersistentObjectMetadataParams extends UpdatePersistentObjectGroupTaskParams
{
    objectId: string;
    metadataKey: number;
    metadataValue: string;

    constructor(objectId: string, metadataKey: number, metadataValue: string)
    {
        super(PERSISTENT_OBJ_TASK_TYPE_SET_METADATA);
        this.objectId = objectId;
        this.metadataKey = metadataKey;
        this.metadataValue = metadataValue;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.objectId).encode(bufferState);
        new EncodableRawByteNumber(this.metadataKey).encode(bufferState);
        new EncodableByteString(this.metadataValue).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const objectId = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const metadataKey = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        const metadataValue = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        return new SetPersistentObjectMetadataParams(objectId, metadataKey, metadataValue);
    }
}
