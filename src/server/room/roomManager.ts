import socketIO from "socket.io";
import User from "../../shared/auth/user";
import ObjectServerRecord from "../../shared/object/objectServerRecord";
import PhysicsManager from "../../shared/physics/physicsManager";
import Room from "../../shared/room/room";
import RoomServerRecord from "../../shared/room/roomServerRecord";
import Circle2 from "../../shared/math/types/circle2";
import ObjectDespawnParams from "../../shared/object/objectDespawnParams";
import Vec2 from "../../shared/math/types/vec2";
import ObjectTransform from "../../shared/object/objectTransform";
import ObjectDesyncResolveParams from "../../shared/object/objectDesyncResolveParams";
import ObjectSyncParams from "../../shared/object/objectSyncParams";
import VoxelGridEncoding from "../../shared/voxel/voxelGridEncoding";
import VoxelGrid from "../../shared/voxel/voxelGrid";
import dotenv from "dotenv";
import VoxelGridGenerator from "../../shared/voxel/voxelGridGenerator";
dotenv.config();

const roomServerRecords: {[roomID: string]: RoomServerRecord} = {};
const voxelGrids: {[roomID: string]: VoxelGrid} = {};
const currentRoomIDByUserName: {[userName: string]: string} = {};

const RoomManager =
{
    getUserRoomID: (userName: string): string =>
    {
        return currentRoomIDByUserName[userName];
    },
    changeUserRoom: async (nsp: socketIO.Namespace, socket: socketIO.Socket, roomID: string, prevRoomShouldExist: boolean) =>
    {
        const user: User = socket.handshake.auth as User;
        console.log(`RoomManager.changeUserRoom :: roomID = ${roomID}, userName = ${user.userName}`);
        await RoomManager.removeUserFromRoom(nsp, socket, prevRoomShouldExist);

        if (roomServerRecords[roomID] == undefined)
            await loadRoom(roomID);
        await addUserToRoom(roomID, user.userName);

        const roomServerRecord = roomServerRecords[roomID];
        const voxelGrid = voxelGrids[roomID];
        roomServerRecord.room.encodedVoxelGrid = VoxelGridEncoding.encode(voxelGrid);
        socket.join(roomID);
        socket.emit("changeRoom", roomServerRecord);
    },
    removeUserFromRoom: async (nsp: socketIO.Namespace, socket: socketIO.Socket, prevRoomShouldExist: boolean) =>
    {
        const user: User = socket.handshake.auth as User;
        const roomID = currentRoomIDByUserName[user.userName];
        console.log(`RoomManager.removeUserFromRoom :: roomID = ${roomID}, userName = ${user.userName}`);
        if (roomID == undefined)
        {
            if (prevRoomShouldExist) // This may happen when the client disconnects before joining the very first room.
                console.warn(`RoomManager.removeUserFromRoom :: Previous room not found :: userName = ${user.userName}`);
            return;
        }
        const roomServerRecord = roomServerRecords[roomID];
        if (roomServerRecord == undefined)
        {
            console.error(`RoomManager.removeUserFromRoom :: RoomServerRecord doesn't exist (roomID = ${roomID})`);
            return;
        }
        const objectIds = getIdsOfObjectsSpawnedByUser(roomID, user.userName);
        for (const objectId of objectIds)
            RoomManager.removeObject(socket, objectId);

        if (roomServerRecord.participantUserNames[user.userName] == undefined)
        {
            console.error(`RoomManager.removeUserFromRoom :: User is not registered as the room's participant (userName = ${user.userName}, roomID = ${roomID})`);
            return;
        }
        delete currentRoomIDByUserName[user.userName];
        delete roomServerRecord.participantUserNames[user.userName];

        if (Object.keys(roomServerRecord.participantUserNames).length == 0)
            await unloadRoom(roomID);
    },
    addObject: (socket: socketIO.Socket, objectServerRecord: ObjectServerRecord) =>
    {
        const user: User = socket.handshake.auth as User;
        const roomID = currentRoomIDByUserName[user.userName];
        const objectId = objectServerRecord.objectSpawnParams.objectId;

        console.log(`RoomManager.addObject :: roomID = ${roomID}, userName = ${user.userName}, objectId = ${objectId}`);
        if (roomID == undefined)
        {
            console.error(`RoomManager.addObject :: RoomID not found (userName = ${user.userName}, objectId = ${objectId})`);
            return;
        }
        const roomServerRecord = roomServerRecords[roomID];
        if (roomServerRecord == undefined)
        {
            console.error(`RoomManager.addObject :: RoomServerRecord doesn't exist (roomID = ${roomID}, objectId = ${objectId})`);
            return;
        }
        if (roomServerRecord.objectServerRecords[objectId] != undefined)
        {
            console.error(`RoomManager.addObject :: ObjectServerRecord already exists (roomID = ${roomID}, objectId = ${objectId})`);
            return;
        }
        roomServerRecord.objectServerRecords[objectId] = objectServerRecord;
        const collisionShape: Circle2 = {
            x: objectServerRecord.objectSpawnParams.transform.x,
            y: objectServerRecord.objectSpawnParams.transform.z,
            radius: 0.3,
        };
        PhysicsManager.addObject(roomID, objectId, collisionShape, 0);
        socket.broadcast.to(roomID).emit("objectSpawn", objectServerRecord.objectSpawnParams);
    },
    removeObject: (socket: socketIO.Socket, objectId: string) =>
    {
        const user: User = socket.handshake.auth as User;
        const roomID = currentRoomIDByUserName[user.userName];
        console.log(`RoomManager.removeObject :: roomID = ${roomID}, userName = ${user.userName}, objectId = ${objectId}`);
        if (roomID == undefined)
        {
            console.error(`RoomManager.removeObject :: RoomID not found (userName = ${user.userName}, objectId = ${objectId})`);
            return;
        }
        const roomServerRecord = roomServerRecords[roomID];
        if (roomServerRecord == undefined)
        {
            console.error(`RoomManager.removeObject :: RoomServerRecord doesn't exist (roomID = ${roomID}, objectId = ${objectId})`);
            return;
        }
        if (roomServerRecord.objectServerRecords[objectId] == undefined)
        {
            console.error(`RoomManager.removeObject :: ObjectServerRecord doesn't exist (roomID = ${roomID}, objectId = ${objectId})`);
            return;
        }
        delete roomServerRecord.objectServerRecords[objectId];
        PhysicsManager.removeObject(roomID, objectId);
        const despawnParams: ObjectDespawnParams = { objectId };
        socket.broadcast.to(roomID).emit("objectDespawn", despawnParams);
    },
    updateObjectTransform: (nsp: socketIO.Namespace, socket: socketIO.Socket, objectId: string,
        transform: ObjectTransform) =>
    {
        const user: User = socket.handshake.auth as User;
        const roomID = currentRoomIDByUserName[user.userName];
        if (roomID == undefined)
        {
            console.error(`RoomManager.updateObjectTransform :: RoomID not found (userName = ${user.userName})`);
            return;
        }
        const roomServerRecord = roomServerRecords[roomID];
        if (roomServerRecord == undefined)
        {
            console.error(`RoomManager.updateObjectTransform :: RoomServerRecord doesn't exist (roomID = ${roomID})`);
            return;
        }
        const objectServerRecord = roomServerRecord.objectServerRecords[objectId];
        if (objectServerRecord == undefined)
        {
            console.error(`RoomManager.updateObjectTransform :: ObjectServerRecord doesn't exist (roomID = ${roomID}, objectId = ${objectId})`);
            return;
        }

        const targetPos: Vec2 = { x: transform.x, y: transform.z };
        const result = PhysicsManager.tryMoveObject(roomID, objectId, targetPos);
        transform.x = result.resolvedPos.x;
        transform.z = result.resolvedPos.y;
        Object.assign(objectServerRecord.objectSpawnParams.transform, transform);

        if (result.desyncDetected)
        {
            const params: ObjectDesyncResolveParams = { objectId, resolvedPos: result.resolvedPos };
            nsp.to(roomID).emit("objectDesyncResolve", params);
        }
        else
        {
            const params: ObjectSyncParams = { objectId, transform };
            socket.broadcast.to(roomID).emit("objectSync", params);
        }
    },
}

