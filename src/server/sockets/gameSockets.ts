import socketIO from "socket.io";
import { SocketMiddleware } from "./types/socketMiddleware";
import ObjectMessageParams from "../../shared/object/types/objectMessageParams"
import ObjectSyncParams from "../../shared/object/types/objectSyncParams";
import RoomChangeRequestParams from "../../shared/room/types/roomChangeRequestParams";
import User from "../../shared/user/types/user";
import RoomManager from "../room/roomManager";
import { getUserGameplayState } from "../room/util/roomUserUtil";
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
                // This happens when the user refreshes the page: the new socket
                // connects before the old one's "disconnect" event fires.
                // Capture the old session's gameplay state, clean it up, and
                // update the new socket's user object so the player spawns at
                // the correct position.
                console.warn(`(GameSockets) Replacing existing socket for userID = ${user.id} (likely page refresh)`);
                const oldContext = socketUserContexts[user.id];
                const oldRoomID = RoomManager.currentRoomIDByUserID[user.id];
                const oldRoomMemory = oldRoomID ? RoomManager.roomRuntimeMemories[oldRoomID] : undefined;
                const oldGameplayState = oldRoomMemory ? getUserGameplayState(oldContext, oldRoomMemory) : undefined;

                delete socketUserContexts[user.id];
                await RoomManager.changeUserRoom(oldContext, undefined, false, true);
                oldContext.socket.disconnect(true);

                // The "user" object that was passed in from the socket handshake is the result of the DB query which was executed by the Express (HTTP) middleware during the page load ("/mypage").
                // This "user" object contains the gameplay state from the last moment at which the user was saved in the DB.
                // This DB-originated gameplay state is outdated in case of page refresh, since a socket disconnection (which saves the gameplay state to the DB) does not precede the page load.
                // Thus, this "user" object's gameplay state data should be overwritten by the current runtime memory's latest gameplay state.
                // (Saving of this new gameplay state will be done by the "changeUserRoom" function call shown above.)
                if (oldGameplayState)
                {
                    user.lastRoomID = oldGameplayState.lastRoomID;
                    user.lastX = oldGameplayState.lastX;
                    user.lastY = oldGameplayState.lastY;
                    user.lastZ = oldGameplayState.lastZ;
                    user.lastDirX = oldGameplayState.lastDirX;
                    user.lastDirY = oldGameplayState.lastDirY;
                    user.lastDirZ = oldGameplayState.lastDirZ;
                    user.playerMetadata = oldGameplayState.playerMetadata;
                }
            }
            socketUserContexts[user.id] = socketUserContext;

            socketUserContext.onReceivedSignalFromUser("objectSyncParams", (buffer: ArrayBuffer) => {
                const bufferState = new BufferState(new Uint8Array(buffer));
                const params = ObjectSyncParams.decode(bufferState) as ObjectSyncParams;
                RoomManager.updateObjectTransform(socketUserContext, params.objectId, params.transform);
            });

            socketUserContext.onReceivedSignalFromUser("objectMessageParams", (buffer: ArrayBuffer) => {
                const bufferState = new BufferState(new Uint8Array(buffer));
                const params = ObjectMessageParams.decode(bufferState) as ObjectMessageParams;
                RoomManager.sendObjectMessage(socketUserContext, params);
            });

            socketUserContext.onReceivedSignalFromUser("userCommandParams", async (buffer: ArrayBuffer) => {
                const bufferState = new BufferState(new Uint8Array(buffer));
                const params = UserCommandParams.decode(bufferState) as UserCommandParams;
                await UserCommandUtil.handleCommand(user, params);
            });

            socketUserContext.onReceivedSignalFromUser("updateVoxelGridParams", (buffer: ArrayBuffer) => {
                const bufferState = new BufferState(new Uint8Array(buffer));
                const params = UpdateVoxelGridParams.decode(bufferState) as UpdateVoxelGridParams;
                RoomManager.updateVoxelGrid(socketUserContext, params);
            });

            socketUserContext.onReceivedSignalFromUser("roomChangeRequestParams", async (buffer: ArrayBuffer) => {
                const bufferState = new BufferState(new Uint8Array(buffer));
                const params = RoomChangeRequestParams.decode(bufferState) as RoomChangeRequestParams;
                await RoomManager.changeUserRoom(socketUserContext, params.roomID, true, false);
            });

            socket.on("disconnect", async () => {
                console.log(`(GameSockets) Client disconnected :: ${JSON.stringify(user)}`);

                if (socketUserContexts[user.id] == undefined)
                {
                    console.warn(`SocketUserContext with userID doesn't exist (userID = ${user.id})`);
                    return;
                }
                delete socketUserContexts[user.id];
                await RoomManager.changeUserRoom(socketUserContext, undefined, false, true);
            });

            // Each connected client (user) should automatically join a room.
            // If the user has lastRoomID,
            //    -> The user should join the room whose ID is lastRoomID.
            // If the user either has no lastRoomID or doesn't have a lastRoomID which corresponds to an existing room,
            //    -> The user should join the "hub" room.
            if (!(await RoomManager.changeUserRoom(socketUserContext, user.lastRoomID, false, false)))
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
                    await RoomManager.changeUserRoom(socketUserContext, hubRoomID, false, false);
            }
        });

        signalProcessingInterval = setInterval(() => {
            for (const socketUserContext of Object.values(socketUserContexts))
            {
                socketUserContext.processAllPendingSignalsToUser();
            }
        }, SIGNAL_BATCH_SEND_INTERVAL);

        // Periodically remove users whose socket connection is no longer alive.
        // This catches edge cases where the "disconnect" event fails to fire
        // (e.g., abrupt browser crash with no TCP FIN, or a swallowed error in
        // the disconnect handler).
        setInterval(async () => {
            for (const [userID, ctx] of Object.entries(socketUserContexts))
            {
                if (!ctx.socket.connected)
                {
                    console.warn(`(GameSockets) Stale socket detected, cleaning up :: userID = ${userID}`);
                    delete socketUserContexts[userID];
                    await RoomManager.changeUserRoom(ctx, undefined, false, false);
                }
            }
        }, 30_000);
    },
}

export default GameSockets;