/**
 * Wires the real server modules (ServerRoomManager, ServerUserManager, ServerObjectManager,
 * PhysicsManager) to a mocked DB (see @docs/testing/integration/framework.md).
 */

import { vi } from "vitest";
import { resetStores, seedRoom, roomStore } from "./mockDB";
import DBRoomVersionMigration from "../../../src/server/db/types/versionMigration/dbRoomVersionMigration";

import Room from "../../../src/shared/room/types/room";
import RoomPrefsUtil from "../../../src/shared/room/util/roomPrefsUtil";
import { RoomType, RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";

// ─── Hoisted stores for vi.mock factories ──────────────────────────────────
// vi.mock factories are hoisted and can't close over module scope, hence vi.hoisted.

const _roomStore = vi.hoisted(() => {
    const store: { [roomID: string]: { room: any; ownerUserID: string; ownerUserName: string; roomType: number; texturePackPath: string; prefs: string } } = {};
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

// Serial number for rooms created by the mocked DBRoomUtil.createRoom (e.g. auto-opened hubs).
const _autoRoomCounter = vi.hoisted(() => ({ value: 0 }));

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
                // As in mockDB: the real util hands back an already-migrated row.
                version: DBRoomVersionMigration.length,
                roomName: entry.room?.roomName ?? "",
                roomType: entry.roomType,
                ownerUserID: entry.ownerUserID,
                ownerUserName: entry.ownerUserName,
                texturePackPath: entry.texturePackPath,
                prefs: entry.prefs,
            };
        }),
        saveRoomContent: vi.fn(async () => {
            if (_latencyConfig.enabled) await _randomDelay();
            return true;
        }),
        deleteRoomContent: vi.fn(async () => true),
        // Generates a real, loadable room, so on-demand room creation (hubs) works end to end.
        createRoom: vi.fn(async (roomName: string, roomType: number,
            ownerUserID: string, ownerUserName: string) => {
            if (_latencyConfig.enabled) await _randomDelay();
            const { seedRoom: seedRoomInStore } = await import("./mockDB");
            const roomID = `room-auto-${++_autoRoomCounter.value}`;
            const room = seedRoomInStore(roomID, roomType);
            room.roomName = roomName;
            _roomStore[roomID] = { room, ownerUserID, ownerUserName, roomType,
                texturePackPath: room.texturePackPath, prefs: room.prefs };
            return { success: true, data: [{ id: roomID }] };
        }),
        deleteRoom: vi.fn(async () => true),
        changeRoomTexturePackPath: vi.fn(async () => true),
        changeRoomPrefs: vi.fn(async (room: any, newPrefs: string) => {
            const entry = _roomStore[room.id];
            if (entry)
            {
                entry.prefs = newPrefs;
                entry.room.prefs = newPrefs;
            }
            return true;
        }),
    },
}));

vi.mock("../../../src/server/db/util/dbSearchUtil", () => ({
    default: {
        rooms: {
            all: vi.fn(async () => ({ success: true, data: [] })),
            withRoomType: vi.fn(async (roomType: number) => ({
                success: true,
                data: Object.entries(_roomStore)
                    .filter(([, entry]) => entry.roomType === roomType)
                    .map(([roomID, entry]) => ({ id: roomID, roomType: entry.roomType,
                        prefs: entry.prefs })),
            })),
            withRoomNameAndType: vi.fn(async (roomName: string, roomType: number) => ({
                success: true,
                data: Object.entries(_roomStore)
                    .filter(([, entry]) => entry.room?.roomName === roomName && entry.roomType === roomType)
                    .map(([roomID, entry]) => ({ id: roomID, roomType: entry.roomType })),
            })),
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
        lookUpUserById: vi.fn(async (userID: string) => {
            if (_latencyConfig.enabled) await _randomDelay();
            const user = _userStore[userID];
            return { success: true, data: user ? [user] : [] };
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
        setSinglePlayerMode: vi.fn(async () => ({ success: true, data: [] })),
        setFTUE: vi.fn(async (userID: string, ftue: string) => {
            if (_latencyConfig.enabled) await _randomDelay();
            const u = _userStore[userID];
            if (u) u.ftue = ftue;
            return { success: true, data: [] };
        }),
        deleteStaleGuestsByTier: vi.fn(async () => 0),
        deleteUser: vi.fn(async () => ({ success: true, data: [] })),
        fromDBType: vi.fn((u: any) => {
            // Mirrors fromDBType's "" default for a missing FTUE record (in place).
            u.ftue = u.ftue ?? "";
            return u;
        }),
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
        // Must match the real entry point name, or harness user commands fail instead of no-opping.
        onUserCommandSignalReceived: vi.fn(async () => {}),
    },
}));

// ─── Now import the real modules ─────────────────────────────────────────────

import { setIsServer } from "../../../src/shared/system/sharedConstants";
setIsServer(); // Must be called before any server module logic runs (e.g. Player canUserAddObject checks IS_SERVER)

import User from "../../../src/shared/user/types/user";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ServerUserManager from "../../../src/server/user/serverUserManager";
import ServerObjectManager from "../../../src/server/object/serverObjectManager";
import RoomPickerUtil from "../../../src/server/room/util/roomPickerUtil";
import HubRoomUtil from "../../../src/server/room/util/hubRoomUtil";
import UserRoomChangeResult from "../../../src/server/room/types/userRoomChangeResult";
import SocketUserContext from "../../../src/server/sockets/types/socketUserContext";
import DBUserVersionMigration from "../../../src/server/db/types/versionMigration/dbUserVersionMigration";
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
            ownerUserID: v.ownerUserID,
            ownerUserName: v.ownerUserName,
            roomType: v.roomType,
            texturePackPath: v.texturePackPath,
            prefs: v.prefs,
        };
    }
}

