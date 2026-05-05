/**
 * Server harness: wires up the real server-side modules (ServerRoomManager,
 * ServerUserManager, ServerObjectManager, PhysicsManager) with mocked DB layer
 * so that integration tests exercise real game logic without touching Firestore.
 *
 * Usage:
 *   import { harness } from "./helpers/serverHarness";
 *
 *   beforeEach(() => harness.reset());
 *
 *   const ctx = harness.connectUser();          // auto-generated user
 *   const ctx = harness.connectUser(myUser);     // explicit user
 *   await harness.joinRoom(ctx, "room-1");
 *   await harness.disconnectUser(ctx);
 */

import { vi } from "vitest";
import { resetStores, seedRoom, roomStore, userRoomStateStore } from "./mockDB";

import Room from "../../../src/shared/room/types/room";
import { RoomType, RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";

// ─── Hoisted stores for vi.mock factories ──────────────────────────────────
// vi.mock is hoisted by Vitest. Factory functions must not close over module-
// scope variables, so we use vi.hoisted to share state.

const _roomStore = vi.hoisted(() => {
    const store: { [roomID: string]: { room: any } } = {};
    return store;
});

const _savedGameplayStates = vi.hoisted(() => {
    const states: any[] = [];
    return states;
});

const _userRoomStateStore = vi.hoisted(() => {
    const store: { [compositeId: string]: any } = {};
    return store;
});

const _latencyConfig = vi.hoisted(() => ({
    enabled: false,
    minMs: 0,
    maxMs: 0,
}));

function _randomDelay(): Promise<void>
{
    if (!_latencyConfig.enabled) return Promise.resolve();
    const ms = _latencyConfig.minMs +
        Math.random() * (_latencyConfig.maxMs - _latencyConfig.minMs);
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Apply mocks BEFORE importing real modules ──────────────────────────────

vi.mock("../../../src/server/db/util/dbRoomUtil", () => ({
    default: {
        getRoomContent: vi.fn(async (roomID: string) => {
            if (_latencyConfig.enabled) await _randomDelay();
            const entry = _roomStore[roomID];
            return entry ? entry.room : null;
        }),
        saveRoomContent: vi.fn(async () => {
            if (_latencyConfig.enabled) await _randomDelay();
            return true;
        }),
        deleteRoomContent: vi.fn(async () => true),
        createRoom: vi.fn(async () => ({ success: true, data: [{ id: "room-auto" }] })),
        deleteRoom: vi.fn(async () => true),
        changeRoomTexturePackPath: vi.fn(async () => true),
    },
}));

vi.mock("../../../src/server/db/util/dbSearchUtil", () => ({
    default: {
        rooms: {
            all: vi.fn(async () => ({ success: true, data: [] })),
            withRoomType: vi.fn(async () => ({ success: true, data: [] })),
        },
        users: {
            all: vi.fn(async () => ({ success: true, data: [] })),
            withUserName: vi.fn(async () => ({ success: true, data: [] })),
            withEmail: vi.fn(async () => ({ success: true, data: [] })),
            withUserNameOrEmail: vi.fn(async () => ({ success: true, data: [] })),
        },
    },
}));

vi.mock("../../../src/server/db/util/dbUserUtil", () => ({
    default: {
        findUserById: vi.fn(async () => null),
        saveUserGameplayState: vi.fn(async (state: any) => {
            if (_latencyConfig.enabled) await _randomDelay();
            _savedGameplayStates.push(state);
            return { success: true, data: [] };
        }),
        saveMultipleUsersGameplayState: vi.fn(async (states: any[]) => {
            if (_latencyConfig.enabled) await _randomDelay();
            _savedGameplayStates.push(...states);
        }),
        createUser: vi.fn(async () => ({ success: true, data: [{ id: "user-auto" }] })),
        setUserTutorialStep: vi.fn(async () => ({ success: true, data: [] })),
        deleteStaleGuestsByTier: vi.fn(async () => 0),
        deleteUser: vi.fn(async () => ({ success: true, data: [] })),
        fromDBType: vi.fn((u: any) => u),
        updateLastLogin: vi.fn(async () => {}),
        upgradeGuestToMember: vi.fn(async () => ({ success: true, data: [] })),
    },
}));

vi.mock("../../../src/server/db/util/dbUserRoomStateUtil", () => ({
    default: {
        findByUserAndRoom: vi.fn(async (userID: string, roomID: string) => {
            if (_latencyConfig.enabled) await _randomDelay();
            const compositeId = `${userID}_${roomID}`;
            return _userRoomStateStore[compositeId] ?? null;
        }),
        saveUserRoomState: vi.fn(async (
            userID: string, roomID: string,
            lastX: number, lastY: number, lastZ: number,
            lastDirX: number, lastDirY: number, lastDirZ: number,
            playerMetadata: {[key: string]: string},
        ) => {
            if (_latencyConfig.enabled) await _randomDelay();
            const compositeId = `${userID}_${roomID}`;
            _userRoomStateStore[compositeId] = {
                userID, roomID,
                lastX, lastY, lastZ,
                lastDirX, lastDirY, lastDirZ,
                playerMetadata,
                version: 0,
            };
        }),
        makeCompositeId: (userID: string, roomID: string) => `${userID}_${roomID}`,
    },
}));

vi.mock("../../../src/server/networking/util/addressUtil", () => ({
    default: {
        getErrorPageURL: (name: string) => `/error/${name}`,
        getMyPageURL: () => "/mypage",
        getEnvStaticURL: () => "http://localhost:3000",
        getEnvDynamicURL: () => "http://localhost:3000",
    },
}));

vi.mock("../../../src/server/system/util/latencySimUtil", () => ({
    default: {
        networkLatencyEnabled: false,
        dbLatencyEnabled: false,
        simulateNetworkLatency: async () => {},
        simulateDBLatency: async () => {},
        getConfigSummary: () => "",
    },
}));

vi.mock("../../../src/server/user/util/userCommandUtil", () => ({
    default: {
        handleCommand: vi.fn(async () => {}),
    },
}));

// ─── Now import the real modules ─────────────────────────────────────────────

import { setIsServer } from "../../../src/shared/system/sharedConstants";
setIsServer(); // Must be called before any server module logic runs (e.g. Player canUserAddObject checks IS_SERVER)

import User from "../../../src/shared/user/types/user";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ServerUserManager from "../../../src/server/user/serverUserManager";
import ServerObjectManager from "../../../src/server/object/serverObjectManager";
import SocketUserContext from "../../../src/server/sockets/types/socketUserContext";
import PhysicsManager from "../../../src/shared/physics/physicsManager";
import UserGameplayState from "../../../src/server/user/types/userGameplayState";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import SetObjectTransformSignal from "../../../src/shared/object/types/setObjectTransformSignal";
import SetObjectMetadataSignal from "../../../src/shared/object/types/setObjectMetadataSignal";
import { MockSocket } from "./mockSocket";
import { createMockUser, resetUserCounter, MockUserOverrides } from "./mockUser";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConnectedUser
{
    user: User;
    socket: MockSocket;
    socketUserContext: SocketUserContext;
}

// ─── Internal: keep hoisted stores in sync with mockDB stores ────────────────

function syncRoomStore(): void
{
    for (const k in _roomStore) delete _roomStore[k];
    for (const [k, v] of Object.entries(roomStore))
        _roomStore[k] = v;
}

// ─── Internal: pending initial positions for users ───────────────────────────

const _pendingPositions: {[userID: string]: {
    lastX: number; lastY: number; lastZ: number;
    lastDirX: number; lastDirY: number; lastDirZ: number;
    playerMetadata: {[key: string]: string};
}} = {};

// ─── Harness ─────────────────────────────────────────────────────────────────

export const harness = {
    /**
     * Resets ALL server state (rooms, users, physics, DB stores) to a clean
     * slate. Call this in beforeEach.
     */
    reset(): void
    {
        for (const uid in ServerUserManager.socketUserContexts)
            delete ServerUserManager.socketUserContexts[uid];

        for (const roomID of Object.keys(ServerRoomManager.roomRuntimeMemories))
        {
            if (PhysicsManager.hasRoom(roomID))
                PhysicsManager.unload(roomID);
            delete ServerRoomManager.roomRuntimeMemories[roomID];
            delete ServerRoomManager.socketRoomContexts[roomID];
        }
        for (const uid in ServerRoomManager.currentRoomIDByUserID)
            delete ServerRoomManager.currentRoomIDByUserID[uid];
        ServerUserManager.clearPlayerObjects();

        resetStores();
        resetUserCounter();

        for (const k in _roomStore) delete _roomStore[k];
        for (const k in _userRoomStateStore) delete _userRoomStateStore[k];
        _savedGameplayStates.length = 0;

        for (const k in _pendingPositions) delete _pendingPositions[k];

        _latencyConfig.enabled = false;
        _latencyConfig.minMs = 0;
        _latencyConfig.maxMs = 0;
    },

    /**
     * Seeds a room into the mock DB so that it can be loaded via
     * ServerRoomManager.changeUserRoom.
     */
    seedRoom(
        roomID: string,
        roomType: RoomType = RoomTypeEnumMap.Hub,
    ): Room
    {
        const room = seedRoom(roomID, roomType);
        syncRoomStore();
        return room;
    },

    /**
     * Simulates a user connecting a socket. Returns the context needed to
     * interact with the server.
     */
    connectUser(userOrOverrides?: User | MockUserOverrides): ConnectedUser
    {
        let user: User;
        if (userOrOverrides instanceof User)
        {
            user = userOrOverrides;
        }
        else
        {
            const result = createMockUser(userOrOverrides);
            user = result.user;
            _pendingPositions[user.id] = result.initialPosition;
        }

        const socket = new MockSocket(user);
        const socketUserContext = new SocketUserContext(socket as any);

        ServerUserManager.addUser(socketUserContext);

        return { user, socket, socketUserContext };
    },

    /**
     * Moves a connected user into a room (loads the room if needed).
     * Seeds the user's per-room state from pending positions before joining.
     */
    async joinRoom(ctx: ConnectedUser, roomID: string): Promise<boolean>
    {
        const pending = _pendingPositions[ctx.user.id];
        if (pending)
        {
            const compositeId = `${ctx.user.id}_${roomID}`;
            _userRoomStateStore[compositeId] = {
                userID: ctx.user.id,
                roomID,
                ...pending,
                version: 0,
            };
        }
        return ServerRoomManager.changeUserRoom(ctx.socketUserContext, roomID, false, false);
    },

    /**
     * Simulates user disconnection: removes from room + ServerUserManager.
     */
    async disconnectUser(ctx: ConnectedUser, saveState: boolean = true): Promise<void>
    {
        ServerUserManager.removeUser(ctx.user.id);
        await ServerRoomManager.changeUserRoom(ctx.socketUserContext, undefined, false, saveState);
        ctx.socket.connected = false;
    },

    /**
     * Returns the number of participants in a room, or -1 if the room is not loaded.
     */
    getRoomParticipantCount(roomID: string): number
    {
        const mem = ServerRoomManager.roomRuntimeMemories[roomID];
        if (!mem) return -1;
        return Object.keys(mem.participantUserNameByID).length;
    },

    /**
     * Returns true if a room is currently loaded in memory.
     */
    isRoomLoaded(roomID: string): boolean
    {
        return ServerRoomManager.roomRuntimeMemories[roomID] != undefined;
    },

    /**
     * Reads the current gameplay state for a connected user.
     */
    getGameplayState(ctx: ConnectedUser): UserGameplayState | undefined
    {
        const roomID = ServerRoomManager.currentRoomIDByUserID[ctx.user.id];
        if (!roomID) return undefined;
        const roomMem = ServerRoomManager.roomRuntimeMemories[roomID];
        if (!roomMem) return undefined;
        return ServerUserManager.getUserGameplayState(ctx.socketUserContext, roomMem);
    },

    /**
     * Returns the player object for a user.
     */
    getPlayerObject(userID: string)
    {
        return ServerUserManager.getPlayerObject(userID);
    },

    /**
     * Returns all gameplay states saved via the DB mock.
     */
    get savedGameplayStates(): UserGameplayState[]
    {
        return _savedGameplayStates as UserGameplayState[];
    },

    /**
     * Enables or disables random latency on mocked DB operations.
     */
    setLatency(enabled: boolean, minMs: number = 0, maxMs: number = 5): void
    {
        _latencyConfig.enabled = enabled;
        _latencyConfig.minMs = minMs;
        _latencyConfig.maxMs = maxMs;
    },

    /**
     * Simulates reconnection Case A: new socket connects BEFORE old disconnect fires.
     */
    async reconnectCaseA(oldCtx: ConnectedUser): Promise<ConnectedUser>
    {
        const oldRoomID = ServerRoomManager.currentRoomIDByUserID[oldCtx.user.id];
        const oldRoomMem = oldRoomID ? ServerRoomManager.roomRuntimeMemories[oldRoomID] : undefined;
        const oldGameplayState = oldRoomMem
            ? ServerUserManager.getUserGameplayState(oldCtx.socketUserContext, oldRoomMem)
            : undefined;

        ServerUserManager.removeUser(oldCtx.user.id);
        await ServerRoomManager.changeUserRoom(oldCtx.socketUserContext, undefined, false, true);
        oldCtx.socket.connected = false;

        const { user: newUser } = createMockUser({
            id: oldCtx.user.id,
            userName: oldCtx.user.userName,
            userType: oldCtx.user.userType,
            email: oldCtx.user.email,
        });
        if (oldGameplayState)
            newUser.lastRoomID = oldGameplayState.lastRoomID;

        if (oldGameplayState)
        {
            _pendingPositions[newUser.id] = {
                lastX: oldGameplayState.lastX,
                lastY: oldGameplayState.lastY,
                lastZ: oldGameplayState.lastZ,
                lastDirX: oldGameplayState.lastDirX,
                lastDirY: oldGameplayState.lastDirY,
                lastDirZ: oldGameplayState.lastDirZ,
                playerMetadata: oldGameplayState.playerMetadata,
            };
        }

        const socket = new MockSocket(newUser);
        const socketUserContext = new SocketUserContext(socket as any);
        ServerUserManager.addUser(socketUserContext);

        return { user: newUser, socket, socketUserContext };
    },

    /**
     * Simulates reconnection Case B: old disconnect fires BEFORE new socket connects.
     */
    async reconnectCaseB(oldCtx: ConnectedUser): Promise<ConnectedUser>
    {
        const cachedState = harness.getGameplayState(oldCtx);

        await harness.disconnectUser(oldCtx, true);

        const { user: newUser } = createMockUser({
            id: oldCtx.user.id,
            userName: oldCtx.user.userName,
            userType: oldCtx.user.userType,
            email: oldCtx.user.email,
        });
        if (cachedState)
            newUser.lastRoomID = cachedState.lastRoomID;

        if (cachedState)
        {
            _pendingPositions[newUser.id] = {
                lastX: cachedState.lastX,
                lastY: cachedState.lastY,
                lastZ: cachedState.lastZ,
                lastDirX: cachedState.lastDirX,
                lastDirY: cachedState.lastDirY,
                lastDirZ: cachedState.lastDirZ,
                playerMetadata: cachedState.playerMetadata,
            };
        }

        const socket = new MockSocket(newUser);
        const socketUserContext = new SocketUserContext(socket as any);
        ServerUserManager.addUser(socketUserContext);

        return { user: newUser, socket, socketUserContext };
    },

    /**
     * Simulates a graceful server shutdown.
     */
    async gracefulShutdown(): Promise<void>
    {
        await ServerRoomManager.saveRooms(true);
        await ServerRoomManager.saveAllUserGameplayStates(ServerUserManager.socketUserContexts);

        for (const [userID, ctx] of Object.entries(ServerUserManager.socketUserContexts))
        {
            await ServerRoomManager.changeUserRoom(ctx, undefined, false, false);
            ctx.socket.disconnect(true);
        }

        for (const uid in ServerUserManager.socketUserContexts)
            delete ServerUserManager.socketUserContexts[uid];
    },

    /**
     * Convenience: update a connected user's player object transform via
     * the real ServerObjectManager signal handler.
     */
    updateObjectTransform(ctx: ConnectedUser, newTransform: ObjectTransform): void
    {
        const playerObj = ServerUserManager.getPlayerObject(ctx.user.id);
        if (!playerObj) return;
        const roomID = ServerRoomManager.currentRoomIDByUserID[ctx.user.id];
        if (!roomID) return;
        const signal = new SetObjectTransformSignal(roomID, playerObj.objectId, newTransform, false);
        ServerObjectManager.onSetObjectTransformSignalReceived(ctx.socketUserContext, signal);
    },

    /**
     * Convenience: send an object message (sets SentMessage metadata key=0).
     */
    sendObjectMessage(ctx: ConnectedUser, message: string): void
    {
        const playerObj = ServerUserManager.getPlayerObject(ctx.user.id);
        if (!playerObj) return;
        const roomID = ServerRoomManager.currentRoomIDByUserID[ctx.user.id];
        if (!roomID) return;
        const signal = new SetObjectMetadataSignal(roomID, playerObj.objectId, 0, message);
        ServerObjectManager.onSetObjectMetadataSignalReceived(ctx.socketUserContext, signal);
    },

    getPlayerObjectId(ctx: ConnectedUser): string | undefined
    {
        const playerObj = ServerUserManager.getPlayerObject(ctx.user.id);
        if (!playerObj) return undefined;
        return playerObj.objectId;
    },

    /**
     * Direct access to the underlying modules for advanced assertions.
     */
    ServerRoomManager,
    ServerUserManager,
    ServerObjectManager,
    PhysicsManager,
};
