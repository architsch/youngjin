/** In-memory Firestore/Storage mocks, wired in via vi.mock(). */
import { vi } from "vitest";
import Room from "../../../src/shared/room/types/room";
import { RoomType, RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import { createTestRoom } from "./roomContent";
import DBUserVersionMigration from "../../../src/server/db/types/versionMigration/dbUserVersionMigration";
import DBRoomVersionMigration from "../../../src/server/db/types/versionMigration/dbRoomVersionMigration";

// ─── In-memory stores ────────────────────────────────────────────────────────

interface StoredRoom
{
    id: string;
    roomType: RoomType;
    ownerUserID: string;
    ownerUserName: string;
    texturePackPath: string;
    prefs: string;
    room: Room; // Full Room object with voxelGrid
}

interface StoredUser
{
    id: string;
    userName: string;
    userType: number;
    email: string;
    singlePlayerMode: string;
    lastRoomID: string;
    ownedRoomID: string;
    lastLoginAt: number;
    createdAt: number;
    loginCount: number;
    ftue: string;
    playerMetadata: {[key: string]: string};
    version: number;
}

interface SavedMetadataRecord
{
    userID: string;
    playerMetadata: {[key: string]: string};
}

export const roomStore: {[roomID: string]: StoredRoom} = {};
export const userStore: {[userID: string]: StoredUser} = {};
// Player metadata writes, for asserting disconnect/shutdown flushes.
export const savedPlayerMetadataRecords: SavedMetadataRecord[] = [];

let roomCounter = 0;
let userCounter = 0;

export function resetStores(): void
{
    for (const k in roomStore) delete roomStore[k];
    for (const k in userStore) delete userStore[k];
    savedPlayerMetadataRecords.length = 0;
    roomCounter = 0;
    userCounter = 0;
}

// ─── Helper: create a test room in the store ─────────────────────────────────

// Idempotent: returns an existing room rather than wiping mutations (call resetStores() for a fresh one).
export function seedRoom(
    roomID: string,
    roomType: RoomType = RoomTypeEnumMap.Hub,
): Room
{
    const existing = roomStore[roomID];
    if (existing) return existing.room;

    const roomName = roomType === RoomTypeEnumMap.SinglePlayer ? "tutorial" : "";
    const room = createTestRoom(roomID, roomName, roomType);
    roomStore[roomID] = {
        id: roomID,
        roomType,
        ownerUserID: "",
        ownerUserName: "",
        texturePackPath: room.texturePackPath,
        prefs: room.prefs,
        room,
    };
    return room;
}

// ─── Mock: DBRoomUtil ────────────────────────────────────────────────────────

export const mockDBRoomUtil = {
    getRoomContent: vi.fn(async (roomID: string): Promise<Room | null> =>
    {
        const stored = roomStore[roomID];
        return stored ? stored.room : null;
    }),
    getDBRoom: vi.fn(async (roomID: string) =>
    {
        const stored = roomStore[roomID];
        if (!stored) return null;
        return {
            id: stored.id,
            // Current version, as rows from the real util are already migrated.
            version: DBRoomVersionMigration.length,
            roomName: stored.room.roomName,
            roomType: stored.roomType,
            ownerUserID: stored.ownerUserID,
            ownerUserName: stored.ownerUserName,
            texturePackPath: stored.texturePackPath,
            prefs: stored.prefs,
        };
    }),
    saveRoomContent: vi.fn(async (_room: Room): Promise<boolean> =>
    {
        return true;
    }),
    deleteRoomContent: vi.fn(async (_room: Room): Promise<boolean> =>
    {
        return true;
    }),
    createRoom: vi.fn(async (
        roomName: string, roomType: RoomType,
        _ownerUserID: string, _ownerUserName: string, _texPath: string
    ) =>
    {
        const id = `room-${++roomCounter}`;
        const room = seedRoom(id, roomType);
        room.roomName = roomName;
        return { success: true, data: [{ id }] };
    }),
    deleteRoom: vi.fn(async (_roomID: string): Promise<boolean> =>
    {
        return true;
    }),
    changeRoomTexturePackPath: vi.fn(async (_room: Room, _newTexturePackPath: string): Promise<boolean> =>
    {
        return true;
    }),
    changeRoomPrefs: vi.fn(async (room: Room, newPrefs: string): Promise<boolean> =>
    {
        const stored = roomStore[room.id];
        if (stored)
            stored.prefs = newPrefs;
        return true;
    }),
};

// ─── Mock: DBSearchUtil ──────────────────────────────────────────────────────

export const mockDBSearchUtil = {
    rooms: {
        all: vi.fn(async () => ({ success: true, data: Object.values(roomStore) })),
        withRoomType: vi.fn(async (type: RoomType) => ({
            success: true,
            data: Object.values(roomStore).filter(r => r.roomType === type),
        })),
        withRoomNameAndType: vi.fn(async (roomName: string, type: RoomType) => ({
            success: true,
            data: Object.values(roomStore).filter(r => r.room.roomName === roomName && r.roomType === type),
        })),
    },
    users: {
        all: vi.fn(async () => ({ success: true, data: Object.values(userStore) })),
        withUserName: vi.fn(async (name: string) => ({
            success: true,
            data: Object.values(userStore).filter(u => u.userName === name),
        })),
        withEmail: vi.fn(async () => ({ success: true, data: [] })),
        withUserNameOrEmail: vi.fn(async () => ({ success: true, data: [] })),
    },
};

// ─── Mock: DBUserUtil ────────────────────────────────────────────────────────

export const mockDBUserUtil = {
    findUserById: vi.fn(async (userID: string) =>
    {
        return userStore[userID] ?? null;
    }),
    lookUpUserById: vi.fn(async (userID: string) =>
    {
        const user = userStore[userID];
        return { success: true, data: user ? [user] : [] };
    }),
    setLastRoomID: vi.fn(async (userID: string, roomID: string) =>
    {
        const u = userStore[userID];
        if (u) u.lastRoomID = roomID;
    }),
    savePlayerMetadata: vi.fn(async (userID: string, playerMetadata: {[key: string]: string}) =>
    {
        savedPlayerMetadataRecords.push({ userID, playerMetadata });
        const u = userStore[userID];
        if (u)
            u.playerMetadata = playerMetadata;
    }),
    saveMultipleUsersPlayerMetadata: vi.fn(async (updates: SavedMetadataRecord[]) =>
    {
        savedPlayerMetadataRecords.push(...updates);
        for (const update of updates)
        {
            const u = userStore[update.userID];
            if (u)
                u.playerMetadata = update.playerMetadata;
        }
    }),
    createUser: vi.fn(async (userName: string, userType: number, email: string) =>
    {
        const id = `user-${++userCounter}`;
        userStore[id] = {
            id, userName, userType, email,
            singlePlayerMode: "tutorial", lastRoomID: "", ownedRoomID: "",
            lastLoginAt: Date.now(), createdAt: Date.now(),
            loginCount: 1,
            ftue: "",
            playerMetadata: {},
            // Derived from the migration list, so new migrations don't leave it stale.
            version: DBUserVersionMigration.length,
        };
        return { success: true, data: [{ id }] };
    }),
    setSinglePlayerMode: vi.fn(async () => ({ success: true, data: [] })),
    setFTUE: vi.fn(async (userID: string, ftue: string) =>
    {
        const u = userStore[userID];
        if (u) u.ftue = ftue;
        return { success: true, data: [] };
    }),
    deleteStaleGuestsByTier: vi.fn(async () => 0),
    deleteUser: vi.fn(async () => ({ success: true, data: [] })),
    fromDBType: vi.fn((dbUser: any) =>
    {
        // Mirrors fromDBType's "" default for a missing FTUE record (in place).
        dbUser.ftue = dbUser.ftue ?? "";
        return dbUser;
    }),
    updateLastLogin: vi.fn(async () => {}),
    upgradeGuestToMember: vi.fn(async () => ({ success: true, data: [] })),
    setOwnedRoomID: vi.fn(async (userID: string, roomID: string) =>
    {
        const u = userStore[userID];
        if (u) u.ownedRoomID = roomID;
        return { success: true, data: [] };
    }),
};
