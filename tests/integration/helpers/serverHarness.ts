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
import { resetStores, seedRoom, roomStore } from "./mockDB";

import Room from "../../../src/shared/room/types/room";
import { RoomType, RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";

// ─── Hoisted stores for vi.mock factories ──────────────────────────────────
// vi.mock is hoisted by Vitest. Factory functions must not close over module-
// scope variables, so we use vi.hoisted to share state.

const _roomStore = vi.hoisted(() => {
    const store: { [roomID: string]: { room: any; editors: any[]; ownerUserID: string; ownerUserName: string; roomType: number; texturePackPath: string } } = {};
    return store;
});

const _savedMetadataRecords = vi.hoisted(() => {
    const records: any[] = [];
    return records;
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
        getDBRoom: vi.fn(async (roomID: string) => {
            if (_latencyConfig.enabled) await _randomDelay();
            const entry = _roomStore[roomID];
            if (!entry) return null;
            return {
                id: roomID,
                version: 2,
                roomType: entry.roomType,
                ownerUserID: entry.ownerUserID,
                ownerUserName: entry.ownerUserName,
                texturePackPath: entry.texturePackPath,
                editors: entry.editors,
            };
        }),
        saveRoomContent: vi.fn(async () => {
            if (_latencyConfig.enabled) await _randomDelay();
            return true;
        }),
        deleteRoomContent: vi.fn(async () => true),
        createRoom: vi.fn(async () => ({ success: true, data: [{ id: "room-auto" }] })),
        deleteRoom: vi.fn(async () => true),
        changeRoomTexturePackPath: vi.fn(async () => true),
        setEditors: vi.fn(async (roomID: string, editors: any[]) => {
            if (_latencyConfig.enabled) await _randomDelay();
            const entry = _roomStore[roomID];
            if (!entry) return false;
            entry.editors = editors;
            return true;
        }),
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

const _userStore = vi.hoisted(() => {
    const store: { [userID: string]: any } = {};
    return store;
});

vi.mock("../../../src/server/db/util/dbUserUtil", () => ({
    default: {
        findUserById: vi.fn(async (userID: string) => {
            if (_latencyConfig.enabled) await _randomDelay();
            return _userStore[userID] ?? null;
        }),
        setLastRoomID: vi.fn(async (userID: string, roomID: string) => {
            if (_latencyConfig.enabled) await _randomDelay();
            const u = _userStore[userID];
            if (u) u.lastRoomID = roomID;
        }),
        savePlayerMetadata: vi.fn(async (userID: string, playerMetadata: any) => {
            if (_latencyConfig.enabled) await _randomDelay();
            _savedMetadataRecords.push({ userID, playerMetadata });
            const u = _userStore[userID];
            if (u)
                u.playerMetadata = playerMetadata;
        }),
        saveMultipleUsersPlayerMetadata: vi.fn(async (updates: any[]) => {
            if (_latencyConfig.enabled) await _randomDelay();
            _savedMetadataRecords.push(...updates);
            for (const update of updates)
            {
                const u = _userStore[update.userID];
                if (u)
                    u.playerMetadata = update.playerMetadata;
            }
        }),
        createUser: vi.fn(async () => ({ success: true, data: [{ id: "user-auto" }] })),
        setUserTutorialStep: vi.fn(async () => ({ success: true, data: [] })),
        deleteStaleGuestsByTier: vi.fn(async () => 0),
        deleteUser: vi.fn(async () => ({ success: true, data: [] })),
        fromDBType: vi.fn((u: any) => u),
        updateLastLogin: vi.fn(async () => {}),
        upgradeGuestToMember: vi.fn(async () => ({ success: true, data: [] })),
        setOwnedRoomID: vi.fn(async (userID: string, roomID: string) => {
            const u = _userStore[userID];
            if (u) u.ownedRoomID = roomID;
            return { success: true, data: [] };
        }),
    },
}));

vi.mock("../../../src/server/networking/util/addressUtil", () => ({
    default: {
        getErrorPageURL: (name: string) => `/error/${name}`,
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
    {
        _roomStore[k] = {
            room: v.room,
            editors: v.editors,
            ownerUserID: v.ownerUserID,
            ownerUserName: v.ownerUserName,
            roomType: v.roomType,
            texturePackPath: v.texturePackPath,
        };
    }
}

// ─── Internal: pending initial metadata for users ────────────────────────────
// Tests sometimes need to seed playerMetadata before joining a room.

const _pendingMetadata: {[userID: string]: {[key: string]: string}} = {};

// Builds and registers a fresh socket/context for a user reconnecting under the
// same userID. The previous session's playerMetadata is bridged via
// ServerUserManager.recentDisconnectMetadata (populated by the disconnect path),
// which the subsequent joinRoom consumes — so the new context just needs to exist.
function reconnectSocket(oldCtx: ConnectedUser): ConnectedUser
{
    const { user: newUser } = createMockUser({
        id: oldCtx.user.id,
        userName: oldCtx.user.userName,
        userType: oldCtx.user.userType,
        email: oldCtx.user.email,
    });
    const socket = new MockSocket(newUser);
    const socketUserContext = new SocketUserContext(socket as any);
    ServerUserManager.addUser(socketUserContext);
    return { user: newUser, socket, socketUserContext };
}

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
        for (const roomID in ServerRoomManager.editorsByRoomID)
            delete ServerRoomManager.editorsByRoomID[roomID];
        ServerUserManager.clearPlayerObjects();

        resetStores();
        resetUserCounter();

        for (const k in _roomStore) delete _roomStore[k];
        for (const k in _userStore) delete _userStore[k];
        _savedMetadataRecords.length = 0;

        for (const k in _pendingMetadata) delete _pendingMetadata[k];

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
     * Direct in-memory write into the room's editor list. Lets tests stage an
     * editor entry without going through the API route. Affects both DB store
     * and (if loaded) the ServerRoomManager in-memory cache.
     */
    addEditor(roomID: string, editor: { userID: string; userName: string; email: string }): void
    {
        const stored = roomStore[roomID];
        if (stored && !stored.editors.some(e => e.userID === editor.userID))
            stored.editors.push(editor);
        syncRoomStore();
        const inMem = ServerRoomManager.editorsByRoomID[roomID];
        if (inMem && !inMem.some(e => e.userID === editor.userID))
            inMem.push(editor);
    },

    /**
     * Simulates a user connecting a socket. Returns the context needed to
     * interact with the server.
     */
    connectUser(userOrOverrides?: User | MockUserOverrides): ConnectedUser
    {
        let user: User;
        let playerMetadata: {[key: string]: string} = {};
        if (userOrOverrides instanceof User)
        {
            user = userOrOverrides;
        }
        else
        {
            const result = createMockUser(userOrOverrides);
            user = result.user;
            playerMetadata = result.playerMetadata;
        }
        _pendingMetadata[user.id] = playerMetadata;
        _userStore[user.id] = {
            id: user.id,
            userName: user.userName,
            userType: user.userType,
            email: user.email,
            tutorialStep: user.tutorialStep,
            lastRoomID: user.lastRoomID,
            ownedRoomID: user.ownedRoomID,
            playerMetadata,
            version: 1,
        };

        const socket = new MockSocket(user);
        const socketUserContext = new SocketUserContext(socket as any);

        ServerUserManager.addUser(socketUserContext);

        return { user, socket, socketUserContext };
    },

    /**
     * Moves a connected user into a room (loads the room if needed).
     * Seeds the user's playerMetadata on DBUser before joining so the server
     * reads the latest value from the mocked DB.
     */
    async joinRoom(ctx: ConnectedUser, roomID: string): Promise<boolean>
    {
        // Player metadata is per-user (stored on DBUser), so it must be present in the
        // user store before changeUserRoom reads it.
        const pending = _pendingMetadata[ctx.user.id];
        if (pending && _userStore[ctx.user.id])
            _userStore[ctx.user.id].playerMetadata = pending;
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
     * Returns the player object for a user.
     */
    getPlayerObject(userID: string)
    {
        return ServerUserManager.getPlayerObject(userID);
    },

    /**
     * Returns the live player metadata snapshot for a connected user (read from
     * the live player object), or undefined if the user isn't in a room.
     */
    getPlayerMetadata(userID: string): {[key: string]: string} | undefined
    {
        return ServerUserManager.getPlayerMetadata(userID);
    },

    /**
     * Returns true if the in-memory recentDisconnectMetadata buffer currently
     * holds an entry for this user.
     */
    hasRecentDisconnectMetadata(userID: string): boolean
    {
        return ServerUserManager.recentDisconnectMetadata[userID] != undefined;
    },

    /**
     * Returns all player-metadata writes captured by the mocked DBUserUtil.
     */
    get savedPlayerMetadataRecords(): Array<{userID: string; playerMetadata: {[key: string]: string}}>
    {
        return _savedMetadataRecords;
    },

    /**
     * Returns the lastRoomID currently stored in the mocked DBUser for the given user.
     */
    getStoredLastRoomID(userID: string): string | undefined
    {
        return _userStore[userID]?.lastRoomID;
    },

    /**
     * Returns the playerMetadata currently stored in the mocked DBUser for the given user.
     */
    getStoredPlayerMetadata(userID: string): {[key: string]: string} | undefined
    {
        return _userStore[userID]?.playerMetadata;
    },

    /**
     * Returns the editors list currently stored in the mocked DBRoom for the given room.
     */
    getStoredEditors(roomID: string): Array<{userID: string; userName: string; email: string}>
    {
        return _roomStore[roomID]?.editors ?? [];
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
     *
     * Mirrors the real SocketsServer flow: the new connection proactively evicts the
     * still-registered old socket via changeUserRoom, whose removeUserFromRoom
     * snapshots playerMetadata into ServerUserManager.recentDisconnectMetadata. The
     * subsequent joinRoom (on the returned context) consumes that snapshot — no
     * separate metadata plumbing required.
     */
    async reconnectCaseA(oldCtx: ConnectedUser): Promise<ConnectedUser>
    {
        ServerUserManager.removeUser(oldCtx.user.id);
        await ServerRoomManager.changeUserRoom(oldCtx.socketUserContext, undefined, false, true);
        oldCtx.socket.connected = false;

        return reconnectSocket(oldCtx);
    },

    /**
     * Simulates reconnection Case B: old disconnect fires BEFORE new socket connects.
     *
     * The disconnect path populates ServerUserManager.recentDisconnectMetadata
     * synchronously; the subsequent joinRoom (on the returned context) consumes it,
     * exactly as in Case A — the two orderings converge on the same buffer.
     */
    async reconnectCaseB(oldCtx: ConnectedUser): Promise<ConnectedUser>
    {
        await harness.disconnectUser(oldCtx, true);

        return reconnectSocket(oldCtx);
    },

    /**
     * Simulates a graceful server shutdown.
     */
    async gracefulShutdown(): Promise<void>
    {
        await ServerRoomManager.saveRooms(true);
        await ServerRoomManager.saveAllUsersPlayerMetadata(ServerUserManager.socketUserContexts);

        for (const [_userID, ctx] of Object.entries(ServerUserManager.socketUserContexts))
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
