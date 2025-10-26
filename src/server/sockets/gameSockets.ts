import socketIO from "socket.io";
import { SocketMiddleware } from "./types/socketMiddleware";
import ObjectMessageParams from "../../shared/object/objectMessageParams"
import ObjectSyncParams from "../../shared/object/objectSyncParams";
import ObjectSpawnParams from "../../shared/object/objectSpawnParams";
import ObjectDespawnParams from "../../shared/object/objectDespawnParams";
import RoomChangeRequestParams from "../../shared/room/roomChangeRequestParams";
import User from "../../shared/auth/user";
import RoomManager from "../room/roomManager";
import ObjectServerRecord from "../../shared/object/objectServerRecord";

let nsp: socketIO.Namespace;

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
                const currentRoomID = RoomManager.getUserRoomID(user.userName);
                if (currentRoomID == undefined)
                {
                    console.error(`User does not belong to any room (userName = ${user.userName})`);
                    return;
                }
                params.message = params.message.trim().substring(0, 32);
                socket.broadcast.to(currentRoomID).emit("objectMessage", params);
            });

            socket.on("objectSync", (params: ObjectSyncParams) => {
                RoomManager.updateObjectTransform(nsp, socket, params.objectId, params.transform);
            });
            socket.on("objectSpawn", (params: ObjectSpawnParams) => {
                const objectServerRecord: ObjectServerRecord = { objectSpawnParams: params };
                RoomManager.addObject(socket, objectServerRecord);
            });
            socket.on("objectDespawn", (params: ObjectDespawnParams) => {
                RoomManager.removeObject(socket, params.objectId);
            });
            socket.on("roomChangeRequest", async (params: RoomChangeRequestParams) => {
                await RoomManager.changeUserRoom(nsp, socket, params.roomID, true);
            });

            socket.on("disconnect", async () => {
                console.log(`(GameSockets) Client disconnected :: ${JSON.stringify(user)}`);
                await RoomManager.removeUserFromRoom(nsp, socket, true);
            });

            // A recently connected client should automatically join the default room.
            await RoomManager.changeUserRoom(nsp, socket, "s0", false);
        });
    },
}



export default GameSockets;