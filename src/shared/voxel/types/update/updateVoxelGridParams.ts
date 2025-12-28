import BufferState from "../../../networking/types/bufferState";
import EncodableArray from "../../../networking/types/encodableArray";
import EncodableData from "../../../networking/types/encodableData";
import AddVoxelBlockParams from "./addVoxelBlockParams";
import MoveVoxelBlockParams from "./moveVoxelBlockParams";
import RemoveVoxelBlockParams from "./removeVoxelBlockParams";
import SetVoxelQuadTextureParams from "./setVoxelQuadTextureParams";

export default class UpdateVoxelGridParams extends EncodableData
{
    moveVoxelBlockTasks: MoveVoxelBlockParams[];
    addVoxelBlockTasks: AddVoxelBlockParams[];
    removeVoxelBlockTasks: RemoveVoxelBlockParams[];
    setVoxelQuadTextureTasks: SetVoxelQuadTextureParams[];

    constructor(moveVoxelBlockTasks: MoveVoxelBlockParams[],
        addVoxelBlockTasks: AddVoxelBlockParams[],
        removeVoxelBlockTasks: RemoveVoxelBlockParams[],
        setVoxelQuadTextureTasks: SetVoxelQuadTextureParams[])
    {
        super();
        this.moveVoxelBlockTasks = moveVoxelBlockTasks;
        this.addVoxelBlockTasks = addVoxelBlockTasks;
        this.removeVoxelBlockTasks = removeVoxelBlockTasks;
        this.setVoxelQuadTextureTasks = setVoxelQuadTextureTasks;
    }

    encode(bufferState: BufferState)
    {
        new EncodableArray(this.moveVoxelBlockTasks, 256).encode(bufferState);
        new EncodableArray(this.moveVoxelBlockTasks, 256).encode(bufferState);
        new EncodableArray(this.moveVoxelBlockTasks, 256).encode(bufferState);
        new EncodableArray(this.moveVoxelBlockTasks, 256).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const moveVoxelBlockTasks = (EncodableArray.decodeWithParams(bufferState, MoveVoxelBlockParams.decode, 256) as EncodableArray).arr as MoveVoxelBlockParams[];
        const addVoxelBlockTasks = (EncodableArray.decodeWithParams(bufferState, AddVoxelBlockParams.decode, 256) as EncodableArray).arr as AddVoxelBlockParams[];
        const removeVoxelBlockTasks = (EncodableArray.decodeWithParams(bufferState, RemoveVoxelBlockParams.decode, 256) as EncodableArray).arr as RemoveVoxelBlockParams[];
        const setVoxelQuadTextureTasks = (EncodableArray.decodeWithParams(bufferState, SetVoxelQuadTextureParams.decode, 256) as EncodableArray).arr as SetVoxelQuadTextureParams[];
        return new UpdateVoxelGridParams(
            moveVoxelBlockTasks,
            addVoxelBlockTasks,
            removeVoxelBlockTasks,
            setVoxelQuadTextureTasks
        );
    }
}