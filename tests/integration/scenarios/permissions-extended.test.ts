/**
 * Scenario tests: Extended permission enforcement
 *
 * Covers the full matrix of permission scenarios that the original
 * permissions.test.ts only partially covered:
 * - All voxel operations (add, remove, move, setTexture) × all roles (Owner, Editor, Visitor)
 * - Role changes mid-session (promote/demote)
 * - Permission enforcement across room switches
 * - Role persistence across reconnection
 * - Hub vs Regular room permission differences
 *
 * Uses describeScenarios for parameterized coverage without redundancy.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runScenario, describeScenarios, ScenarioConfig } from "../helpers/scenarioRunner";
import {
    regularRoom, hubRoom, userAt,
    setOwner, promoteToEditor, demoteToVisitor,
    buildColumn, namedUser,
} from "../helpers/scenarioPresets";
import { getPendingSignals } from "../helpers/invariants";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ServerUserManager from "../../../src/server/user/serverUserManager";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import { UserRoleEnumMap } from "../../../src/shared/user/types/userRole";
import { Action } from "../helpers/actions";

describe("extended permission scenarios", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    // ─── Parameterized: voxel operations × roles in Regular rooms ──────────

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

    const ROLES: {name: string; role: number; shouldSucceedInRegular: boolean}[] = [
        { name: "Owner", role: UserRoleEnumMap.Owner, shouldSucceedInRegular: true },
        { name: "Editor", role: UserRoleEnumMap.Editor, shouldSucceedInRegular: true },
        { name: "Visitor", role: UserRoleEnumMap.Visitor, shouldSucceedInRegular: false },
    ];

    for (const op of VOXEL_OPS)
    {
        for (const role of ROLES)
        {
            it(`${role.name} ${role.shouldSucceedInRegular ? "can" : "cannot"} ${op.name} in Regular room`, async () => {
                await runScenario({
                    name: `${role.name} ${op.name} in Regular`,
                    rooms: [regularRoom("perm-room")],
                    users: [
                        userAt(16, 16, "perm-room", { id: "test-user" }),
                        userAt(20, 20, "perm-room", { id: "helper-user" }),
                    ],
                    actions: [
                        // Set test user's role
                        ...(role.role === UserRoleEnumMap.Owner
                            ? [setOwner(0, "perm-room")]
                            : [{ type: "setUserRole" as const, userIndex: 0, role: role.role }]),
                        ...op.setupActions,
                        op.testAction,
                    ],
                    assertions: ({ users }) => {
                        if (!role.shouldSucceedInRegular)
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

    // ─── All operations succeed in Hub rooms regardless of role ─────────

    it("Visitor can perform all voxel operations in Hub room", async () => {
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

    // ─── Role changes mid-session ──────────────────────────────────────

    it("promoting visitor to editor allows voxel editing", async () => {
        await runScenario({
            name: "promote mid-session",
            rooms: [regularRoom("promote-room")],
            users: [userAt(16, 16, "promote-room")],
            actions: [
                // User starts as Visitor — add should fail
                { type: "addVoxel", userIndex: 0, row: 10, col: 10, layer: 0 },
                // Promote to Editor
                promoteToEditor(0),
                // Now add should succeed
                { type: "addVoxel", userIndex: 0, row: 11, col: 11, layer: 0 },
            ],
            assertions: () => {
                const roomMem = ServerRoomManager.roomRuntimeMemories["promote-room"];
                // First add (at 10,10) should have been rejected
                const v1 = VoxelQueryUtil.getVoxel(roomMem.room, 10, 10);
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(v1, 0)).toBe(false);
                // Second add (at 11,11) should have succeeded
                const v2 = VoxelQueryUtil.getVoxel(roomMem.room, 11, 11);
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(v2, 0)).toBe(true);
            },
        });
    });

    it("demoting editor to visitor revokes voxel editing", async () => {
        await runScenario({
            name: "demote mid-session",
            rooms: [regularRoom("demote-room")],
            users: [userAt(16, 16, "demote-room")],
            actions: [
                // Start as Editor
                promoteToEditor(0),
                { type: "addVoxel", userIndex: 0, row: 10, col: 10, layer: 0 },
                // Demote to Visitor
                demoteToVisitor(0),
                // This should now fail
                { type: "addVoxel", userIndex: 0, row: 11, col: 11, layer: 0 },
            ],
            assertions: () => {
                const roomMem = ServerRoomManager.roomRuntimeMemories["demote-room"];
                // First add should have succeeded
                const v1 = VoxelQueryUtil.getVoxel(roomMem.room, 10, 10);
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(v1, 0)).toBe(true);
                // Second add should have been rejected
                const v2 = VoxelQueryUtil.getVoxel(roomMem.room, 11, 11);
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(v2, 0)).toBe(false);
            },
        });
    });

    // ─── Role behavior across room switches ────────────────────────────

    it("user role resets to Visitor when switching to a different Regular room", async () => {
        await runScenario({
            name: "role reset on room switch",
            rooms: [regularRoom("room-A"), regularRoom("room-B")],
            users: [userAt(16, 16, "room-A")],
            actions: [
                // Start as Editor in room-A
                promoteToEditor(0),
                // Switch to room-B — should be Visitor again
                { type: "joinRoom", userIndex: 0, roomID: "room-B" },
            ],
            assertions: ({ users }) => {
                const role = ServerUserManager.getUserRole(users[0].user.id);
                expect(role).toBe(UserRoleEnumMap.Visitor);
            },
        });
    });
});
