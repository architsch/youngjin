/**
 * In-memory mock for all Firestore / Firebase Storage interactions.
 * Vitest's vi.mock() will redirect imports from the real DB utils to these
 * stubs so that tests never touch a real database.
 */
import { vi } from "vitest";
import Room from "../../../src/shared/room/types/room";
import RoomGenerator from "../../../src/shared/room/roomGenerator";
import { RoomType, RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import DBRoomEditor from "../../../src/server/db/types/row/dbRoomEditor";

// ─── In-memory stores ────────────────────────────────────────────────────────

interface StoredRoom
{
    id: string;
    roomType: RoomType;
    ownerUserID: string;
    ownerUserName: string;
    texturePackPath: string;
    editors: DBRoomEditor[];
    room: Room; // Full Room object with voxelGrid
}

interface StoredUser
{
    id: string;
    userName: string;
    userType: number;
    email: string;
    tutorialStep: number;
    lastRoomID: string;
    ownedRoomID: string;
    lastLoginAt: number;
    createdAt: number;
    loginCount: number;
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
// Record of all writes performed via savePlayerMetadata / saveMultipleUsersPlayerMetadata.
// Tests assert against this to verify the disconnect / graceful-shutdown flush.
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

// Idempotent: if a room with the same ID already exists in the store, return it
// rather than wiping prior mutations (e.g. ownerUserID set via the setRoomOwner
// action). Callers that need a fresh room must call resetStores() first.
export function seedRoom(
    roomID: string,
    roomType: RoomType = RoomTypeEnumMap.Hub,
): Room
{
    const existing = roomStore[roomID];
    if (existing) return existing.room;

    const { voxelGrid, objectGroup } = RoomGenerator.generateEmptyRoom(0, 1, 2);
    const room = new Room(roomID, roomType, "", "", "", voxelGrid, objectGroup);
    roomStore[roomID] = {
        id: roomID,
        roomType,
        ownerUserID: "",
        ownerUserName: "",
        texturePackPath: "",
        editors: [],
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
            version: 2,
            roomType: stored.roomType,
            ownerUserID: stored.ownerUserID,
            ownerUserName: stored.ownerUserName,
            texturePackPath: stored.texturePackPath,
            editors: stored.editors,
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
        roomType: RoomType, _ownerUserID: string,
        _floor: number, _wall: number, _ceil: number, _texPath: string
    ) =>
    {
        const id = `room-${++roomCounter}`;
        seedRoom(id, roomType);
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
    setEditors: vi.fn(async (roomID: string, editors: DBRoomEditor[]): Promise<boolean> =>
    {
        const stored = roomStore[roomID];
        if (!stored) return false;
        stored.editors = editors;
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
            tutorialStep: 0, lastRoomID: "", ownedRoomID: "",
            lastLoginAt: Date.now(), createdAt: Date.now(),
            loginCount: 1,
            playerMetadata: {},
            version: 1,
        };
        return { success: true, data: [{ id }] };
    }),
    setUserTutorialStep: vi.fn(async () => ({ success: true, data: [] })),
    deleteStaleGuestsByTier: vi.fn(async () => 0),
    deleteUser: vi.fn(async () => ({ success: true, data: [] })),
    fromDBType: vi.fn((dbUser: any) => dbUser),
    updateLastLogin: vi.fn(async () => {}),
    upgradeGuestToMember: vi.fn(async () => ({ success: true, data: [] })),
    setOwnedRoomID: vi.fn(async (userID: string, roomID: string) =>
    {
        const u = userStore[userID];
        if (u) u.ownedRoomID = roomID;
        return { success: true, data: [] };
    }),
};
