import BufferState from "../../../networking/types/bufferState";
import EncodableData from "../../../networking/types/encodableData";

export default abstract class UpdateVoxelGridTaskParams extends EncodableData
{
    type: number;

    constructor(type: number)
    {
        super();
        this.type = type;
    }

    encode(bufferState: BufferState)
    {
        throw new Error("Thie 'encode' method in UpdateVoxelGridTaskParams must be overriden by a child class.");
    }

    static decode(bufferState: BufferState): EncodableData
    {
        throw new Error("Thie 'decode' method in UpdateVoxelGridTaskParams must be overriden by a child class.");
    }
}