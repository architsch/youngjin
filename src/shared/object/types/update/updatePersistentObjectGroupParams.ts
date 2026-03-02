import BufferState from "../../../networking/types/bufferState";
import EncodableByteString from "../../../networking/types/encodableByteString";
import EncodableData from "../../../networking/types/encodableData";
import EncodableRawByteNumber from "../../../networking/types/encodableRawByteNumber";
import { PERSISTENT_OBJ_TASK_TYPE_ADD, PERSISTENT_OBJ_TASK_TYPE_MOVE, PERSISTENT_OBJ_TASK_TYPE_REMOVE, PERSISTENT_OBJ_TASK_TYPE_SET_METADATA } from "../../../system/sharedConstants";
import AddPersistentObjectParams from "./addPersistentObjectParams";
import MovePersistentObjectParams from "./movePersistentObjectParams";
import RemovePersistentObjectParams from "./removePersistentObjectParams";
import SetPersistentObjectMetadataParams from "./setPersistentObjectMetadataParams";
import UpdatePersistentObjectGroupTaskParams from "./updatePersistentObjectGroupTaskParams";

export default class UpdatePersistentObjectGroupParams extends EncodableData
{
    roomID: string;
    tasks: UpdatePersistentObjectGroupTaskParams[];

    constructor(roomID: string, tasks: UpdatePersistentObjectGroupTaskParams[])
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

        const tasks: UpdatePersistentObjectGroupTaskParams[] = [];
        while (bufferState.byteIndex < bufferState.view.byteLength)
        {
            const taskType = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;

            switch (taskType)
            {
                case PERSISTENT_OBJ_TASK_TYPE_ADD:
                    tasks.push(AddPersistentObjectParams.decode(bufferState) as AddPersistentObjectParams);
                    break;
                case PERSISTENT_OBJ_TASK_TYPE_REMOVE:
                    tasks.push(RemovePersistentObjectParams.decode(bufferState) as RemovePersistentObjectParams);
                    break;
                case PERSISTENT_OBJ_TASK_TYPE_MOVE:
                    tasks.push(MovePersistentObjectParams.decode(bufferState) as MovePersistentObjectParams);
                    break;
                case PERSISTENT_OBJ_TASK_TYPE_SET_METADATA:
                    tasks.push(SetPersistentObjectMetadataParams.decode(bufferState) as SetPersistentObjectMetadataParams);
                    break;
                default:
                    console.error(`Unknown persistent object task type :: ${taskType}`);
                    break;
            }
        }
        return new UpdatePersistentObjectGroupParams(roomID, tasks);
    }
}
