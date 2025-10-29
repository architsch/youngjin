import User from "../../shared/auth/user";
import ObjectRuntimeMemory from "../../shared/object/objectRuntimeMemory";
import PhysicsManager from "../../shared/physics/physicsManager";
import Room from "../../shared/room/room";
import RoomRuntimeMemory from "../../shared/room/roomRuntimeMemory";
import Circle2 from "../../shared/math/types/circle2";
import ObjectDespawnParams from "../../shared/object/objectDespawnParams";
import Vec2 from "../../shared/math/types/vec2";
import ObjectTransform from "../../shared/object/objectTransform";
import ObjectDesyncResolveParams from "../../shared/object/objectDesyncResolveParams";
import ObjectSyncParams from "../../shared/object/objectSyncParams";
import VoxelGridEncoding from "../../shared/voxel/voxelGridEncoding";
import dotenv from "dotenv";
import VoxelGridGenerator from "../../shared/voxel/voxelGridGenerator";
import SocketUserContext from "../sockets/types/socketUserContext";
import VoxelManager from "../../shared/voxel/voxelManager";
import SocketRoomContext from "../sockets/types/socketRoomContext";
import ObjectMessageParams from "../../shared/object/objectMessageParams";
dotenv.config();

const roomRuntimeMemories: {[roomID: string]: RoomRuntimeMemory} = {};
const socketRoomContexts: {[roomID: string]: SocketRoomContext} = {};
const currentRoomIDByUserName: {[userName: string]: string} = {};

let lastObjectIdNumber = 0;

const RoomManager =
{
    changeUserRoom: async (socketUserContext: SocketUserContext, roomID: string | undefined, prevRoomShouldExist: boolean) =>
    {
        const user: User = socketUserContext.socket.handshake.auth as User;
        console.log(`RoomManager.changeUserRoom :: roomID = ${roomID}, userName = ${user.userName}`);
        removeUserFromRoom(socketUserContext, prevRoomShouldExist);
        if (!roomID)
            return;
    
        if (roomRuntimeMemories[roomID] == undefined)
            await loadRoom(roomID);
        addUserToRoom(socketUserContext, roomID, user.userName);

        const roomRuntimeMemory = roomRuntimeMemories[roomID];
        roomRuntimeMemory.room.encodedVoxelGrid = VoxelManager.getEncodedVoxelGrid(roomID);

        socketUserContext.socket.emit("changeRoom", roomRuntimeMemory);
    },
    sendObjectMessage: (socketUserContext: SocketUserContext, params: ObjectMessageParams) =>
    {
        const user: User = socketUserContext.socket.handshake.auth as User;
        const roomID = currentRoomIDByUserName[user.userName];
        if (roomID == undefined)
        {
            console.error(`RoomManager.sendObjectMessage :: RoomID not found (userName = ${user.userName})`);
            return;
        }
        const roomRuntimeMemory = roomRuntimeMemories[roomID];
        if (roomRuntimeMemory == undefined)
        {
            console.error(`RoomManager.sendObjectMessage :: RoomRuntimeMemory doesn't exist (roomID = ${roomID})`);
            return;
        }
        const objectRuntimeMemory = roomRuntimeMemory.objectRuntimeMemories[params.senderObjectId];
        if (objectRuntimeMemory == undefined)
        {
            console.error(`RoomManager.sendObjectMessage :: ObjectRuntimeMemory doesn't exist (roomID = ${roomID}, objectId = ${params.senderObjectId})`);
            return;
        }
        if (objectRuntimeMemory.objectSpawnParams.sourceUserName != user.userName)
        {
            console.error(`RoomManager.sendObjectMessage :: User has no authority to control this object (roomID = ${roomID}, objectId = ${params.senderObjectId})`);
            return;
        }
        params.message = params.message.trim().substring(0, 32);

        const socketRoomContext = socketRoomContexts[roomID];
        if (!socketRoomContext)
            console.error(`RoomManager.sendObjectMessage :: SocketRoomContext not found (roomID = ${roomID})`);
        else
            socketRoomContext.multicastSignal("objectMessage", params, user.userName);
    },
    updateObjectTransform: (socketUserContext: SocketUserContext, objectId: string, transform: ObjectTransform) =>
    {
        const user: User = socketUserContext.socket.handshake.auth as User;
        const roomID = currentRoomIDByUserName[user.userName];
        if (roomID == undefined)
        {
            console.error(`RoomManager.updateObjectTransform :: RoomID not found (userName = ${user.userName})`);
            return;
        }
        const roomRuntimeMemory = roomRuntimeMemories[roomID];
        if (roomRuntimeMemory == undefined)
        {
            console.error(`RoomManager.updateObjectTransform :: RoomRuntimeMemory doesn't exist (roomID = ${roomID})`);
            return;
        }
        const objectRuntimeMemory = roomRuntimeMemory.objectRuntimeMemories[objectId];
        if (objectRuntimeMemory == undefined)
        {
            console.error(`RoomManager.updateObjectTransform :: ObjectRuntimeMemory doesn't exist (roomID = ${roomID}, objectId = ${objectId})`);
            return;
        }
        if (objectRuntimeMemory.objectSpawnParams.sourceUserName != user.userName)
        {
            console.error(`RoomManager.updateObjectTransform :: User has no authority to control this object (roomID = ${roomID}, objectId = ${objectId})`);
            return;
        }

        const targetPos: Vec2 = { x: transform.x, y: transform.z };
        const result = PhysicsManager.tryMoveObject(roomID, objectId, targetPos);
        transform.x = result.resolvedPos.x;
        transform.z = result.resolvedPos.y;
        Object.assign(objectRuntimeMemory.objectSpawnParams.transform, transform);

        if (result.desyncDetected)
        {
            const params: ObjectDesyncResolveParams = { objectId, resolvedPos: result.resolvedPos };
            const socketRoomContext = socketRoomContexts[roomID];
            if (!socketRoomContext)
                console.error(`RoomManager.updateObjectTransform :: SocketRoomContext not found (roomID = ${roomID})`);
            else
                socketRoomContext.multicastSignal("objectDesyncResolve", params);
        }
        else
        {
            const params: ObjectSyncParams = { objectId, transform };
            const socketRoomContext = socketRoomContexts[roomID];
            if (!socketRoomContext)
                console.error(`RoomManager.updateObjectTransform :: SocketRoomContext not found (roomID = ${roomID})`);
            else
                socketRoomContext.multicastSignal("objectSync", params, user.userName);
        }
    },
}

