/**
 * Server harness: wires up the real server-side modules (RoomManager,
 * GameSockets, UserManager, PhysicsManager) with mocked DB layer so that
 * integration tests exercise real game logic without touching Firestore.
 *
 * Usage:
 *   import { harness } from "./helpers/serverHarness";
 *
 *   beforeEach(() => harness.reset());
 *
 *   // Create a user + socket and "connect" them to the game server
 *   const ctx = harness.connectUser();          // auto-generated user
 *   const ctx = harness.connectUser(myUser);     // explicit user
 *
 *   // Put a user into a room
 *   await harness.joinRoom(ctx, "room-1");
 *
 *   // Disconnect a user
 *   await harness.disconnectUser(ctx);
 */

import { vi } from "vitest";
import { resetStores, seedRoom, roomStore, userRoomStateStore } from "./mockDB";

// ─── Shared room store reference for the getRoomContent mock ─────────────────
// We import roomStore above and reference it inside the factory closures.
// Vitest hoists vi.mock calls but the factory functions run lazily, so by the
// time getRoomContent is actually called, the roomStore import is resolved.

import Room from "../../../src/shared/room/types/room";
import { RoomType, RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";

// ─── Apply mocks BEFORE importing real modules ──────────────────────────────
// vi.mock is hoisted by Vitest. Factory functions must not close over module-
// scope variables (Vitest limitation), so we use vi.hoisted to share state.

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

import User from "../../../src/shared/user/types/user";
import RoomManager from "../../../src/server/room/roomManager";
import UserManager from "../../../src/server/user/userManager";
import SocketUserContext from "../../../src/server/sockets/types/socketUserContext";
import PhysicsManager from "../../../src/shared/physics/physicsManager";
import { getUserGameplayState, getPlayerObjectRuntimeMemory, clearPlayerObjectRuntimeMemories } from "../../../src/server/room/util/roomUserUtil";
import UserGameplayState from "../../../src/server/user/types/userGameplayState";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import ObjectMessageParams from "../../../src/shared/object/types/objectMessageParams";
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
    // Clear _roomStore
    for (const k in _roomStore) delete _roomStore[k];
    // Copy from mockDB's roomStore
    for (const [k, v] of Object.entries(roomStore))
        _roomStore[k] = v;
}

