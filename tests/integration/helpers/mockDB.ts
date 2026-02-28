/**
 * In-memory mock for all Firestore / Firebase Storage interactions.
 * Vitest's vi.mock() will redirect imports from the real DB utils to these
 * stubs so that tests never touch a real database.
 */
import { vi } from "vitest";
import Room from "../../../src/shared/room/types/room";
import RoomGenerator from "../../../src/shared/room/roomGenerator";
import { RoomType, RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import UserGameplayState from "../../../src/server/user/types/userGameplayState";

// ─── In-memory stores ────────────────────────────────────────────────────────

interface StoredRoom
{
    id: string;
    roomName: string;
    roomType: RoomType;
    ownerUserID: string;
    texturePackPath: string;
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
    lastX: number;
    lastY: number;
    lastZ: number;
    lastDirX: number;
    lastDirY: number;
    lastDirZ: number;
    playerMetadata: {[key: string]: string};
    lastLoginAt: number;
    createdAt: number;
    loginCount: number;
    totalPlaytimeMs: number;
    version: number;
}

export const roomStore: {[roomID: string]: StoredRoom} = {};
export const userStore: {[userID: string]: StoredUser} = {};
export const savedGameplayStates: UserGameplayState[] = [];

let roomCounter = 0;
let userCounter = 0;

export function resetStores(): void
{
    for (const k in roomStore) delete roomStore[k];
    for (const k in userStore) delete userStore[k];
    savedGameplayStates.length = 0;
    roomCounter = 0;
    userCounter = 0;
}

// ─── Helper: create a test room in the store ─────────────────────────────────

export function seedRoom(
    roomID: string,
    roomName: string = "test-room",
    roomType: RoomType = RoomTypeEnumMap.Hub,
): Room
{
    const { voxelGrid, persistentObjectGroup } = RoomGenerator.generateEmptyRoom(0, 1, 2);
    const room = new Room(roomID, roomName, roomType, "", "", voxelGrid, persistentObjectGroup);
    roomStore[roomID] = {
        id: roomID,
        roomName,
        roomType,
        ownerUserID: "",
        texturePackPath: "",
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
    saveRoomContent: vi.fn(async (_room: Room): Promise<boolean> =>
    {
        return true;
    }),
    deleteRoomContent: vi.fn(async (_room: Room): Promise<boolean> =>
    {
        return true;
    }),
    createRoom: vi.fn(async (
        roomName: string, roomType: RoomType, _ownerUserID: string,
        _floor: number, _wall: number, _ceil: number, _texPath: string
    ) =>
    {
        const id = `room-${++roomCounter}`;
        seedRoom(id, roomName, roomType);
        return { success: true, data: [{ id }] };
    }),
    deleteRoom: vi.fn(async (_roomID: string): Promise<boolean> =>
    {
        return true;
    }),
    changeRoomName: vi.fn(async (_room: Room, _newName: string): Promise<boolean> =>
    {
        return true;
    }),
};

// ─── Mock: DBSearchUtil ──────────────────────────────────────────────────────

export const mockDBSearchUtil = {
    rooms: {
        all: vi.fn(async () => ({ success: true, data: Object.values(roomStore) })),
        withRoomName: vi.fn(async (name: string) => ({
            success: true,
            data: Object.values(roomStore).filter(r => r.roomName === name),
        })),
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
    saveUserGameplayState: vi.fn(async (state: UserGameplayState) =>
    {
        savedGameplayStates.push(state);
        return { success: true, data: [] };
    }),
    saveMultipleUsersGameplayState: vi.fn(async (states: UserGameplayState[]) =>
    {
        savedGameplayStates.push(...states);
    }),
    createUser: vi.fn(async (userName: string, userType: number, email: string) =>
    {
        const id = `user-${++userCounter}`;
        userStore[id] = {
            id, userName, userType, email,
            tutorialStep: 0, lastRoomID: "", lastX: 16, lastY: 0, lastZ: 16,
            lastDirX: 0, lastDirY: 0, lastDirZ: 1,
            playerMetadata: {},
            lastLoginAt: Date.now(), createdAt: Date.now(),
            loginCount: 1, totalPlaytimeMs: 0, version: 1,
        };
        return { success: true, data: [{ id }] };
    }),
    setUserTutorialStep: vi.fn(async () => ({ success: true, data: [] })),
    deleteStaleGuestsByTier: vi.fn(async () => 0),
    deleteUser: vi.fn(async () => ({ success: true, data: [] })),
    fromDBType: vi.fn((dbUser: any) => dbUser),
    updateLastLogin: vi.fn(async () => {}),
    upgradeGuestToMember: vi.fn(async () => ({ success: true, data: [] })),
};