async function loadRoom(roomID: string): Promise<RoomServerRecord>
{
    console.log(`RoomManager.loadRoom :: roomID = ${roomID}`);
    if (roomServerRecords[roomID] != undefined)
        throw new Error(`RoomManager.loadRoom :: loadRoomRoomServerRecord already exists (roomID = ${roomID})`);

    const room: Room = { // TODO: Fetch from database
        roomID,
        roomName: roomID,
        ownerUserName: "",
        texturePackURL: `${process.env.MODE == "dev" ? `http://localhost:${process.env.PORT}` : process.env.URL_STATIC}/app/assets/texture_packs/default.jpg`,
        encodedVoxelGrid: VoxelGridEncoding.encode(VoxelGridGenerator.generateEmptyRoom(32, 32, 0, 1)),
        linkedRoomIDs: "s1,s2",
    };
    const roomServerRecord: RoomServerRecord = {
        room,
        participantUserNames: {},
        objectServerRecords: {},
    };

    const voxelGrid = VoxelGridEncoding.decode(room.encodedVoxelGrid);
    roomServerRecords[roomID] = roomServerRecord;
    voxelGrids[roomID] = voxelGrid;
    PhysicsManager.loadRoom(roomServerRecord, voxelGrid);
    return roomServerRecord;
}

