import socketIO from "socket.io";
import { SocketMiddleware } from "./types/socketMiddleware";
import ObjectMessageParams from "../../shared/object/types/objectMessageParams"
import ObjectSyncParams from "../../shared/object/types/objectSyncParams";
import RoomChangeRequestParams from "../../shared/room/types/roomChangeRequestParams";
import User from "../../shared/user/types/user";
import RoomManager from "../room/roomManager";
import SocketUserContext from "./types/socketUserContext";
import BufferState from "../../shared/networking/types/bufferState";
import UpdateVoxelGridParams from "../../shared/voxel/types/update/updateVoxelGridParams";
import { SIGNAL_BATCH_SEND_INTERVAL } from "../../shared/system/constants";
import SearchDB from "../db/searchDB";
import { RoomTypeEnumMap } from "../../shared/room/types/roomType";

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
                const bufferState = new BufferState(new Uint8Array(buffer));
                const params = ObjectSyncParams.decode(bufferState) as ObjectSyncParams;
                RoomManager.updateObjectTransform(socketUserContext, params.objectId, params.transform);
            });
            socket.on("objectMessage", (buffer: ArrayBuffer) => {
                const bufferState = new BufferState(new Uint8Array(buffer));
                const params = ObjectMessageParams.decode(bufferState) as ObjectMessageParams;
                RoomManager.sendObjectMessage(socketUserContext, params);
            });
            socket.on("updateVoxelGrid", (buffer: ArrayBuffer) => {
                const bufferState = new BufferState(new Uint8Array(buffer));
                const params = UpdateVoxelGridParams.decode(bufferState) as UpdateVoxelGridParams;
                RoomManager.updateVoxelGrid(socketUserContext, params);
            });
            socket.on("roomChangeRequest", async (buffer: ArrayBuffer) => {
                const bufferState = new BufferState(new Uint8Array(buffer));
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

            // A recently connected client should automatically join the hub.
            const roomSearchResult = await SearchDB.rooms.withRoomType(RoomTypeEnumMap.Hub);
            if (roomSearchResult.success && roomSearchResult.data.length > 0)
            {
                const roomID = roomSearchResult.data[0].roomID;
                await RoomManager.changeUserRoom(socketUserContext, roomID, false);
            }
        });

        signalProcessingInterval = setInterval(() => {
            for (const socketUserContext of Object.values(socketUserContexts))
            {
                socketUserContext.processAllPendingSignals();
            }
        }, SIGNAL_BATCH_SEND_INTERVAL);
    },
}

export default GameSockets;