// ─── Internal: pending initial metadata for users ────────────────────────────

const _pendingMetadata: {[userID: string]: {[key: string]: string}} = {};

// A fresh socket/context for a reconnecting user; metadata is bridged by
// ServerUserManager.recentDisconnectMetadata when the next joinRoom runs.
function reconnectSocket(oldCtx: ConnectedUser): ConnectedUser
{
    // Rebuilt from DBUser, as the real auth middleware does (so the room picker sees the last room).
    const storedUser = _userStore[oldCtx.user.id];
    const { user: newUser } = createMockUser({
        id: oldCtx.user.id,
        userName: oldCtx.user.userName,
        userType: oldCtx.user.userType,
        email: oldCtx.user.email,
        singlePlayerMode: storedUser?.singlePlayerMode ?? oldCtx.user.singlePlayerMode,
        lastRoomID: storedUser?.lastRoomID ?? oldCtx.user.lastRoomID,
        // Ownership persists across reconnects.
        ownedRoomID: storedUser?.ownedRoomID ?? oldCtx.user.ownedRoomID,
    });
    const socket = new MockSocket(newUser);
    const socketUserContext = new SocketUserContext(socket as any);
    ServerUserManager.addUser(socketUserContext);
    return { user: newUser, socket, socketUserContext };
}

// ─── Harness ─────────────────────────────────────────────────────────────────

