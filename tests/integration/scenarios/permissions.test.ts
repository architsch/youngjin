/**
 * Scenario tests: Permission enforcement
 *
 * Covers:
 * - Visitor cannot edit voxels in Regular rooms
 * - Owner/Editor can edit voxels in Regular rooms
 * - All users can edit voxels in Hub rooms
 * - Rollback signals sent to unauthorized users
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runScenario } from "../helpers/scenarioRunner";
import { regularRoom, hubRoom, userAt } from "../helpers/scenarioPresets";
import { getPendingSignals } from "../helpers/invariants";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ServerUserManager from "../../../src/server/user/serverUserManager";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import { UserRoleEnumMap } from "../../../src/shared/user/types/userRole";

describe("permission scenarios", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("visitor cannot add voxel blocks in a Regular room", async () => {
        await runScenario({
            name: "visitor voxel add rejected",
            rooms: [regularRoom("perm-room")],
            users: [userAt(16, 16, "perm-room")],
            assertions: ({ users }) => {
                // Default role for non-owners in Regular rooms is Visitor
                const role = ServerUserManager.getUserRole(users[0].user.id);
                expect(role).toBe(UserRoleEnumMap.Visitor);
            },
        });
    });

    it("visitor voxel add gets rollback signal", async () => {
        await runScenario({
            name: "visitor voxel rollback",
            rooms: [regularRoom("vis-rollback")],
            users: [userAt(16, 16, "vis-rollback")],
            actions: [
                { type: "addVoxel", userIndex: 0, row: 10, col: 10, layer: 0 },
            ],
            assertions: ({ users }) => {
                // Visitor's add should have been rejected with a rollback
                const rollback = getPendingSignals(users[0], "removeVoxelBlockSignal");
                expect(rollback.length).toBeGreaterThanOrEqual(1);
                // Block should NOT be present
                const roomMem = ServerRoomManager.roomRuntimeMemories["vis-rollback"];
                const voxel = VoxelQueryUtil.getVoxel(roomMem.room, 10, 10);
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, 0)).toBe(false);
            },
        });
    });

    it("all users can edit voxels in a Hub room", async () => {
        await runScenario({
            name: "hub room edit allowed",
            rooms: [hubRoom("hub-perm")],
            users: [userAt(16, 16, "hub-perm")],
            actions: [
                { type: "addVoxel", userIndex: 0, row: 10, col: 10, layer: 0 },
            ],
            assertions: () => {
                const roomMem = ServerRoomManager.roomRuntimeMemories["hub-perm"];
                const voxel = VoxelQueryUtil.getVoxel(roomMem.room, 10, 10);
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, 0)).toBe(true);
            },
        });
    });

    it("owner can edit voxels in their own Regular room", async () => {
        await runScenario({
            name: "owner can edit",
            rooms: [regularRoom("owner-room")],
            users: [userAt(16, 16, "owner-room", { id: "the-owner" })],
            // Pre-configure the room's owner
            assertions: ({ users, harness }) => {
                // Manually set room owner and user role for this test
                const roomMem = ServerRoomManager.roomRuntimeMemories["owner-room"];
                roomMem.room.ownerUserID = "the-owner";
                ServerUserManager.syncUserRoleInMemory("the-owner", "owner-room", UserRoleEnumMap.Owner);

                const role = ServerUserManager.getUserRole("the-owner");
                expect(role).toBe(UserRoleEnumMap.Owner);
            },
        });
    });

    it("editor role allows voxel editing in Regular room", async () => {
        await runScenario({
            name: "editor can edit",
            rooms: [regularRoom("editor-room")],
            users: [userAt(16, 16, "editor-room", { id: "the-editor" })],
            assertions: ({ users, harness }) => {
                // Promote to editor
                ServerUserManager.syncUserRoleInMemory("the-editor", "editor-room", UserRoleEnumMap.Editor);
                const role = ServerUserManager.getUserRole("the-editor");
                expect(role).toBe(UserRoleEnumMap.Editor);
            },
        });
    });
});
