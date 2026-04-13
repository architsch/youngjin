/**
 * Reusable building blocks for scenario-based tests.
 *
 * Provides pre-built room configs, user configs, and action sequences
 * so that individual test files stay concise and declarative.
 */
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import { RoomConfig, UserConfig, VoxelPlacement } from "./scenarioRunner";
import { Action } from "./actions";
import { MockUserOverrides } from "./mockUser";

// ─── Room Presets ──────────────────────────────────────────────────────────

export const EMPTY_HUB: RoomConfig = { id: "hub", type: RoomTypeEnumMap.Hub };
export const EMPTY_REGULAR: RoomConfig = { id: "regular", type: RoomTypeEnumMap.Regular };

export function regularRoom(id: string): RoomConfig
{
    return { id, type: RoomTypeEnumMap.Regular };
}

export function hubRoom(id: string): RoomConfig
{
    return { id, type: RoomTypeEnumMap.Hub };
}

/** A room with a wall segment at the given position (4 stacked blocks). */
export function roomWithWall(id: string, row: number, col: number): RoomConfig
{
    const voxels: VoxelPlacement[] = [];
    for (let layer = 0; layer < 4; layer++)
        voxels.push({ row, col, layer });
    return { id, type: RoomTypeEnumMap.Regular, voxels };
}

/** Multiple rooms for multi-room testing. */
export function multipleRooms(count: number, prefix: string = "room"): RoomConfig[]
{
    return Array.from({ length: count }, (_, i) => regularRoom(`${prefix}-${i}`));
}

// ─── User Presets ──────────────────────────────────────────────────────────

/** A user at the center of the room (16, 16). */
export function userAtCenter(joinRoom?: string, overrides?: MockUserOverrides): UserConfig
{
    return {
        overrides: { lastX: 16, lastZ: 16, ...overrides },
        joinRoom,
    };
}

/** A user at a specific position. */
export function userAt(x: number, z: number, joinRoom?: string, overrides?: MockUserOverrides): UserConfig
{
    return {
        overrides: { lastX: x, lastZ: z, ...overrides },
        joinRoom,
    };
}

/** A user with a specific ID. */
export function namedUser(id: string, joinRoom?: string, overrides?: MockUserOverrides): UserConfig
{
    return {
        overrides: { id, ...overrides },
        joinRoom,
    };
}

/** N users all joining the same room at spread-out positions. */
export function usersInRoom(count: number, roomID: string, startX: number = 5, spacing: number = 3): UserConfig[]
{
    return Array.from({ length: count }, (_, i) => ({
        overrides: {
            lastX: startX + i * spacing,
            lastZ: startX + i * spacing,
            playerMetadata: { "0": `user-${i}` },
        },
        joinRoom: roomID,
    }));
}

// ─── Action Presets ────────────────────────────────────────────────────────

/** Walk a user across the room in steps. */
export function walkAcross(userIndex: number, steps: number = 3): Action[]
{
    return Array.from({ length: steps }, (_, i) => ({
        type: "moveObject" as const,
        userIndex,
        x: 5 + i * 8,
        y: 0,
        z: 5 + i * 8,
    }));
}

/** Build a column of voxel blocks at a position. */
export function buildColumn(userIndex: number, row: number, col: number, height: number = 4): Action[]
{
    return Array.from({ length: height }, (_, i) => ({
        type: "addVoxel" as const,
        userIndex,
        row,
        col,
        layer: i,
    }));
}

/** Remove a column of voxel blocks at a position. */
export function removeColumn(userIndex: number, row: number, col: number, height: number = 4): Action[]
{
    // Remove from top to bottom to avoid wall-attachment issues
    return Array.from({ length: height }, (_, i) => ({
        type: "removeVoxel" as const,
        userIndex,
        row,
        col,
        layer: height - 1 - i,
    }));
}

/** Disconnect and reconnect a user (Case A or B). */
export function reconnectUser(userIndex: number, caseType: "A" | "B"): Action
{
    return caseType === "A"
        ? { type: "reconnectCaseA", userIndex }
        : { type: "reconnectCaseB", userIndex };
}

/** Disconnect a user with state save. */
export function disconnectWithSave(userIndex: number): Action
{
    return { type: "disconnect", userIndex, saveState: true };
}

/** Disconnect a user without state save. */
export function disconnectWithoutSave(userIndex: number): Action
{
    return { type: "disconnect", userIndex, saveState: false };
}

/** Execute multiple action groups concurrently (for race condition testing). */
export function parallel(...groups: Action[][]): Action
{
    return { type: "parallel", groups };
}

/** Enable latency simulation. */
export function enableLatency(minMs: number = 0, maxMs: number = 5): Action
{
    return { type: "setLatency", enabled: true, minMs, maxMs };
}

/** Disable latency simulation. */
export function disableLatency(): Action
{
    return { type: "setLatency", enabled: false };
}
