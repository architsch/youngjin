/**
 * Scenario tests: Permission enforcement
 *
 * Covers:
 * - A visitor may edit voxels in somebody else's Regular room
 * - Its owner can too
 * - All users can edit voxels in Hub rooms
 *
 * Owning a room is not what lets anybody build in it. What a room's owner keeps to himself is drawn
 * as restricted zones instead, which have scenarios of their own (restricted-zones.test.ts).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runScenario } from "../helpers/scenarioRunner";
import { regularRoom, hubRoom, userAt, setOwner } from "../helpers/scenarioPresets";
import { getPendingSignals } from "../helpers/invariants";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";

describe("permission scenarios", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("a visitor may build in somebody else's Regular room", async () => {
        await runScenario({
            name: "visitor voxel add accepted",
            rooms: [regularRoom("vis-room")],
            users: [
                userAt(16, 16, "vis-room", { id: "the-owner" }),
                userAt(20, 20, "vis-room", { id: "the-visitor" }),
            ],
            actions: [
                setOwner(0, "vis-room"),
                { type: "addVoxel", userIndex: 1, row: 10, col: 10, layer: 0 },
            ],
            assertions: ({ users }) => {
                // Taken rather than rolled back...
                const rollback = getPendingSignals(users[1], "removeVoxelBlockSignal");
                expect(rollback.length).toBe(0);
                // ...and standing in the room.
                const roomMem = ServerRoomManager.roomRuntimeMemories["vis-room"];
                const voxel = VoxelQueryUtil.getVoxel(roomMem.room.voxelGrid.voxels, 10, 10)!;
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, 0)).toBe(true);
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
