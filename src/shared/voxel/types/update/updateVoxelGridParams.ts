import BufferState from "../../../networking/types/bufferState";
import EncodableByteString from "../../../networking/types/encodableByteString";
import EncodableData from "../../../networking/types/encodableData";
import EncodableRawByteNumber from "../../../networking/types/encodableRawByteNumber";
import { VOXEL_GRID_TASK_TYPE_ADD, VOXEL_GRID_TASK_TYPE_MOVE, VOXEL_GRID_TASK_TYPE_REMOVE, VOXEL_GRID_TASK_TYPE_TEX } from "../../../system/sharedConstants";
import AddVoxelBlockParams from "./addVoxelBlockParams";
import MoveVoxelBlockParams from "./moveVoxelBlockParams";
import RemoveVoxelBlockParams from "./removeVoxelBlockParams";
import SetVoxelQuadTextureParams from "./setVoxelQuadTextureParams";
import UpdateVoxelGridTaskParams from "./updateVoxelGridTaskParams";

export default class UpdateVoxelGridParams extends EncodableData
{
    roomID: string;
    tasks: UpdateVoxelGridTaskParams[];

    constructor(roomID: string, tasks: UpdateVoxelGridTaskParams[])
    {
        super();
        this.roomID = roomID;
        this.tasks = tasks;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.roomID).encode(bufferState);

        for (const task of this.tasks)
        {
            new EncodableRawByteNumber(task.type).encode(bufferState);
            task.encode(bufferState);
        }
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const roomID = (EncodableByteString.decode(bufferState) as EncodableByteString).str;

        const tasks: UpdateVoxelGridTaskParams[] = [];
        while (bufferState.byteIndex < bufferState.view.byteLength)
        {
            const taskType = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
            
            switch (taskType)
            {
                case VOXEL_GRID_TASK_TYPE_MOVE:
                    tasks.push(MoveVoxelBlockParams.decode(bufferState) as MoveVoxelBlockParams);
                    break;
                case VOXEL_GRID_TASK_TYPE_ADD:
                    tasks.push(AddVoxelBlockParams.decode(bufferState) as AddVoxelBlockParams);
                    break;
                case VOXEL_GRID_TASK_TYPE_REMOVE:
                    tasks.push(RemoveVoxelBlockParams.decode(bufferState) as RemoveVoxelBlockParams);
                    break;
                case VOXEL_GRID_TASK_TYPE_TEX:
                    tasks.push(SetVoxelQuadTextureParams.decode(bufferState) as SetVoxelQuadTextureParams);
                    break;
                default:
                    console.error(`Unknown task type :: ${taskType}`);
                    break;
            }
        }
        return new UpdateVoxelGridParams(roomID, tasks);
    }
}