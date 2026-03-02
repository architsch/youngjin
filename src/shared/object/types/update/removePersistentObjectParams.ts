import BufferState from "../../../networking/types/bufferState";
import EncodableData from "../../../networking/types/encodableData";
import EncodableByteString from "../../../networking/types/encodableByteString";
import { PERSISTENT_OBJ_TASK_TYPE_REMOVE } from "../../../system/sharedConstants";
import UpdatePersistentObjectGroupTaskParams from "./updatePersistentObjectGroupTaskParams";

export default class RemovePersistentObjectParams extends UpdatePersistentObjectGroupTaskParams
{
    objectId: string;

    constructor(objectId: string)
    {
        super(PERSISTENT_OBJ_TASK_TYPE_REMOVE);
        this.objectId = objectId;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.objectId).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const objectId = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        return new RemovePersistentObjectParams(objectId);
    }
}
