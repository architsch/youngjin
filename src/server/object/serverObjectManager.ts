import RemoveObjectSignal from "../../shared/object/types/removeObjectSignal";
import SetObjectMetadataSignal from "../../shared/object/types/setObjectMetadataSignal";
import AddObjectSignal from "../../shared/object/types/addObjectSignal";
import ObjectUpdateUtil from "../../shared/object/util/objectUpdateUtil";
import SocketUserContext from "../sockets/types/socketUserContext";
import ServerRoomManager from "../room/serverRoomManager";
import ServerUserManager from "../user/serverUserManager";
import SetObjectTransformSignal from "../../shared/object/types/setObjectTransformSignal";

let nonPersistentObjectIdCounter = 0;

const ServerObjectManager =
{
    generateNonPersistentObjectId: (): string =>
    {
        return `@${++nonPersistentObjectIdCounter}`;
    },
    onAddObjectSignalReceived: (socketUserContext: SocketUserContext, obj: AddObjectSignal): boolean =>
    {
        const user = socketUserContext.user;
        const userRole = ServerUserManager.getUserRole(user.id);
        const roomID = ServerRoomManager.currentRoomIDByUserID[user.id];
        const roomRuntimeMemory = ServerRoomManager.roomRuntimeMemories[roomID];
        const room = roomRuntimeMemory.room;

        if (!ObjectUpdateUtil.addObject(user, userRole, room, obj))
        {
            console.error(`onAddObjectSignalReceived :: Failed (objectId=${obj.objectId})`);
            socketUserContext.addPendingSignalToUser("removeObjectSignal",
                new RemoveObjectSignal(room.id, obj.objectId));
            return false;
        }

        const socketRoomContext = ServerRoomManager.socketRoomContexts[roomID];
        socketRoomContext.multicastSignal("addObjectSignal", obj, user.id);
        return true;
    },
    onRemoveObjectSignalReceived: (socketUserContext: SocketUserContext, signal: RemoveObjectSignal): boolean =>
    {
        const user = socketUserContext.user;
        const userRole = ServerUserManager.getUserRole(user.id);
        const roomID = ServerRoomManager.currentRoomIDByUserID[user.id];
        const roomRuntimeMemory = ServerRoomManager.roomRuntimeMemories[roomID];
        const room = roomRuntimeMemory.room;

        if (!ObjectUpdateUtil.removeObject(user, userRole, room, signal))
        {
            console.error(`onRemoveObjectSignalReceived :: Failed (userID = ${user.id})`);
            return false;
        }

        const socketRoomContext = ServerRoomManager.socketRoomContexts[roomID];
        socketRoomContext.multicastSignal("removeObjectSignal", signal, user.id);
        return true;
    },
    onSetObjectTransformSignalReceived: (socketUserContext: SocketUserContext, signal: SetObjectTransformSignal) =>
    {
        const user = socketUserContext.user;
        const userRole = ServerUserManager.getUserRole(user.id);
        const roomID = ServerRoomManager.currentRoomIDByUserID[user.id];
        const roomRuntimeMemory = ServerRoomManager.roomRuntimeMemories[roomID];

        const result = ObjectUpdateUtil.setObjectTransform(user, userRole, roomRuntimeMemory.room, signal);

        // If desync was detected,
        //      Broadcast to everyone (including the sender).
        // Otherwise,
        //      Broadcast to everyone except the one who sent the signal. 
        const socketRoomContext = ServerRoomManager.socketRoomContexts[roomID];
        socketRoomContext.multicastSignal("setObjectTransformSignal", signal, result.desyncDetected ? undefined : user.id);
    },
    onSetObjectMetadataSignalReceived: (socketUserContext: SocketUserContext, signal: SetObjectMetadataSignal) =>
    {
        const user = socketUserContext.user;
        const userRole = ServerUserManager.getUserRole(user.id);
        const roomID = ServerRoomManager.currentRoomIDByUserID[user.id];
        const roomRuntimeMemory = ServerRoomManager.roomRuntimeMemories[roomID];
        const room = roomRuntimeMemory.room;
        const obj = room.objectById[signal.objectId];

        if (!ObjectUpdateUtil.setObjectMetadata(user, userRole, room, signal))
        {
            console.error(`onSetObjectMetadataSignalReceived :: Failed (objectId = ${signal.objectId})`);
            const originalMetadata = obj.metadata[signal.metadataKey];
            const originalMetadataValue = originalMetadata ? originalMetadata.str : "";
            socketUserContext.addPendingSignalToUser("setObjectMetadataSignal",
                new SetObjectMetadataSignal(room.id, obj.objectId, signal.metadataKey,
                    originalMetadataValue));
            return;
        }

        // Broadcast to other clients
        const socketRoomContext = ServerRoomManager.socketRoomContexts[roomID];
        if (socketRoomContext)
            socketRoomContext.multicastSignal("setObjectMetadataSignal", signal, user.id);
    },
}

export default ServerObjectManager;