async function loadRoom(roomID: string): Promise<RoomRuntimeMemory>
{
    console.log(`RoomManager.loadRoom :: roomID = ${roomID}`);
    if (roomRuntimeMemories[roomID] != undefined)
        throw new Error(`RoomManager.loadRoom :: RoomRuntimeMemory already exists (roomID = ${roomID})`);

    const room: Room = { // TODO: Fetch from database
        roomID,
        roomName: roomID,
        ownerUserName: "",
        texturePackURL: `${process.env.MODE == "dev" ? `http://localhost:${process.env.PORT}` : process.env.URL_STATIC}/app/assets/texture_packs/default.jpg`,
        encodedVoxelGrid: VoxelGridEncoding.encode(VoxelGridGenerator.generateEmptyRoom(32, 32, 0, 1)),
        linkedRoomIDs: "s1,s2",
    };
    const roomRuntimeMemory: RoomRuntimeMemory = {
        room,
        participantUserNames: {},
        objectRuntimeMemories: {},
    };

    const decodedVoxelGrid = VoxelGridEncoding.decode(room.encodedVoxelGrid);
    roomRuntimeMemories[roomID] = roomRuntimeMemory;
    socketRoomContexts[roomID] = new SocketRoomContext();

    PhysicsManager.loadRoom(roomRuntimeMemory, decodedVoxelGrid);
    VoxelManager.loadRoom(roomRuntimeMemory, decodedVoxelGrid);
    return roomRuntimeMemory;
}

