import EncodableData from "../../../shared/networking/types/encodableData";
import Room from "../../../shared/room/types/room";
import { PERSISTENT_OBJ_TASK_TYPE_ADD, PERSISTENT_OBJ_TASK_TYPE_MOVE, PERSISTENT_OBJ_TASK_TYPE_REMOVE, PERSISTENT_OBJ_TASK_TYPE_SET_METADATA } from "../../../shared/system/sharedConstants";
import AddPersistentObjectParams from "../../../shared/object/types/update/addPersistentObjectParams";
import MovePersistentObjectParams from "../../../shared/object/types/update/movePersistentObjectParams";
import RemovePersistentObjectParams from "../../../shared/object/types/update/removePersistentObjectParams";
import SetPersistentObjectMetadataParams from "../../../shared/object/types/update/setPersistentObjectMetadataParams";
import UpdatePersistentObjectGroupParams from "../../../shared/object/types/update/updatePersistentObjectGroupParams";
import UpdatePersistentObjectGroupTaskParams from "../../../shared/object/types/update/updatePersistentObjectGroupTaskParams";
import PersistentObjectUpdateUtil from "../../../shared/object/util/persistentObjectUpdateUtil";
import EncodableByteString from "../../../shared/networking/types/encodableByteString";
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
            // Send the params back with empty objectId so the client clears its pending state.
            unicastToSender(socketUserContext, room, [params]);
            return;
        }
    }

    const po = PersistentObjectUpdateUtil.addPersistentObject(room, params.objectTypeIndex,
        params.dir, params.x, params.y, params.z, params.metadata);
    if (!po)
    {
        console.error(`PersistentObject update failed (addPersistentObjectTask) - params: ${JSON.stringify(params)}`);
        unicastToSender(socketUserContext, room, [params]);
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

    // Capture the object state before attempting removal, for potential recovery.
    const existingPO = room.persistentObjectGroup.persistentObjectById[params.objectId];

    const removed = PersistentObjectUpdateUtil.removePersistentObject(room, params.objectId);
    if (!removed)
    {
        console.error(`PersistentObject update failed (removePersistentObjectTask) - params: ${JSON.stringify(params)}`);
        if (existingPO)
        {
            // Re-add the object on the client (which optimistically removed it).
            unicastToSender(socketUserContext, room, [
                new AddPersistentObjectParams(existingPO.objectTypeIndex, existingPO.dir,
                    existingPO.x, existingPO.y, existingPO.z, existingPO.metadata, existingPO.objectId),
            ]);
        }
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

    // Capture position before attempting move, for potential recovery.
    const existingPO = room.persistentObjectGroup.persistentObjectById[params.objectId];
    const prevX = existingPO?.x;
    const prevY = existingPO?.y;
    const prevZ = existingPO?.z;
    const prevDir = existingPO?.dir;

    const po = PersistentObjectUpdateUtil.movePersistentObject(room, params.objectId, params.dx, params.dy, params.dz);
    if (!po)
    {
        console.error(`PersistentObject update failed (movePersistentObjectTask) - params: ${JSON.stringify(params)}`);
        if (existingPO && prevDir)
        {
            // Client optimistically moved the object. Send REMOVE + ADD to restore it at the server's position.
            unicastToSender(socketUserContext, room, [
                new RemovePersistentObjectParams(params.objectId),
                new AddPersistentObjectParams(existingPO.objectTypeIndex, prevDir,
                    prevX!, prevY!, prevZ!, existingPO.metadata, existingPO.objectId),
            ]);
        }
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

    // Capture old metadata value before attempting change, for potential recovery.
    const existingPO = room.persistentObjectGroup.persistentObjectById[params.objectId];
    const oldValue = existingPO?.metadata[params.metadataKey];

    const po = PersistentObjectUpdateUtil.setPersistentObjectMetadata(room, params.objectId, params.metadataKey, params.metadataValue);
    if (!po)
    {
        console.error(`PersistentObject update failed (setPersistentObjectMetadataTask) - params: ${JSON.stringify(params)}`);
        if (existingPO)
        {
            // Restore the old metadata value on the client.
            const oldStr = oldValue instanceof EncodableByteString ? oldValue.str : "";
            unicastToSender(socketUserContext, room, [
                new SetPersistentObjectMetadataParams(params.objectId, params.metadataKey, oldStr),
            ]);
        }
        return;
    }
    broadcast(socketUserContext, room, params);
}

function unicastToSender(socketUserContext: SocketUserContext, room: Room,
    tasks: UpdatePersistentObjectGroupTaskParams[])
{
    const success = socketUserContext.tryUpdateLatestPendingSignalToUser("updatePersistentObjectGroupParams", (existingSignal: EncodableData) => {
        const updateParams = existingSignal as UpdatePersistentObjectGroupParams;
        for (const task of tasks)
            updateParams.tasks.push(task);
    });
    if (!success)
    {
        socketUserContext.addPendingSignalToUser("updatePersistentObjectGroupParams",
            new UpdatePersistentObjectGroupParams(room.id, tasks));
    }
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