export const harness = {
    /** Resets all server state (rooms, users, physics, DB stores). Call in beforeEach. */
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

        for (const hubID in HubRoomUtil.initialJoinPriorityByHubRoomID)
            delete HubRoomUtil.initialJoinPriorityByHubRoomID[hubID];

        resetStores();
        resetUserCounter();

        for (const k in _roomStore) delete _roomStore[k];
        for (const k in _userStore) delete _userStore[k];
        _savedMetadataRecords.length = 0;
        _autoRoomCounter.value = 0;

        for (const k in _pendingMetadata) delete _pendingMetadata[k];

        _latencyConfig.enabled = false;
        _latencyConfig.minMs = 0;
        _latencyConfig.maxMs = 0;
    },

    /** Seeds a room into the mock DB. */
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
     * Seeds a hub and makes the balancer aware of it, as HubRoomUtil does at startup. A stated join
     * priority is written into the hub's stored prefs first, the way an admin's edit would leave it.
     */
    seedHub(hubID: string, initialJoinPriority?: number): Room
    {
        const room = harness.seedRoom(hubID, RoomTypeEnumMap.Hub);
        if (initialJoinPriority != undefined)
        {
            const prefs = RoomPrefsUtil.decode(room.prefs);
            prefs.initialJoinPriority = initialJoinPriority;
            room.prefs = RoomPrefsUtil.encode(prefs);
            roomStore[hubID].prefs = room.prefs;
            syncRoomStore();
        }
        HubRoomUtil.registerHub(hubID, room.prefs);
        return room;
    },

    /** An admin moving a hub in the order, along the path the room API takes (a prefs change). */
    async changeHubInitialJoinPriority(hubID: string, initialJoinPriority: number): Promise<boolean>
    {
        const room = roomStore[hubID].room;
        const prefs = RoomPrefsUtil.decode(room.prefs);
        prefs.initialJoinPriority = initialJoinPriority;
        return await ServerRoomManager.changeRoomPrefs(room, RoomPrefsUtil.encode(prefs));
    },

    /** Simulates a socket connection; returns the user's context. */
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
            singlePlayerMode: user.singlePlayerMode,
            lastRoomID: user.lastRoomID,
            ownedRoomID: user.ownedRoomID,
            ftue: user.ftue,
            playerMetadata,
            // Derived from the migration list, so new migrations don't leave it stale.
            version: DBUserVersionMigration.length,
        };

        const socket = new MockSocket(user);
        const socketUserContext = new SocketUserContext(socket as any);

        ServerUserManager.addUser(socketUserContext);

        return { user, socket, socketUserContext };
    },

    /**
     * Moves a user into a room (loading it if needed), seeding pending playerMetadata first.
     * allowFallback: a full destination reroutes to a hub instead of rejecting.
     */
    async joinRoom(ctx: ConnectedUser, roomID: string, allowFallback: boolean = false): Promise<UserRoomChangeResult>
    {
        // Metadata must be in the user store before changeUserRoom reads it.
        const pending = _pendingMetadata[ctx.user.id];
        if (pending && _userStore[ctx.user.id])
            _userStore[ctx.user.id].playerMetadata = pending;
        return ServerRoomManager.changeUserRoom(ctx.socketUserContext, roomID, false, false, allowFallback);
    },

    /**
     * Mirrors SocketsServer on connect: RoomPickerUtil picks the destination, joins with fallback, and
     * reports refusals. Use instead of joinRoom when the destination itself is under test.
     */
    async appStartJoin(ctx: ConnectedUser): Promise<UserRoomChangeResult>
    {
        const pending = _pendingMetadata[ctx.user.id];
        if (pending && _userStore[ctx.user.id])
            _userStore[ctx.user.id].playerMetadata = pending;

        const roomID = await RoomPickerUtil.pickBestRoomID(ctx.socketUserContext, "appStart");
        const result = await ServerRoomManager.changeUserRoom(ctx.socketUserContext, roomID,
            false, false, /*allowFallback*/ true);
        ServerRoomManager.notifyRoomChangeRejection(ctx.socketUserContext, result);
        return result;
    },

    /** Disconnects a user (room removal + ServerUserManager). */
    async disconnectUser(ctx: ConnectedUser, saveState: boolean = true): Promise<void>
    {
        ServerUserManager.removeUser(ctx.user.id);
        await ServerRoomManager.changeUserRoom(ctx.socketUserContext, undefined, false, saveState, false);
        ctx.socket.connected = false;
    },

    /** Holds a room in memory with no one in it, so its population can be faked. */
    async loadRoom(roomID: string): Promise<void>
    {
        await ServerRoomManager.loadRoom(roomID);
    },

    /**
     * Fakes a room's participant count without sockets, for population logic. No player objects or
     * contexts exist, so scenarios using it must skip structural invariants.
     */
    setSyntheticRoomPopulation(roomID: string, population: number): void
    {
        const mem = ServerRoomManager.roomRuntimeMemories[roomID];
        if (!mem) throw new Error(`setSyntheticRoomPopulation :: room is not loaded (roomID = ${roomID})`);
        for (const uid of Object.keys(mem.participantUserNameByID))
            delete mem.participantUserNameByID[uid];
        for (let i = 0; i < population; ++i)
            mem.participantUserNameByID[`synthetic-${roomID}-${i}`] = `synthetic-${i}`;
    },

    /** Connects and joins `count` users; returns all contexts (rejected ones are roomless but returned for cleanup). */
    async fillRoomWithUsers(roomID: string, count: number): Promise<ConnectedUser[]>
    {
        const contexts: ConnectedUser[] = [];
        for (let i = 0; i < count; ++i)
        {
            const ctx = harness.connectUser();
            contexts.push(ctx);
            await harness.joinRoom(ctx, roomID);
        }
        return contexts;
    },

    /** Participant count, or -1 if the room isn't loaded. */
    getRoomParticipantCount(roomID: string): number
    {
        const mem = ServerRoomManager.roomRuntimeMemories[roomID];
        if (!mem) return -1;
        return Object.keys(mem.participantUserNameByID).length;
    },

    /** Whether a room is loaded. */
    isRoomLoaded(roomID: string): boolean
    {
        return ServerRoomManager.roomRuntimeMemories[roomID] != undefined;
    },

    /** The user's player object. */
    getPlayerObject(userID: string)
    {
        return ServerUserManager.getPlayerObject(userID);
    },

    /** Live player metadata, or undefined if not in a room. */
    getPlayerMetadata(userID: string): {[key: string]: string} | undefined
    {
        return ServerUserManager.getPlayerMetadata(userID);
    },

    /** Whether recentDisconnectMetadata holds an entry for the user. */
    hasRecentDisconnectMetadata(userID: string): boolean
    {
        return ServerUserManager.recentDisconnectMetadata[userID] != undefined;
    },

    /** Player metadata writes captured by the mocked DBUserUtil. */
    get savedPlayerMetadataRecords(): Array<{userID: string; playerMetadata: {[key: string]: string}}>
    {
        return _savedMetadataRecords;
    },

    /** lastRoomID stored in the mocked DBUser. */
    getStoredLastRoomID(userID: string): string | undefined
    {
        return _userStore[userID]?.lastRoomID;
    },

    /** playerMetadata stored in the mocked DBUser. */
    getStoredPlayerMetadata(userID: string): {[key: string]: string} | undefined
    {
        return _userStore[userID]?.playerMetadata;
    },


    /** Toggles random latency on mocked DB operations. */
    setLatency(enabled: boolean, minMs: number = 0, maxMs: number = 5): void
    {
        _latencyConfig.enabled = enabled;
        _latencyConfig.minMs = minMs;
        _latencyConfig.maxMs = maxMs;
    },

    /** Case A: the new socket connects first, evicting the old one and snapshotting its metadata. */
    async reconnectCaseA(oldCtx: ConnectedUser): Promise<ConnectedUser>
    {
        ServerUserManager.removeUser(oldCtx.user.id);
        await ServerRoomManager.changeUserRoom(oldCtx.socketUserContext, undefined, false, true, false);
        oldCtx.socket.connected = false;

        return reconnectSocket(oldCtx);
    },

    /** Case B: the old disconnect fires first, populating recentDisconnectMetadata. */
    async reconnectCaseB(oldCtx: ConnectedUser): Promise<ConnectedUser>
    {
        await harness.disconnectUser(oldCtx, true);

        return reconnectSocket(oldCtx);
    },

    /** Rebuilds a context without disconnecting (e.g. a client reloading after a shutdown), from DBUser. */
    reconnectUser(oldCtx: ConnectedUser): ConnectedUser
    {
        return reconnectSocket(oldCtx);
    },

    /** Simulates a graceful shutdown. */
    async gracefulShutdown(): Promise<void>
    {
        await ServerRoomManager.saveMultiplayerRooms(true);
        await ServerRoomManager.saveAllUsersPlayerMetadata(ServerUserManager.socketUserContexts);

        for (const [_userID, ctx] of Object.entries(ServerUserManager.socketUserContexts))
        {
            await ServerRoomManager.changeUserRoom(ctx, undefined, false, false, false);
            ctx.socket.disconnect(true);
        }

        for (const uid in ServerUserManager.socketUserContexts)
            delete ServerUserManager.socketUserContexts[uid];
    },

    /** Updates a player's transform via the real ServerObjectManager handler. */
    updateObjectTransform(ctx: ConnectedUser, newTransform: ObjectTransform): void
    {
        const playerObj = ServerUserManager.getPlayerObject(ctx.user.id);
        if (!playerObj) return;
        const roomID = ServerRoomManager.currentRoomIDByUserID[ctx.user.id];
        if (!roomID) return;
        const signal = new SetObjectTransformSignal(roomID, playerObj.objectId, newTransform, false);
        ServerObjectManager.onSetObjectTransformSignalReceived(ctx.socketUserContext, signal);
    },

    /** Sends a chat message (SentMessage metadata). */
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

    /** The underlying modules, for direct assertions. */
    ServerRoomManager,
    ServerUserManager,
    ServerObjectManager,
    RoomPickerUtil,
    HubRoomUtil,
    PhysicsManager,
};
