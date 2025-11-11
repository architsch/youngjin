import ObjectSpawnParams from "./objectSpawnParams";
import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData"

export default class ObjectRuntimeMemory extends EncodableData
{
    objectSpawnParams: ObjectSpawnParams;

    constructor(objectSpawnParams: ObjectSpawnParams)
    {
        super();
        this.objectSpawnParams = objectSpawnParams;
    }

    encode(bufferState: BufferState)
    {
        this.objectSpawnParams.encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const objectSpawnParams = ObjectSpawnParams.decode(bufferState) as ObjectSpawnParams;
        return new ObjectRuntimeMemory(objectSpawnParams);
    }
}