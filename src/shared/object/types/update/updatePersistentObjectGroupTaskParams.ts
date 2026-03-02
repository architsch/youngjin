import BufferState from "../../../networking/types/bufferState";
import EncodableData from "../../../networking/types/encodableData";

export default abstract class UpdatePersistentObjectGroupTaskParams extends EncodableData
{
    type: number;

    constructor(type: number)
    {
        super();
        this.type = type;
    }

    encode(bufferState: BufferState)
    {
        throw new Error("The 'encode' method in UpdatePersistentObjectGroupTaskParams must be overriden by a child class.");
    }

    static decode(bufferState: BufferState): EncodableData
    {
        throw new Error("The 'decode' method in UpdatePersistentObjectGroupTaskParams must be overriden by a child class.");
    }
}
