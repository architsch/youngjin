import socketIO from "socket.io";
import { SocketMiddleware } from "./types/socketMiddleware";
import ObjectMessageParams from "../../shared/object/types/objectMessageParams"
import ObjectSyncParams from "../../shared/object/types/objectSyncParams";
import RoomChangeRequestParams from "../../shared/room/types/roomChangeRequestParams";
import User from "../../shared/auth/user";
import RoomManager from "../room/roomManager";
import SocketUserContext from "./types/socketUserContext";

let nsp: socketIO.Namespace;
let signalProcessingInterval: NodeJS.Timeout;
const socketUserContexts: {[userName: string]: SocketUserContext} = {};

const GameSockets =
{
    init: (io: socketIO.Server, authMiddleware: SocketMiddleware): void =>
    {
        nsp = io.of("/game_sockets");
        nsp.use(authMiddleware);

        nsp.on("connection", async (socket: socketIO.Socket) => {
            const socketUserContext = new SocketUserContext(socket);
            const user: User = socket.handshake.auth as User;
            console.log(`(GameSockets) Client connected :: ${JSON.stringify(user)}`);
            
            if (socketUserContexts[user.userName] != undefined)
            {
                console.error(`SocketUserContext with userName already exists (userName = ${user.userName})`);
                return;
            }
            socketUserContexts[user.userName] = socketUserContext;

            socket.on("objectSync", (buffer: ArrayBuffer) => {
                const bufferState = { view: new Uint8Array(buffer), index: 0 };
                const params = ObjectSyncParams.decode(bufferState) as ObjectSyncParams;
                RoomManager.updateObjectTransform(socketUserContext, params.objectId, params.transform);
            });
            socket.on("objectMessage", (buffer: ArrayBuffer) => {
                const bufferState = { view: new Uint8Array(buffer), index: 0 };
                const params = ObjectMessageParams.decode(bufferState) as ObjectMessageParams;
                RoomManager.sendObjectMessage(socketUserContext, params);
            });
            socket.on("roomChangeRequest", async (buffer: ArrayBuffer) => {
                const bufferState = { view: new Uint8Array(buffer), index: 0 };
                const params = RoomChangeRequestParams.decode(bufferState) as RoomChangeRequestParams;
                await RoomManager.changeUserRoom(socketUserContext, params.roomID, true);
            });

            socket.on("disconnect", async () => {
                console.log(`(GameSockets) Client disconnected :: ${JSON.stringify(user)}`);

                if (socketUserContexts[user.userName] == undefined)
                {
                    console.error(`SocketUserContext with userName doesn't exist (userName = ${user.userName})`);
                    return;
                }
                delete socketUserContexts[user.userName];

                await RoomManager.changeUserRoom(socketUserContext, undefined, false);
            });

            // A recently connected client should automatically join the default room.
            await RoomManager.changeUserRoom(socketUserContext, "s1", false);
        });

        signalProcessingInterval = setInterval(() => {
            for (const socketUserContext of Object.values(socketUserContexts))
            {
                socketUserContext.processAllPendingSignals();
            }
        }, 200);
    },
}

export default GameSockets;