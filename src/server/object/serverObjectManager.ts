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
            socketUserContext.addPendingSignalToUser("removeObjectSignal",
                new RemoveObjectSignal(room.id, obj.objectId));
            return false;
        }

        const socketRoomContext = ServerRoomManager.socketRoomContexts[roomID];
        socketRoomContext.multicastSignal("addObjectSignal", obj, user.id);
        return true;
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
            return false;
        }

        const socketRoomContext = ServerRoomManager.socketRoomContexts[roomID];
        socketRoomContext.multicastSignal("removeObjectSignal", signal, user.id);
        return true;
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
            socketRoomContext.multicastSignal("setObjectTransformSignal", signal, user.id);
        }
    },
    onSetObjectMetadataSignalReceived: (socketUserContext: UserContext, signal: SetObjectMetadataSignal) =>
    {
        const user = socketUserContext.user;
        const roomID = ServerRoomManager.currentRoomIDByUserID[user.id];
        const roomRuntimeMemory = ServerRoomManager.roomRuntimeMemories[roomID];
        if (!roomRuntimeMemory) // Single-player users have no server-side room; their edits are client-side only and must never mutate the shared room.
        {
            console.error(`ServerObjectManager::onSetObjectMetadataSignalReceived :: No room registered for user (userID = ${user.id})`);
            return;
        }
        const room = roomRuntimeMemory.room;

        const obj = room.objectById[signal.objectId];        

        if (!ObjectUpdateUtil.setObjectMetadata(user, room, signal))
        {
            console.error(`onSetObjectMetadataSignalReceived :: Failed (objectId = ${signal.objectId})`);
            const originalMetadata = obj.metadata[signal.metadataKey];
            const originalMetadataValue = originalMetadata ? originalMetadata.str : "";
            // The sender applied the transform it sent too, so that is put back as well.
            const originalTransform = signal.transform ? new ObjectTransform({...obj.transform.pos},
                {...obj.transform.dir}, {...obj.transform.scale}) : undefined;
            socketUserContext.addPendingSignalToUser("setObjectMetadataSignal",
                new SetObjectMetadataSignal(room.id, obj.objectId, signal.metadataKey,
                    originalMetadataValue, originalTransform));
            return;
        }

        // Broadcast to other clients
        const socketRoomContext = ServerRoomManager.socketRoomContexts[roomID];
        if (socketRoomContext)
            socketRoomContext.multicastSignal("setObjectMetadataSignal", signal, user.id);
    },
}

export default ServerObjectManager;