function unloadRoom(roomID: string)
{
    console.log(`RoomManager.unloadRoom :: roomID = ${roomID}`);
    const roomRuntimeMemory = roomRuntimeMemories[roomID];
    if (roomRuntimeMemories[roomID] == undefined)
        throw new Error(`RoomManager.unloadRoom :: RoomRuntimeMemory doesn't exist (roomID = ${roomID})`);
    if (Object.keys(roomRuntimeMemory.participantUserNames).length > 0)
        throw new Error(`RoomManager.unloadRoom :: There are still participants in the room (participants = [${JSON.stringify(roomRuntimeMemory.participantUserNames)}])`);
    delete roomRuntimeMemories[roomID];
    delete socketRoomContexts[roomID];

    VoxelManager.unloadRoom(roomID);
    PhysicsManager.unloadRoom(roomID);
}

function addUserToRoom(socketUserContext: SocketUserContext, roomID: string, userName: string)
{
    const user: User = socketUserContext.socket.handshake.auth as User;
    
    console.log(`RoomManager.addUserToRoom :: roomID = ${roomID}, userName = ${userName}`);
    const roomRuntimeMemory = roomRuntimeMemories[roomID];
    if (roomRuntimeMemory == undefined)
    {
        console.error(`RoomManager.addUserToRoom :: RoomRuntimeMemory doesn't exist (roomID = ${roomID})`);
        return;
    }
    if (roomRuntimeMemory.participantUserNames[userName] != undefined)
    {
        console.error(`RoomManager.addUserToRoom :: User is already registered (roomID = ${roomID}, userName = ${userName})`);
        return;
    }
    currentRoomIDByUserName[userName] = roomID;
    roomRuntimeMemory.participantUserNames[userName] = true;
    
    socketUserContext.socket.join(roomID);

    const socketRoomContext = socketRoomContexts[roomID];
    if (!socketRoomContext)
        console.error(`RoomManager.addUserToRoom :: SocketRoomContext not found (roomID = ${roomID})`);
    else
        socketRoomContext.addSocketUserContext(userName, socketUserContext);

    // Create the user's player object
    addObject(socketUserContext, { objectSpawnParams: {
        sourceUserName: user.userName,
        objectType: "Player",
        objectId: `#${++lastObjectIdNumber}`,
        transform: {
            x: 16, y: 0, z: 16,
            eulerX: 0, eulerY: Math.PI, eulerZ: 0,
        },
        metadata: {},
    } });
}

function removeUserFromRoom(socketUserContext: SocketUserContext, prevRoomShouldExist: boolean)
{
    const user: User = socketUserContext.socket.handshake.auth as User;
    const roomID = currentRoomIDByUserName[user.userName];
    console.log(`RoomManager.removeUserFromRoom :: roomID = ${roomID}, userName = ${user.userName}`);
    if (roomID == undefined)
    {
        if (prevRoomShouldExist) // This may happen when the client disconnects before joining the very first room.
            console.warn(`RoomManager.removeUserFromRoom :: Previous room not found :: userName = ${user.userName}`);
        return;
    }
    const roomRuntimeMemory = roomRuntimeMemories[roomID];
    if (roomRuntimeMemory == undefined)
    {
        console.error(`RoomManager.removeUserFromRoom :: RoomRuntimeMemory doesn't exist (roomID = ${roomID})`);
        return;
    }
    const objectIds = getIdsOfObjectsSpawnedByUser(roomID, user.userName);
    for (const objectId of objectIds)
        removeObject(socketUserContext, objectId);

    if (roomRuntimeMemory.participantUserNames[user.userName] == undefined)
    {
        console.error(`RoomManager.removeUserFromRoom :: User is not registered as the room's participant (userName = ${user.userName}, roomID = ${roomID})`);
        return;
    }
    delete currentRoomIDByUserName[user.userName];
    delete roomRuntimeMemory.participantUserNames[user.userName];

    socketUserContext.socket.leave(roomID);

    const socketRoomContext = socketRoomContexts[roomID];
    if (!socketRoomContext)
        console.error(`RoomManager.removeUserFromRoom :: SocketRoomContext not found (roomID = ${roomID})`);
    else
        socketRoomContext.removeSocketUserContext(user.userName);

    if (Object.keys(roomRuntimeMemory.participantUserNames).length == 0)
        unloadRoom(roomID);
}

