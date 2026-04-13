/**
 * Scenario runner: the core abstraction of the test framework.
 *
 * A "scenario" is a declarative test specification:
 *   Setup (rooms + users) → Action Sequence → Invariants → Assertions → Cleanup
 *
 * Usage:
 *   runScenario({
 *     name: "player spawn at correct position",
 *     rooms: [{ id: "room-1", type: RoomTypeEnumMap.Regular }],
 *     users: [{ overrides: { lastX: 10, lastZ: 20 }, joinRoom: "room-1" }],
 *     actions: [
 *       { type: "moveObject", userIndex: 0, x: 15, y: 0, z: 25 },
 *     ],
 *     assertions: ({ users }) => {
 *       const state = harness.getGameplayState(users[0]);
 *       expect(state!.lastX).toBeCloseTo(15, 0);
 *     },
 *   });
 */
import { expect } from "vitest";
import { harness, ConnectedUser } from "./serverHarness";
import { Action, executeAction } from "./actions";
import { checkInvariants, InvariantSet } from "./invariants";
import { MockUserOverrides } from "./mockUser";
import { RoomType, RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface VoxelPlacement
{
    row: number;
    col: number;
    layer: number;
    textures?: [number, number, number, number, number, number];
}

export interface RoomConfig
{
    id: string;
    type?: RoomType;
    voxels?: VoxelPlacement[];
}

export interface UserConfig
{
    overrides?: MockUserOverrides;
    joinRoom?: string;
}

export interface ScenarioConfig
{
    /** Human-readable name (used in error messages). */
    name: string;

    /** Room(s) to seed before the scenario runs. */
    rooms: RoomConfig[];

    /** Users to pre-connect (and optionally pre-join to rooms). */
    users?: UserConfig[];

    /** Latency settings (default: disabled). */
    latency?: { enabled: boolean; minMs: number; maxMs: number };

    /** The action sequence to execute after setup. */
    actions?: Action[];

    /** Which invariants to check after the sequence (default: "structural"). */
    invariants?: InvariantSet;

    /** If true, skip invariant checking (for tests that intentionally break invariants). */
    skipInvariants?: boolean;

    /** Specific assertions on final state. */
    assertions?: (ctx: ScenarioContext) => void;

    /** If true, don't auto-disconnect users at the end. */
    skipCleanup?: boolean;
}

export interface ScenarioContext
{
    users: ConnectedUser[];
    harness: typeof harness;
}

// ─── Runner ─────────────────────────────────────────────────────────────────

/**
 * Runs a scenario: setup → actions → invariants → assertions → cleanup.
 * Throws on invariant violation or assertion failure.
 */
export async function runScenario(config: ScenarioConfig): Promise<ScenarioContext>
{
    // 1. Reset
    harness.reset();

    // 2. Configure latency
    if (config.latency)
        harness.setLatency(config.latency.enabled, config.latency.minMs, config.latency.maxMs);

    // 3. Seed rooms
    for (const roomConfig of config.rooms)
        harness.seedRoom(roomConfig.id, roomConfig.type ?? RoomTypeEnumMap.Regular);

    // 4. Pre-place voxels
    for (const roomConfig of config.rooms)
    {
        if (roomConfig.voxels && roomConfig.voxels.length > 0)
        {
            // We need at least one user in the room to place voxels via the signal handler.
            // Instead, we directly modify the room's voxel grid.
            const VoxelUpdateUtil = (await import("../../../src/shared/voxel/util/voxelUpdateUtil")).default;
            const VoxelQueryUtil = (await import("../../../src/shared/voxel/util/voxelQueryUtil")).default;
            const { UserRoleEnumMap } = await import("../../../src/shared/user/types/userRole");

            // Load the room to get access to its memory
            const roomMem = harness.ServerRoomManager.roomRuntimeMemories[roomConfig.id];
            if (!roomMem)
            {
                // Room isn't loaded yet — we need a temporary user to trigger load,
                // or we can access the room from the mock store directly.
                // Since rooms are seeded but not loaded, we modify the room object
                // from the mock DB store before any user joins.
                const { roomStore } = await import("./mockDB");
                const storedRoom = roomStore[roomConfig.id];
                if (storedRoom)
                {
                    for (const vp of roomConfig.voxels)
                    {
                        const quadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(vp.row, vp.col, vp.layer);
                        VoxelUpdateUtil.addVoxelBlock(
                            UserRoleEnumMap.Owner, storedRoom.room,
                            quadIndex, vp.textures ?? [0, 0, 0, 0, 0, 0], false,
                        );
                    }
                }
            }
            else
            {
                for (const vp of roomConfig.voxels)
                {
                    const quadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(vp.row, vp.col, vp.layer);
                    VoxelUpdateUtil.addVoxelBlock(
                        UserRoleEnumMap.Owner, roomMem.room,
                        quadIndex, vp.textures ?? [0, 0, 0, 0, 0, 0], false,
                    );
                }
            }
        }
    }

    // 5. Connect and optionally join users
    const users: ConnectedUser[] = [];
    if (config.users)
    {
        for (const userConfig of config.users)
        {
            const ctx = harness.connectUser(userConfig.overrides);
            users.push(ctx);
        }
        // Join rooms in a second pass (all users connected first)
        for (let i = 0; i < config.users.length; i++)
        {
            const userConfig = config.users[i];
            if (userConfig.joinRoom)
                await harness.joinRoom(users[i], userConfig.joinRoom);
        }
    }

    // 6. Execute action sequence
    if (config.actions)
    {
        for (const action of config.actions)
            await executeAction(action, users);
    }

    // 7. Check invariants
    if (!config.skipInvariants)
        checkInvariants(users, config.invariants ?? "structural");

    // 8. Run custom assertions
    const ctx: ScenarioContext = { users, harness };
    if (config.assertions)
        config.assertions(ctx);

    // 9. Cleanup
    if (!config.skipCleanup)
    {
        for (const u of [...users])
        {
            try { await harness.disconnectUser(u, false); }
            catch { /* ignore cleanup errors */ }
        }
        users.length = 0;
    }

    return ctx;
}

/**
 * Convenience: runs a batch of scenarios as separate `it` blocks inside a `describe`.
 * Useful for parameterized test matrices.
 */
export function describeScenarios(suiteName: string, scenarios: ScenarioConfig[]): void
{
    const { describe, it, beforeEach, vi } = require("vitest");

    describe(suiteName, () => {
        beforeEach(() => {
            vi.spyOn(console, "error").mockImplementation(() => {});
            vi.spyOn(console, "warn").mockImplementation(() => {});
            vi.spyOn(console, "log").mockImplementation(() => {});
        });

        for (const scenario of scenarios)
        {
            it(scenario.name, async () => {
                await runScenario(scenario);
            });
        }
    });
}
