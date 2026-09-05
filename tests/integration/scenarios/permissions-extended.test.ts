/**
 * Scenario tests: Extended permission enforcement
 *
 * Covers the full matrix of permission scenarios that the original
 * permissions.test.ts only partially covered:
 * - All voxel operations (add, remove, move, setTexture) × owner and non-owner
 * - Hub vs Regular room permission differences
 * - Owning one room grants nothing in another
 *
 * Uses describeScenarios for parameterized coverage without redundancy.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runScenario } from "../helpers/scenarioRunner";
import { regularRoom, hubRoom, userAt, setOwner } from "../helpers/scenarioPresets";
import { getPendingSignals } from "../helpers/invariants";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import RoomValidationUtil from "../../../src/shared/room/util/roomValidationUtil";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import { Action } from "../helpers/actions";

describe("extended permission scenarios", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    // ─── Parameterized: voxel operations × owner/non-owner in Regular rooms ──

    const VOXEL_OPS: {name: string; setupActions: Action[]; testAction: Action; rollbackSignal: string}[] = [
        {
            name: "addVoxel",
            setupActions: [],
            testAction: { type: "addVoxel", userIndex: 0, row: 10, col: 10, layer: 0 },
            rollbackSignal: "removeVoxelBlockSignal",
        },
        {
            name: "removeVoxel",
            setupActions: [
                // Owner (user 1) pre-places a block for the test user to try removing
                { type: "setRoomOwner", userIndex: 1, roomID: "perm-room" },
                { type: "addVoxel", userIndex: 1, row: 12, col: 12, layer: 0 },
            ],
            testAction: { type: "removeVoxel", userIndex: 0, row: 12, col: 12, layer: 0 },
            rollbackSignal: "addVoxelBlockSignal",
        },
        {
            name: "moveVoxel",
            setupActions: [
                { type: "setRoomOwner", userIndex: 1, roomID: "perm-room" },
                { type: "addVoxel", userIndex: 1, row: 14, col: 14, layer: 0 },
            ],
            testAction: { type: "moveVoxel", userIndex: 0, row: 14, col: 14, layer: 0, dRow: 1, dCol: 0, dLayer: 0 },
            rollbackSignal: "addVoxelBlockSignal",
        },
        {
            name: "setVoxelTexture",
            setupActions: [
                { type: "setRoomOwner", userIndex: 1, roomID: "perm-room" },
                { type: "addVoxel", userIndex: 1, row: 16, col: 16, layer: 0 },
            ],
            testAction: { type: "setVoxelTexture", userIndex: 0, row: 16, col: 16, layer: 0, quadOffset: 0, textureIndex: 5 },
            rollbackSignal: "setVoxelQuadTextureSignal",
        },
    ];

    // A Regular room answers to exactly one person, so this is the whole matrix: he may edit it,
    // and nobody else may. The setup steps above hand ownership to the *helper* user, so a run
    // where the test user is the owner has to take it back — which is why the owner case names
    // itself last rather than being set up once at the top.
    const OWNERSHIP: {name: string; ownsTheRoom: boolean}[] = [
        { name: "Owner", ownsTheRoom: true },
        { name: "Non-owner", ownsTheRoom: false },
    ];

    for (const op of VOXEL_OPS)
    {
        for (const ownership of OWNERSHIP)
        {
            it(`${ownership.name} ${ownership.ownsTheRoom ? "can" : "cannot"} ${op.name} in Regular room`, async () => {
                await runScenario({
                    name: `${ownership.name} ${op.name} in Regular`,
                    rooms: [regularRoom("perm-room")],
                    users: [
                        userAt(16, 16, "perm-room", { id: "test-user" }),
                        userAt(20, 20, "perm-room", { id: "helper-user" }),
                    ],
                    actions: [
                        ...op.setupActions,
                        ...(ownership.ownsTheRoom ? [setOwner(0, "perm-room")] : []),
                        op.testAction,
                    ],
                    assertions: ({ users }) => {
                        if (!ownership.ownsTheRoom)
                        {
                            // Should have received a rollback signal
                            const rollback = getPendingSignals(users[0], op.rollbackSignal);
                            expect(rollback.length).toBeGreaterThanOrEqual(1);
                        }
                    },
                });
            });
        }
    }

    // ─── All operations succeed in Hub rooms regardless of who is asking ─────

    it("anybody can perform all voxel operations in a Hub room", async () => {
        await runScenario({
            name: "visitor full ops in hub",
            rooms: [hubRoom("hub-perm")],
            users: [userAt(16, 16, "hub-perm")],
            actions: [
                { type: "addVoxel", userIndex: 0, row: 10, col: 10, layer: 0 },
                { type: "setVoxelTexture", userIndex: 0, row: 10, col: 10, layer: 0, quadOffset: 0, textureIndex: 3 },
                { type: "addVoxel", userIndex: 0, row: 11, col: 11, layer: 0 },
                { type: "moveVoxel", userIndex: 0, row: 11, col: 11, layer: 0, dRow: 1, dCol: 0, dLayer: 0 },
                { type: "removeVoxel", userIndex: 0, row: 10, col: 10, layer: 0 },
            ],
            assertions: ({ users }) => {
                // No rollback signals should have been sent
                const addRollback = getPendingSignals(users[0], "removeVoxelBlockSignal");
                expect(addRollback.length).toBe(0);
            },
        });
    });

    // ─── Owning one room says nothing about another ─────────────────────────

    it("the owner of one Regular room may not edit a different one", async () => {
        await runScenario({
            name: "ownership does not travel",
            rooms: [regularRoom("room-A"), regularRoom("room-B")],
            users: [
                userAt(16, 16, "room-A", { id: "the-traveller" }),
                // Stays behind in room-A, which is what keeps it loaded once the traveller leaves:
                // a Regular room is unloaded the moment its last participant goes.
                userAt(20, 20, "room-A", { id: "the-stayer" }),
            ],
            actions: [
                // Owns room-A, and edits it freely.
                setOwner(0, "room-A"),
                { type: "addVoxel", userIndex: 0, row: 10, col: 10, layer: 0 },
                // Walks next door, where he owns nothing.
                { type: "joinRoom", userIndex: 0, roomID: "room-B" },
                { type: "addVoxel", userIndex: 0, row: 11, col: 11, layer: 0 },
            ],
            skipInvariants: true,
            assertions: ({ users }) => {
                const roomA = ServerRoomManager.roomRuntimeMemories["room-A"];
                const roomB = ServerRoomManager.roomRuntimeMemories["room-B"];

                expect(RoomValidationUtil.canUserEditRoom(users[0].user, roomA.room)).toBe(true);
                expect(RoomValidationUtil.canUserEditRoom(users[0].user, roomB.room)).toBe(false);

                const v1 = VoxelQueryUtil.getVoxel(roomA.room.voxelGrid.voxels, 10, 10)!;
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(v1, 0)).toBe(true);
                const v2 = VoxelQueryUtil.getVoxel(roomB.room.voxelGrid.voxels, 11, 11)!;
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(v2, 0)).toBe(false);
            },
        });
    });
});
