import RemoveObjectSignal from "../../shared/object/types/removeObjectSignal";
import SetObjectMetadataSignal from "../../shared/object/types/setObjectMetadataSignal";
import AddObjectSignal from "../../shared/object/types/addObjectSignal";
import ObjectUpdateUtil from "../../shared/object/util/objectUpdateUtil";
import UserContext from "../sockets/types/userContext";
import ServerRoomManager from "../room/serverRoomManager";
import SetObjectTransformSignal from "../../shared/object/types/setObjectTransformSignal";
import ObjectTransform from "../../shared/object/types/objectTransform";
import { RoomTypeEnumMap } from "../../shared/room/types/roomType";
import Room from "../../shared/room/types/room";
import User from "../../shared/user/types/user";
import ObjectTypeConfigMap from "../../shared/object/maps/objectTypeConfigMap";
import Vector3DUtil from "../../shared/math/util/vector3DUtil";
import UserBudgetUtil from "../user/util/userBudgetUtil";

const playerTypeIndex = ObjectTypeConfigMap.getIndexByType("Player");

let nonPersistentObjectIdCounter = 0;

const ServerObjectManager =
{
    generateNonPersistentObjectId: (): string =>
    {
        return `@${++nonPersistentObjectIdCounter}`;
    },
    onAddObjectSignalReceived: (socketUserContext: UserContext, obj: AddObjectSignal): boolean =>
    {
        const user = socketUserContext.user;
        const roomID = ServerRoomManager.currentRoomIDByUserID[user.id];
        const roomRuntimeMemory = ServerRoomManager.roomRuntimeMemories[roomID];
        if (!roomRuntimeMemory) // Single-player users have no server-side room; their edits are client-side only and must never mutate the shared room.
        {
            console.error(`ServerObjectManager::onAddObjectSignalReceived :: No room registered for user (userID = ${user.id})`);
            return false;
        }
        const room = roomRuntimeMemory.room;

        if (!ObjectUpdateUtil.addObject(user, room, obj))
        {
            console.error(`onAddObjectSignalReceived :: Failed (objectId=${obj.objectId})`);
            ServerObjectManager.refuseAddObjectSignal(socketUserContext, obj);
            return false;
        }

        const socketRoomContext = ServerRoomManager.socketRoomContexts[roomID];
        socketRoomContext.multicastSignalFromUser("addObjectSignal", obj, socketUserContext);
        return true;
    },
    // A refused edit is answered with what the room really holds of the object, whatever refused it (the edit's own
    // checks, or the user's edit budget; see UserSignalDispatchUtil), since the sender has applied it already.
    refuseAddObjectSignal: (socketUserContext: UserContext, obj: AddObjectSignal) =>
    {
        const room = getRoomOf(socketUserContext);
        if (room)
            socketUserContext.addPendingSignalToUser("removeObjectSignal", new RemoveObjectSignal(room.id, obj.objectId));
    },
    onRemoveObjectSignalReceived: (socketUserContext: UserContext, signal: RemoveObjectSignal): boolean =>
    {
        const user = socketUserContext.user;
        const roomID = ServerRoomManager.currentRoomIDByUserID[user.id];
        const roomRuntimeMemory = ServerRoomManager.roomRuntimeMemories[roomID];
        if (!roomRuntimeMemory) // Single-player users have no server-side room; their edits are client-side only and must never mutate the shared room.
        {
            console.error(`ServerObjectManager::onRemoveObjectSignalReceived :: No room registered for user (userID = ${user.id})`);
            return false;
        }
        const room = roomRuntimeMemory.room;

        if (!ObjectUpdateUtil.removeObject(user, room, signal))
        {
            console.error(`onRemoveObjectSignalReceived :: Failed (userID = ${user.id})`);
            ServerObjectManager.refuseRemoveObjectSignal(socketUserContext, signal);
            return false;
        }

        const socketRoomContext = ServerRoomManager.socketRoomContexts[roomID];
        socketRoomContext.multicastSignalFromUser("removeObjectSignal", signal, socketUserContext);
        return true;
    },
    // Left out, a block it is attached to could be refused its removal ever after, with nobody told why.
    refuseRemoveObjectSignal: (socketUserContext: UserContext, signal: RemoveObjectSignal) =>
    {
        const obj = getRoomOf(socketUserContext)?.objectById[signal.objectId];
        if (obj)
            socketUserContext.addPendingSignalToUser("addObjectSignal", obj);
    },
    // The server's own adds and removes (a joining user's player, say), made for owner and announced to the
    // room except to userIDToExclude. Only these may add or remove what no user may (see
    // ObjectTypeConfig.canUserAddObject).
    addObjectAsServer: (room: Room, owner: User, obj: AddObjectSignal, userIDToExclude?: string): boolean =>
    {
        if (!ObjectUpdateUtil.canAddObject(owner, room, obj, true) || !ObjectUpdateUtil.addObject(owner, room, obj, false))
        {
            console.error(`ServerObjectManager::addObjectAsServer :: Failed (objectId=${obj.objectId})`);
            return false;
        }
        ServerRoomManager.socketRoomContexts[room.id].multicastSignal("addObjectSignal", obj, userIDToExclude);
        return true;
    },
    removeObjectAsServer: (room: Room, owner: User, signal: RemoveObjectSignal, userIDToExclude?: string): boolean =>
    {
        if (!ObjectUpdateUtil.canRemoveObject(owner, room, signal, true) ||
            !ObjectUpdateUtil.removeObject(owner, room, signal, false))
        {
            console.error(`ServerObjectManager::removeObjectAsServer :: Failed (objectId=${signal.objectId})`);
            return false;
        }
        ServerRoomManager.socketRoomContexts[room.id].multicastSignal("removeObjectSignal", signal, userIDToExclude);
        return true;
    },
    onSetObjectTransformSignalReceived: (socketUserContext: UserContext, signal: SetObjectTransformSignal) =>
    {
        const user = socketUserContext.user;
        const roomID = ServerRoomManager.currentRoomIDByUserID[user.id];
        const roomRuntimeMemory = ServerRoomManager.roomRuntimeMemories[roomID];
        if (!roomRuntimeMemory) // Single-player users have no server-side room; their edits are client-side only and must never mutate the shared room.
        {
            console.error(`ServerObjectManager::onSetObjectTransformSignalReceived :: No room registered for user (userID = ${user.id})`);
            return;
        }
        const room = roomRuntimeMemory.room;

        // A user's player goes no farther than its distance budget lets it (see USER_BUDGETS): a move past it is taken
        // back from the sender alone, whom nobody else has seen make it.
        const obj = room.objectById[signal.objectId];
        if (obj != undefined && !signal.ignorePhysics && obj.objectTypeIndex == playerTypeIndex
            && obj.sourceUserID == user.id && !UserBudgetUtil.trySpend(user.id, "distance",
                Vector3DUtil.length(Vector3DUtil.subtract(signal.transform.pos, obj.transform.pos))))
        {
            socketUserContext.addPendingSignalToUser("setObjectTransformSignal", new SetObjectTransformSignal(room.id,
                obj.objectId, new ObjectTransform({...obj.transform.pos}, {...obj.transform.dir}, {...obj.transform.scale}),
                true));
            return;
        }

        const result = ObjectUpdateUtil.setObjectTransform(user, room, signal);

        // On desync, broadcast to everyone including the sender; otherwise to everyone else.
        const socketRoomContext = ServerRoomManager.socketRoomContexts[roomID];
        if (result.desyncDetected)
        {
            const resyncSignal = new SetObjectTransformSignal(signal.roomID, signal.objectId, result.transform, true);
            socketRoomContext.multicastSignal("setObjectTransformSignal", resyncSignal);
        }
        else
        {
            socketRoomContext.multicastSignalFromUser("setObjectTransformSignal", signal, socketUserContext);
        }
    },
    // Where the room really keeps the object. (One its checks refuse is put back as a desync, above.)
    refuseSetObjectTransformSignal: (socketUserContext: UserContext, signal: SetObjectTransformSignal) =>
    {
        const room = getRoomOf(socketUserContext);
        const obj = room?.objectById[signal.objectId];
        if (room && obj)
        {
            socketUserContext.addPendingSignalToUser("setObjectTransformSignal", new SetObjectTransformSignal(room.id,
                obj.objectId, new ObjectTransform({...obj.transform.pos}, {...obj.transform.dir}, {...obj.transform.scale}),
                true));
        }
    },
    // Whether the change was made.
    onSetObjectMetadataSignalReceived: (socketUserContext: UserContext, signal: SetObjectMetadataSignal): boolean =>
    {
        const user = socketUserContext.user;
        const roomID = ServerRoomManager.currentRoomIDByUserID[user.id];
        const roomRuntimeMemory = ServerRoomManager.roomRuntimeMemories[roomID];
        if (!roomRuntimeMemory) // Single-player users have no server-side room; their edits are client-side only and must never mutate the shared room.
        {
            console.error(`ServerObjectManager::onSetObjectMetadataSignalReceived :: No room registered for user (userID = ${user.id})`);
            return false;
        }
        const room = roomRuntimeMemory.room;

        if (!ObjectUpdateUtil.setObjectMetadata(user, room, signal))
        {
            console.error(`onSetObjectMetadataSignalReceived :: Failed (objectId = ${signal.objectId})`);
            ServerObjectManager.refuseSetObjectMetadataSignal(socketUserContext, signal);
            return false;
        }

        // Broadcast to other clients
        const socketRoomContext = ServerRoomManager.socketRoomContexts[roomID];
        if (socketRoomContext)
            socketRoomContext.multicastSignalFromUser("setObjectMetadataSignal", signal, socketUserContext);
        return true;
    },
    // The value the object still has.
    refuseSetObjectMetadataSignal: (socketUserContext: UserContext, signal: SetObjectMetadataSignal) =>
    {
        const room = getRoomOf(socketUserContext);
        const obj = room?.objectById[signal.objectId];
        if (!room || !obj)
            return;
        const originalMetadata = obj.metadata[signal.metadataKey];
        const originalMetadataValue = originalMetadata ? originalMetadata.str : "";
        // The sender applied the transform it sent too, so that is put back as well.
        const originalTransform = signal.transform ? new ObjectTransform({...obj.transform.pos},
            {...obj.transform.dir}, {...obj.transform.scale}) : undefined;
        socketUserContext.addPendingSignalToUser("setObjectMetadataSignal",
            new SetObjectMetadataSignal(room.id, obj.objectId, signal.metadataKey,
                originalMetadataValue, originalTransform));
    },
}

// The room the user is in on the server, which a single-player user has none of.
function getRoomOf(socketUserContext: UserContext): Room | undefined
{
    const roomID = ServerRoomManager.currentRoomIDByUserID[socketUserContext.user.id];
    return ServerRoomManager.roomRuntimeMemories[roomID]?.room;
}

export default ServerObjectManager;
