/**
 * Scenario tests: Permission enforcement
 *
 * Covers:
 * - A visitor cannot edit voxels in a Regular room
 * - Its owner can
 * - All users can edit voxels in Hub rooms
 * - Rollback signals sent to unauthorized users
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runScenario } from "../helpers/scenarioRunner";
import { regularRoom, hubRoom, userAt } from "../helpers/scenarioPresets";
import { getPendingSignals } from "../helpers/invariants";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import RoomValidationUtil from "../../../src/shared/room/util/roomValidationUtil";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";

describe("permission scenarios", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("a user who owns no room may not edit a Regular room", async () => {
        await runScenario({
            name: "visitor voxel add rejected",
            rooms: [regularRoom("perm-room")],
            users: [userAt(16, 16, "perm-room")],
            assertions: ({ users }) => {
                const room = ServerRoomManager.roomRuntimeMemories["perm-room"].room;
                expect(RoomValidationUtil.canUserEditRoom(users[0].user, room)).toBe(false);
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
                const voxel = VoxelQueryUtil.getVoxel(roomMem.room.voxelGrid.voxels, 10, 10)!;
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
                const voxel = VoxelQueryUtil.getVoxel(roomMem.room.voxelGrid.voxels, 10, 10)!;
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, 0)).toBe(true);
            },
        });
    });

    it("owner can edit voxels in their own Regular room", async () => {
        await runScenario({
            name: "owner can edit",
            rooms: [regularRoom("owner-room")],
            users: [userAt(16, 16, "owner-room", { id: "the-owner" })],
            actions: [
                // Set user as room owner, then attempt voxel add
                { type: "setRoomOwner", userIndex: 0, roomID: "owner-room" },
                { type: "addVoxel", userIndex: 0, row: 10, col: 10, layer: 0 },
            ],
            assertions: ({ users }) => {
                // Owner's voxel add should have succeeded (no rollback)
                const rollback = getPendingSignals(users[0], "removeVoxelBlockSignal");
                expect(rollback.length).toBe(0);
                // Block should be present
                const roomMem = ServerRoomManager.roomRuntimeMemories["owner-room"];
                const voxel = VoxelQueryUtil.getVoxel(roomMem.room.voxelGrid.voxels, 10, 10)!;
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, 0)).toBe(true);
            },
        });
    });
});
