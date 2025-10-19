import socketIO from "socket.io";
import { SocketMiddleware } from "./types/socketMiddleware";
import ObjectMessageParams from "../../shared/object/objectMessageParams"
import ObjectSyncParams from "../../shared/object/objectSyncParams";
import ObjectSpawnParams from "../../shared/object/objectSpawnParams";
import ObjectDespawnParams from "../../shared/object/objectDespawnParams";
import User from "../../shared/auth/user";
import Circle2 from "../../shared/math/types/circle2";
import PhysicsManager from "../../shared/physics/physicsManager";
import Vec2 from "../../shared/math/types/vec2";
import RoomManager from "../room/roomManager";

let nsp: socketIO.Namespace;

const joinedRoomNames: {[userName: string]: string} = {};

const GameSockets =
{
    init: (io: socketIO.Server, authMiddleware: SocketMiddleware): void =>
    {
        nsp = io.of("/game_sockets");
        nsp.use(authMiddleware);

        nsp.on("connection", async (socket: socketIO.Socket) => {
            const user: User = socket.handshake.auth as User;

            console.log(`(GameSockets) Client connected :: ${JSON.stringify(user)}`);

            socket.on("objectMessage", (params: ObjectMessageParams) => {
                const joinedRoomName = joinedRoomNames[user.userName];
                if (joinedRoomName == undefined)
                {
                    console.error(`User is not in any of the rooms. (userName = ${user.userName})`);
                    return;
                }
                params.message = params.message.trim().substring(0, 32);
                socket.broadcast.to(joinedRoomName).emit("objectMessage", params);
            });

            socket.on("objectSync", (params: ObjectSyncParams) => {
                const joinedRoomName = joinedRoomNames[user.userName];
                if (joinedRoomName == undefined)
                {
                    console.error(`User is not in any of the rooms. (userName = ${user.userName})`);
                    return;
                }
                if (!RoomManager.objectIsSpawnedByUser(joinedRoomName, user.userName, params.objectId))
                {
                    console.error(`User tried to sync an object which he/she doesn't own (roomName = ${joinedRoomName}, userName = ${user.userName}, objectId = ${params.objectId})`);
                    return;
                }
                const targetPos: Vec2 = { x: params.transform.x, y: params.transform.z };
                const result = PhysicsManager.tryMoveObject(joinedRoomName, params.objectId, targetPos);
                RoomManager.updateObjectTransform(joinedRoomName, params.objectId,
                    result.resolvedPos.x, params.transform.y, result.resolvedPos.y,
                    params.transform.eulerX, params.transform.eulerY, params.transform.eulerZ
                );
                if (result.desyncDetected)
                    nsp.to(joinedRoomName).emit("objectDesyncResolve", { objectId: params.objectId, resolvedPos: result.resolvedPos });
                else
                    socket.broadcast.to(joinedRoomName).emit("objectSync", params);
            });

            socket.on("objectSpawn", (params: ObjectSpawnParams) => {
                const joinedRoomName = joinedRoomNames[user.userName];
                if (joinedRoomName == undefined)
                {
                    console.error(`User is not in any of the rooms. (userName = ${user.userName})`);
                    return;
                }
                if (RoomManager.hasObject(joinedRoomName, params.objectId))
                {
                    console.error(`Tried to spawn an already existing object (objectId = ${params.objectId})`);
                    return;
                }
                const collisionShape: Circle2 = {
                    x: params.transform.x,
                    y: params.transform.z,
                    radius: 0.3,
                };
                PhysicsManager.addObject(joinedRoomName, params.objectId, collisionShape, 0);
                RoomManager.addObject(joinedRoomName, { objectSpawnParams: params });
                socket.broadcast.to(joinedRoomName).emit("objectSpawn", params);
            });

            socket.on("objectDespawn", (params: ObjectDespawnParams) => {
                const joinedRoomName = joinedRoomNames[user.userName];
                if (joinedRoomName == undefined)
                {
                    console.error(`User is not in any of the rooms. (userName = ${user.userName})`);
                    return;
                }
                if (RoomManager.hasObject(joinedRoomName, params.objectId))
                {
                    console.error(`Tried to despawn a nonexistent object (objectId = ${params.objectId})`);
                    return;
                }
                PhysicsManager.removeObject(joinedRoomName, params.objectId);
                RoomManager.removeObject(joinedRoomName, params.objectId)
                socket.broadcast.to(joinedRoomName).emit("objectDespawn", params);
            });

            socket.on("disconnect", () => {
                console.log(`(GameSockets) Client disconnected :: ${JSON.stringify(user)}`);

                const joinedRoomName = joinedRoomNames[user.userName];
                if (joinedRoomName == undefined)
                {
                    console.warn(`User is not in any of the rooms. (userName = ${user.userName})`);
                    return;
                }
                if (!RoomManager.hasRoom(joinedRoomName))
                {
                    console.error(`Room not found (roomName = ${joinedRoomName})`);
                    return;
                }
                RoomManager.removeUserFromRoom(joinedRoomName, user.userName);
                    
                const objectIds = RoomManager.getIdsOfObjectsSpawnedByUser(joinedRoomName, user.userName);
                for (const objectId of objectIds)
                {
                    PhysicsManager.removeObject(joinedRoomName, objectId);
                    RoomManager.removeObject(joinedRoomName, objectId);
                    nsp.to(joinedRoomName).emit("objectDespawn", { objectId });
                }

                delete joinedRoomNames[user.userName];
            });

            // For now, just let the client automatically join the default room.
            const roomName = "room_default";
            socket.join(roomName);

            if (!RoomManager.hasRoom(roomName))
                await RoomManager.loadRoom(roomName);
            const roomServerRecord = RoomManager.getRoom(roomName);
            RoomManager.addUserToRoom(roomName, user.userName);
            joinedRoomNames[user.userName] = roomName;

            if (!PhysicsManager.hasRoom(roomName))
                await PhysicsManager.loadRoom(roomServerRecord);

            socket.emit("roomLoad", roomServerRecord);
        });
    },
}



export default GameSockets;