import BufferState from "../../../networking/types/bufferState";
import EncodableData from "../../../networking/types/encodableData";
import VoxelBlockIdentifiers from "../voxelBlockIdentifiers";

export default class RemoveVoxelBlockParams extends EncodableData
{
    voxelBlockIdentifiers: VoxelBlockIdentifiers;

    constructor(voxelBlockIdentifiers: VoxelBlockIdentifiers)
    {
        super();
        this.voxelBlockIdentifiers = voxelBlockIdentifiers;
    }

    encode(bufferState: BufferState)
    {
        this.voxelBlockIdentifiers.encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const voxelBlockIdentifiers = (VoxelBlockIdentifiers.decode(bufferState) as VoxelBlockIdentifiers);
        return new RemoveVoxelBlockParams(voxelBlockIdentifiers);
    }
}