async function unloadRoom(roomID: string)
{
    console.log(`RoomManager.unloadRoom :: roomID = ${roomID}`);
    const roomServerRecord = roomServerRecords[roomID];
    if (roomServerRecords[roomID] == undefined)
        throw new Error(`RoomManager.unloadRoom :: RoomServerRecord doesn't exist (roomID = ${roomID})`);
    if (Object.keys(roomServerRecord.participantUserNames).length > 0)
        throw new Error(`RoomManager.unloadRoom :: There are still participants in the room (participants = [${JSON.stringify(roomServerRecord.participantUserNames)}])`);
    delete roomServerRecords[roomID];
    delete voxelGrids[roomID];
    PhysicsManager.unloadRoom(roomID);
}

async function addUserToRoom(roomID: string, userName: string)
{
    console.log(`RoomManager.addUserToRoom :: roomID = ${roomID}, userName = ${userName}`);
    const roomServerRecord = roomServerRecords[roomID];
    if (roomServerRecord == undefined)
    {
        console.error(`RoomManager.addUserToRoom :: RoomServerRecord doesn't exist (roomID = ${roomID})`);
        return;
    }
    if (roomServerRecord.participantUserNames[userName] != undefined)
    {
        console.error(`RoomManager.addUserToRoom :: User is already registered (roomID = ${roomID}, userName = ${userName})`);
        return;
    }
    currentRoomIDByUserName[userName] = roomID;
    roomServerRecord.participantUserNames[userName] = true;
}

function getIdsOfObjectsSpawnedByUser(roomID: string, userName: string): string[]
{
    const roomServerRecord = roomServerRecords[roomID];
    if (roomServerRecord == undefined)
    {
        console.error(`RoomManager.getIdsOfObjectsSpawnedByUser :: RoomServerRecord doesn't exist (roomID = ${roomID})`);
        return [];
    }
    const ids: string[] = [];
    for (const [objectId, objectServerRecord] of Object.entries(roomServerRecord.objectServerRecords))
    {
        if (objectServerRecord.objectSpawnParams.sourceUserName == userName)
            ids.push(objectId);
    }
    return ids;
}

export default RoomManager;