function getIdsOfObjectsSpawnedByUser(roomID: string, userName: string): string[]
{
    const roomRuntimeMemory = roomRuntimeMemories[roomID];
    if (roomRuntimeMemory == undefined)
    {
        console.error(`RoomManager.getIdsOfObjectsSpawnedByUser :: RoomRuntimeMemory doesn't exist (roomID = ${roomID})`);
        return [];
    }
    const ids: string[] = [];
    for (const [objectId, objectRuntimeMemory] of Object.entries(roomRuntimeMemory.objectRuntimeMemories))
    {
        if (objectRuntimeMemory.objectSpawnParams.sourceUserName == userName)
            ids.push(objectId);
    }
    return ids;
}

function addObject(socketUserContext: SocketUserContext, objectRuntimeMemory: ObjectRuntimeMemory)
{
    const user: User = socketUserContext.socket.handshake.auth as User;
    const roomID = currentRoomIDByUserName[user.userName];
    const objectId = objectRuntimeMemory.objectSpawnParams.objectId;

    console.log(`RoomManager.addObject :: roomID = ${roomID}, userName = ${user.userName}, objectId = ${objectId}`);
    if (roomID == undefined)
    {
        console.error(`RoomManager.addObject :: RoomID not found (userName = ${user.userName}, objectId = ${objectId})`);
        return;
    }
    const roomRuntimeMemory = roomRuntimeMemories[roomID];
    if (roomRuntimeMemory == undefined)
    {
        console.error(`RoomManager.addObject :: RoomRuntimeMemory doesn't exist (roomID = ${roomID}, objectId = ${objectId})`);
        return;
    }
    if (roomRuntimeMemory.objectRuntimeMemories[objectId] != undefined)
    {
        console.error(`RoomManager.addObject :: ObjectRuntimeMemory already exists (roomID = ${roomID}, objectId = ${objectId})`);
        return;
    }
    roomRuntimeMemory.objectRuntimeMemories[objectId] = objectRuntimeMemory;
    const collisionShape: Circle2 = {
        x: objectRuntimeMemory.objectSpawnParams.transform.x,
        y: objectRuntimeMemory.objectSpawnParams.transform.z,
        radius: 0.3,
    };
    PhysicsManager.addObject(roomID, objectId, collisionShape, 0);

    const socketRoomContext = socketRoomContexts[roomID];
    if (!socketRoomContext)
        console.error(`RoomManager.addObject :: SocketRoomContext not found (roomID = ${roomID})`);
    else
        socketRoomContext.multicastSignal("objectSpawn", objectRuntimeMemory.objectSpawnParams, user.userName);
}

function removeObject(socketUserContext: SocketUserContext, objectId: string)
{
    const user: User = socketUserContext.socket.handshake.auth as User;
    const roomID = currentRoomIDByUserName[user.userName];
    console.log(`RoomManager.removeObject :: roomID = ${roomID}, userName = ${user.userName}, objectId = ${objectId}`);
    if (roomID == undefined)
    {
        console.error(`RoomManager.removeObject :: RoomID not found (userName = ${user.userName}, objectId = ${objectId})`);
        return;
    }
    const roomRuntimeMemory = roomRuntimeMemories[roomID];
    if (roomRuntimeMemory == undefined)
    {
        console.error(`RoomManager.removeObject :: RoomRuntimeMemory doesn't exist (roomID = ${roomID}, objectId = ${objectId})`);
        return;
    }
    if (roomRuntimeMemory.objectRuntimeMemories[objectId] == undefined)
    {
        console.error(`RoomManager.removeObject :: ObjectRuntimeMemory doesn't exist (roomID = ${roomID}, objectId = ${objectId})`);
        return;
    }
    delete roomRuntimeMemory.objectRuntimeMemories[objectId];
    PhysicsManager.removeObject(roomID, objectId);
    const despawnParams: ObjectDespawnParams = { objectId };

    const socketRoomContext = socketRoomContexts[roomID];
    if (!socketRoomContext)
        console.error(`RoomManager.updateObjectTransform :: SocketRoomContext not found (roomID = ${roomID})`);
    else
        socketRoomContext.multicastSignal("objectDespawn", despawnParams, user.userName);
}

export default RoomManager;