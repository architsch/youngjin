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
import { SIGNAL_BATCH_SEND_INTERVAL } from "../../shared/system/sharedConstants";
import DBSearchUtil from "../db/util/dbSearchUtil";
import { RoomTypeEnumMap } from "../../shared/room/types/roomType";
import UserCommandParams from "../../shared/user/types/userCommandParams";
import UserCommandUtil from "../user/util/userCommandUtil";

let nsp: socketIO.Namespace;
let signalProcessingInterval: NodeJS.Timeout;
const socketUserContexts: {[userID: string]: SocketUserContext} = {};

const GameSockets =
{
    saveAndDisconnectAllUsers: async (): Promise<void> =>
    {
        await RoomManager.saveAllUserGameplayStates(socketUserContexts);

        for (const [userID, socketUserContext] of Object.entries(socketUserContexts))
        {
            await RoomManager.changeUserRoom(socketUserContext, undefined, false, false);
            socketUserContext.socket.disconnect(true);
        }
    },
    init: (io: socketIO.Server, authMiddleware: SocketMiddleware): void =>
    {
        nsp = io.of("/game_sockets");
        nsp.use(authMiddleware);

        nsp.on("connection", async (socket: socketIO.Socket) => {
            const socketUserContext = new SocketUserContext(socket);
            const user: User = socket.handshake.auth as User;
            console.log(`(GameSockets) Client connected :: ${JSON.stringify(user)}`);
            
            if (socketUserContexts[user.id] != undefined)
            {
                console.error(`SocketUserContext with userID already exists (userID = ${user.id})`);
                return;
            }
            socketUserContexts[user.id] = socketUserContext;

            socketUserContext.onReceivedSignalFromUser("objectSync", (buffer: ArrayBuffer) => {
                const bufferState = new BufferState(new Uint8Array(buffer));
                const params = ObjectSyncParams.decode(bufferState) as ObjectSyncParams;
                RoomManager.updateObjectTransform(socketUserContext, params.objectId, params.transform);
            });
            socketUserContext.onReceivedSignalFromUser("objectMessage", (buffer: ArrayBuffer) => {
                const bufferState = new BufferState(new Uint8Array(buffer));
                const params = ObjectMessageParams.decode(bufferState) as ObjectMessageParams;
                RoomManager.sendObjectMessage(socketUserContext, params);
            }, 1000);
            socketUserContext.onReceivedSignalFromUser("userCommand", async (buffer: ArrayBuffer) => {
                const bufferState = new BufferState(new Uint8Array(buffer));
                const params = UserCommandParams.decode(bufferState) as UserCommandParams;
                await UserCommandUtil.handleCommand(user, params);
            }, 1000);
            socketUserContext.onReceivedSignalFromUser("updateVoxelGrid", (buffer: ArrayBuffer) => {
                const bufferState = new BufferState(new Uint8Array(buffer));
                const params = UpdateVoxelGridParams.decode(bufferState) as UpdateVoxelGridParams;
                RoomManager.updateVoxelGrid(socketUserContext, params);
            });
            socketUserContext.onReceivedSignalFromUser("roomChangeRequest", async (buffer: ArrayBuffer) => {
                const bufferState = new BufferState(new Uint8Array(buffer));
                const params = RoomChangeRequestParams.decode(bufferState) as RoomChangeRequestParams;
                await RoomManager.changeUserRoom(socketUserContext, params.roomID, true);
            }, 2000);

            socket.on("disconnect", async () => {
                console.log(`(GameSockets) Client disconnected :: ${JSON.stringify(user)}`);

                if (socketUserContexts[user.id] == undefined)
                {
                    console.error(`SocketUserContext with userID doesn't exist (userID = ${user.id})`);
                    return;
                }
                delete socketUserContexts[user.id];

                await RoomManager.changeUserRoom(socketUserContext, undefined, false);
            });

            // Each connected client (user) should automatically join a room.
            // If the user has lastRoomID,
            //    -> The user should join the room whose ID is lastRoomID.
            // If the user either has no lastRoomID or doesn't have a lastRoomID which corresponds to an existing room,
            //    -> The user should join the "hub" room.
            if (!(await RoomManager.changeUserRoom(socketUserContext, user.lastRoomID, false)))
            {
                // Check in-memory rooms first to avoid a Firestore query
                let hubRoomID: string | undefined;
                for (const [roomID, mem] of Object.entries(RoomManager.roomRuntimeMemories))
                {
                    if (mem.room.roomType === RoomTypeEnumMap.Hub)
                    {
                        hubRoomID = roomID;
                        break;
                    }
                }
                if (!hubRoomID)
                {
                    const roomSearchResult = await DBSearchUtil.rooms.withRoomType(RoomTypeEnumMap.Hub);
                    if (roomSearchResult.success && roomSearchResult.data.length > 0)
                        hubRoomID = roomSearchResult.data[0].id as string;
                }
                if (hubRoomID)
                    await RoomManager.changeUserRoom(socketUserContext, hubRoomID, false);
            }
        });

        signalProcessingInterval = setInterval(() => {
            for (const socketUserContext of Object.values(socketUserContexts))
            {
                socketUserContext.processAllPendingSignalsToUser();
            }
        }, SIGNAL_BATCH_SEND_INTERVAL);
    },
}

export default GameSockets;