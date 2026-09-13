/**
 * Runs declarative scenarios: setup (rooms + users) → actions → invariants → assertions → cleanup.
 * See @docs/testing/integration/framework.md for an example.
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

/** Runs a scenario; throws on invariant or assertion failure. */
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
            // Voxels are pre-placed directly on the grid (no user is needed).
            const VoxelUpdateUtil = (await import("../../../src/shared/voxel/util/voxelUpdateUtil")).default;
            const VoxelQueryUtil = (await import("../../../src/shared/voxel/util/voxelQueryUtil")).default;

            // Load the room to get access to its memory
            const roomMem = harness.ServerRoomManager.roomRuntimeMemories[roomConfig.id];
            if (!roomMem)
            {
                // The room isn't loaded yet, so edit the seeded room in the mock store.
                const { roomStore } = await import("./mockDB");
                const storedRoom = roomStore[roomConfig.id];
                if (storedRoom)
                {
                    for (const vp of roomConfig.voxels)
                    {
                        const quadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(vp.row, vp.col, vp.layer);
                        VoxelUpdateUtil.addVoxelBlock(
                            undefined, storedRoom.room.voxelGrid.voxels,
                            quadIndex, vp.textures ?? [0, 0, 0, 0, 0, 0]
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
                        undefined, roomMem.room.voxelGrid.voxels,
                        quadIndex, vp.textures ?? [0, 0, 0, 0, 0, 0]
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

/** Runs each scenario as its own `it` inside a `describe`. */
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