// ─── Internal: pending initial positions for users ───────────────────────────
// When connectUser is called with position overrides, we store them here.
// When joinRoom is called, we seed the userRoomStateStore for that user+room.

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
        // Clear UserManager
        for (const uid in UserManager.socketUserContexts)
            delete UserManager.socketUserContexts[uid];

        // Unload all rooms (physics + memory)
        for (const roomID of Object.keys(RoomManager.roomRuntimeMemories))
        {
            if (PhysicsManager.hasRoom(roomID))
                PhysicsManager.unload(roomID);
            delete RoomManager.roomRuntimeMemories[roomID];
            delete RoomManager.socketRoomContexts[roomID];
        }
        for (const uid in RoomManager.currentRoomIDByUserID)
            delete RoomManager.currentRoomIDByUserID[uid];
        clearPlayerObjectRuntimeMemories();

        // Reset in-memory DB stores
        resetStores();
        resetUserCounter();

        // Clear hoisted stores and saved gameplay states
        for (const k in _roomStore) delete _roomStore[k];
        for (const k in _userRoomStateStore) delete _userRoomStateStore[k];
        _savedGameplayStates.length = 0;

        // Clear pending positions
        for (const k in _pendingPositions) delete _pendingPositions[k];

        // Disable latency by default (tests opt in explicitly)
        _latencyConfig.enabled = false;
        _latencyConfig.minMs = 0;
        _latencyConfig.maxMs = 0;
    },

    /**
     * Seeds a room into the mock DB so that it can be loaded via
     * RoomManager.changeUserRoom.
     */
    seedRoom(
        roomID: string,
        roomType: RoomType = RoomTypeEnumMap.Hub,
    ): Room
    {
        const room = seedRoom(roomID, roomType);
        // Sync to the hoisted store so the vi.mock factory can find it
        syncRoomStore();
        return room;
    },

    /**
     * Simulates a user connecting a socket. Returns the context needed to
     * interact with the server.
     *
     * Position overrides (lastX, lastY, lastZ, etc.) are stored as pending
     * initial positions and applied when the user joins a room.
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
            // Store initial position for seeding when joining a room
            _pendingPositions[user.id] = result.initialPosition;
        }

        const socket = new MockSocket(user);
        // SocketUserContext reads user from socket.handshake.auth.user
        const socketUserContext = new SocketUserContext(socket as any);

        UserManager.addUser(socketUserContext);

        return { user, socket, socketUserContext };
    },

    /**
     * Moves a connected user into a room (loads the room if needed).
     * Seeds the user's per-room state from pending positions before joining.
     */
    async joinRoom(ctx: ConnectedUser, roomID: string): Promise<boolean>
    {
        // Seed per-room state from pending initial position
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
        return RoomManager.changeUserRoom(ctx.socketUserContext, roomID, false, false);
    },

    /**
     * Simulates user disconnection: removes from room + UserManager.
     */
    async disconnectUser(ctx: ConnectedUser, saveState: boolean = true): Promise<void>
    {
        UserManager.removeUser(ctx.user.id);
        await RoomManager.changeUserRoom(ctx.socketUserContext, undefined, false, saveState);
        ctx.socket.connected = false;
    },

    /**
     * Returns the number of participants in a room, or -1 if the room is not
     * loaded.
     */
    getRoomParticipantCount(roomID: string): number
    {
        const mem = RoomManager.roomRuntimeMemories[roomID];
        if (!mem) return -1;
        return Object.keys(mem.participantUserIDs).length;
    },

    /**
     * Returns true if a room is currently loaded in memory.
     */
    isRoomLoaded(roomID: string): boolean
    {
        return RoomManager.roomRuntimeMemories[roomID] != undefined;
    },

    /**
     * Reads the current gameplay state for a connected user from the room's
     * runtime memory (same extraction path as disconnect/save).
     */
    getGameplayState(ctx: ConnectedUser): UserGameplayState | undefined
    {
        const roomID = RoomManager.currentRoomIDByUserID[ctx.user.id];
        if (!roomID) return undefined;
        const roomMem = RoomManager.roomRuntimeMemories[roomID];
        if (!roomMem) return undefined;
        return getUserGameplayState(ctx.socketUserContext, roomMem);
    },

    /**
     * Returns the player object's spawn params as seen by other users in
     * the room. This is the data broadcast via `objectSpawnParams` multicast.
     */
    getPlayerObjectInRoom(ctx: ConnectedUser)
    {
        const objMem = getPlayerObjectRuntimeMemory(ctx.user.id);
        if (!objMem) return undefined;
        return objMem.objectSpawnParams;
    },

    /**
     * Returns all gameplay states that were passed to
     * DBUserUtil.saveUserGameplayState (captured by the mock).
     */
    get savedGameplayStates(): UserGameplayState[]
    {
        return _savedGameplayStates as UserGameplayState[];
    },

    /**
     * Enables or disables random latency on mocked DB operations
     * (getRoomContent, saveRoomContent, saveUserGameplayState, etc.).
     * When enabled, each mocked async DB call sleeps for a random
     * duration in [minMs, maxMs] before resolving. This creates
     * non-deterministic interleavings that can expose race conditions.
     *
     * Disabled by default; reset() turns it off.
     */
    setLatency(enabled: boolean, minMs: number = 0, maxMs: number = 5): void
    {
        _latencyConfig.enabled = enabled;
        _latencyConfig.minMs = minMs;
        _latencyConfig.maxMs = maxMs;
    },

    /**
     * Simulates reconnection Case A: a new socket connects BEFORE the old
     * disconnect fires (e.g. page refresh on low-latency).
     *
     * Mirrors the logic in sockets.ts:
     *   1. Captures old session's gameplay state from runtime memory
     *   2. Removes old user and cleans up old room membership
     *   3. Passes cached state to changeUserRoom so the player spawns correctly
     *   4. Registers the new user
     *
     * Returns a new ConnectedUser that has inherited the old session's state.
     */
    async reconnectCaseA(oldCtx: ConnectedUser): Promise<ConnectedUser>
    {
        // Step 1: Capture old state from runtime memory (same as sockets.ts)
        const oldRoomID = RoomManager.currentRoomIDByUserID[oldCtx.user.id];
        const oldRoomMem = oldRoomID ? RoomManager.roomRuntimeMemories[oldRoomID] : undefined;
        const oldGameplayState = oldRoomMem
            ? getUserGameplayState(oldCtx.socketUserContext, oldRoomMem)
            : undefined;

        // Step 2: Remove old user and clean up
        UserManager.removeUser(oldCtx.user.id);
        await RoomManager.changeUserRoom(oldCtx.socketUserContext, undefined, false, true);
        oldCtx.socket.connected = false;

        // Step 3: Create new user (no position fields on User anymore)
        const { user: newUser } = createMockUser({
            id: oldCtx.user.id,
            userName: oldCtx.user.userName,
            userType: oldCtx.user.userType,
            email: oldCtx.user.email,
        });
        if (oldGameplayState)
            newUser.lastRoomID = oldGameplayState.lastRoomID;

        // Store cached gameplay state as pending position for rejoining
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

        // Step 4: Register new connection
        const socket = new MockSocket(newUser);
        const socketUserContext = new SocketUserContext(socket as any);
        UserManager.addUser(socketUserContext);

        return { user: newUser, socket, socketUserContext };
    },

    /**
     * Simulates reconnection Case B: old disconnect fires BEFORE the new
     * socket connects (e.g. high-latency environment).
     *
     * Mirrors the logic in sockets.ts:
     *   1. Old user disconnects (state saved and cached in memory)
     *   2. New socket connects and finds cached state
     *   3. Passes cached state to changeUserRoom for restoration
     *
     * Returns a new ConnectedUser that has inherited the disconnected state.
     */
    async reconnectCaseB(oldCtx: ConnectedUser): Promise<ConnectedUser>
    {
        // Step 1: Capture state before disconnect
        const cachedState = harness.getGameplayState(oldCtx);

        // Step 2: Old user fully disconnects (state saved to DB mock)
        await harness.disconnectUser(oldCtx, true);

        // Step 3: New socket connects
        const { user: newUser } = createMockUser({
            id: oldCtx.user.id,
            userName: oldCtx.user.userName,
            userType: oldCtx.user.userType,
            email: oldCtx.user.email,
        });
        if (cachedState)
            newUser.lastRoomID = cachedState.lastRoomID;

        // Store cached gameplay state as pending position for rejoining
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

        // Step 4: Register new connection
        const socket = new MockSocket(newUser);
        const socketUserContext = new SocketUserContext(socket as any);
        UserManager.addUser(socketUserContext);

        return { user: newUser, socket, socketUserContext };
    },

    /**
     * Simulates a graceful server shutdown: saves all rooms (forced), saves
     * all user gameplay states, then disconnects all users.
     *
     * Mirrors the logic in server.ts gracefulShutdown (lines 133-158).
     */
    async gracefulShutdown(): Promise<void>
    {
        await RoomManager.saveRooms(true);
        await RoomManager.saveAllUserGameplayStates(UserManager.socketUserContexts);

        for (const [userID, ctx] of Object.entries(UserManager.socketUserContexts))
        {
            await RoomManager.changeUserRoom(ctx, undefined, false, false);
            ctx.socket.disconnect(true);
        }

        for (const uid in UserManager.socketUserContexts)
            delete UserManager.socketUserContexts[uid];
    },

    /**
     * Convenience wrapper: update a connected user's object transform.
     */
    updateObjectTransform(ctx: ConnectedUser, newTransform: ObjectTransform): void
    {
        const playerObjectId = this.getPlayerObjectId(ctx);
        if (!playerObjectId) return;
        RoomManager.updateObjectTransform(ctx.socketUserContext, playerObjectId, newTransform);
    },

    /**
     * Convenience wrapper: send an object message (sets SentMessage metadata).
     */
    sendObjectMessage(ctx: ConnectedUser, message: string): void
    {
        const playerObjectId = this.getPlayerObjectId(ctx);
        if (!playerObjectId) return;
        RoomManager.sendObjectMessage(
            ctx.socketUserContext,
            new ObjectMessageParams(playerObjectId, message)
        );
    },

    getPlayerObjectId(ctx: ConnectedUser): string | undefined
    {
        const playerMem = getPlayerObjectRuntimeMemory(ctx.user.id);
        if (!playerMem) return undefined;
        return playerMem.objectSpawnParams.objectId;
    },

    /**
     * Direct access to the underlying modules for advanced assertions.
     */
    getPlayerObjectRuntimeMemory,
    RoomManager,
    UserManager,
    PhysicsManager,
};
