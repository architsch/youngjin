import EncodableData from "../../../shared/networking/types/encodableData";
import Room from "../../../shared/room/types/room";
import { PERSISTENT_OBJ_TASK_TYPE_ADD, PERSISTENT_OBJ_TASK_TYPE_MOVE, PERSISTENT_OBJ_TASK_TYPE_REMOVE, PERSISTENT_OBJ_TASK_TYPE_SET_METADATA } from "../../../shared/system/sharedConstants";
import AddPersistentObjectParams from "../../../shared/object/types/update/addPersistentObjectParams";
import MovePersistentObjectParams from "../../../shared/object/types/update/movePersistentObjectParams";
import RemovePersistentObjectParams from "../../../shared/object/types/update/removePersistentObjectParams";
import SetPersistentObjectMetadataParams from "../../../shared/object/types/update/setPersistentObjectMetadataParams";
import UpdatePersistentObjectGroupParams from "../../../shared/object/types/update/updatePersistentObjectGroupParams";
import UpdatePersistentObjectGroupTaskParams from "../../../shared/object/types/update/updatePersistentObjectGroupTaskParams";
import { addPersistentObject, movePersistentObject, removePersistentObject, setPersistentObjectMetadata } from "../../../shared/object/util/persistentObjectUpdateUtil";
import { MAX_CANVASES_PER_ROOM } from "../../../shared/system/sharedConstants";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import SocketUserContext from "../../sockets/types/socketUserContext";
import RoomManager from "../roomManager";
import { getRoom } from "./roomCoreUtil";

const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");

export function updatePersistentObjectGroup(socketUserContext: SocketUserContext, params: UpdatePersistentObjectGroupParams)
{
    for (const task of params.tasks)
    {
        switch (task.type)
        {
            case PERSISTENT_OBJ_TASK_TYPE_ADD:
                addPersistentObjectTask(socketUserContext, task as AddPersistentObjectParams);
                break;
            case PERSISTENT_OBJ_TASK_TYPE_REMOVE:
                removePersistentObjectTask(socketUserContext, task as RemovePersistentObjectParams);
                break;
            case PERSISTENT_OBJ_TASK_TYPE_MOVE:
                movePersistentObjectTask(socketUserContext, task as MovePersistentObjectParams);
                break;
            case PERSISTENT_OBJ_TASK_TYPE_SET_METADATA:
                setPersistentObjectMetadataTask(socketUserContext, task as SetPersistentObjectMetadataParams);
                break;
            default:
                console.error(`Unknown persistent object task type :: ${task.type}`);
                break;
        }
    }
}

function addPersistentObjectTask(socketUserContext: SocketUserContext, params: AddPersistentObjectParams)
{
    const room = getRoom(socketUserContext);
    if (!room)
    {
        console.error(`PersistentObject update failed (addPersistentObjectTask) - room not found`);
        return;
    }
    if (params.objectTypeIndex === canvasTypeIndex)
    {
        const canvasCount = Object.values(room.persistentObjectGroup.persistentObjectById)
            .filter(po => po.objectTypeIndex === canvasTypeIndex).length;
        if (canvasCount >= MAX_CANVASES_PER_ROOM)
        {
            console.error(`addPersistentObjectTask :: Canvas limit reached (${MAX_CANVASES_PER_ROOM}) in room ${room.id}`);
            return;
        }
    }

    const po = addPersistentObject(room, params.objectTypeIndex,
        params.getDirectionString(), params.x, params.y, params.z, params.metadata);
    if (!po)
    {
        console.error(`PersistentObject update failed (addPersistentObjectTask) - params: ${JSON.stringify(params)}`);
        return;
    }
    params.objectId = po.objectId;
    broadcastToAll(socketUserContext, room, params);
}

function removePersistentObjectTask(socketUserContext: SocketUserContext, params: RemovePersistentObjectParams)
{
    const room = getRoom(socketUserContext);
    if (!room)
    {
        console.error(`PersistentObject update failed (removePersistentObjectTask) - room not found`);
        return;
    }
    const removed = removePersistentObject(room, params.objectId);
    if (!removed)
    {
        console.error(`PersistentObject update failed (removePersistentObjectTask) - params: ${JSON.stringify(params)}`);
        return;
    }
    broadcast(socketUserContext, room, params);
}

function movePersistentObjectTask(socketUserContext: SocketUserContext, params: MovePersistentObjectParams)
{
    const room = getRoom(socketUserContext);
    if (!room)
    {
        console.error(`PersistentObject update failed (movePersistentObjectTask) - room not found`);
        return;
    }
    const po = movePersistentObject(room, params.objectId, params.dx, params.dy, params.dz);
    if (!po)
    {
        console.error(`PersistentObject update failed (movePersistentObjectTask) - params: ${JSON.stringify(params)}`);
        return;
    }
    broadcast(socketUserContext, room, params);
}

function setPersistentObjectMetadataTask(socketUserContext: SocketUserContext, params: SetPersistentObjectMetadataParams)
{
    const room = getRoom(socketUserContext);
    if (!room)
    {
        console.error(`PersistentObject update failed (setPersistentObjectMetadataTask) - room not found`);
        return;
    }
    const po = setPersistentObjectMetadata(room, params.objectId, params.metadataKey, params.metadataValue);
    if (!po)
    {
        console.error(`PersistentObject update failed (setPersistentObjectMetadataTask) - params: ${JSON.stringify(params)}`);
        return;
    }
    broadcast(socketUserContext, room, params);
}

function broadcast(socketUserContext: SocketUserContext, room: Room,
    signal: EncodableData)
{
    broadcastInternal(room, signal, socketUserContext.user.id);
}

function broadcastToAll(socketUserContext: SocketUserContext, room: Room,
    signal: EncodableData)
{
    broadcastInternal(room, signal, undefined);
}

function broadcastInternal(room: Room, signal: EncodableData, excludeUserId: string | undefined)
{
    room.dirty = true;

    const socketRoomContext = RoomManager.socketRoomContexts[room.id];
    if (!socketRoomContext)
        console.error(`SocketRoomContext not found (roomID = ${room.id})`);
    else
    {
        Object.entries(socketRoomContext.getUserContexts()).forEach((kvp: [string, SocketUserContext]) => {
            if (excludeUserId == undefined || excludeUserId != kvp[0])
            {
                const ctx = kvp[1];
                const success = ctx.tryUpdateLatestPendingSignalToUser("updatePersistentObjectGroupParams", (existingSignal: EncodableData) => {
                    const updateParams = existingSignal as UpdatePersistentObjectGroupParams;
                    updateParams.tasks.push(signal as UpdatePersistentObjectGroupTaskParams);
                });
                if (!success)
                {
                    ctx.addPendingSignalToUser("updatePersistentObjectGroupParams",
                        new UpdatePersistentObjectGroupParams(room.id, [signal as UpdatePersistentObjectGroupTaskParams]));
                }
            }
        });
    }
}