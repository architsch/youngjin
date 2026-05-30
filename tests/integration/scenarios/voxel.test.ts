/**
 * Scenario tests: Voxel operations
 *
 * Covers:
 * - Add, remove, move voxel blocks
 * - Set voxel quad texture
 * - Border voxel restrictions
 * - Mixed add/remove sequences
 * - Collision layer operations
 * - Room dirty flag
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runScenario } from "../helpers/scenarioRunner";
import { EMPTY_REGULAR, EMPTY_HUB, userAtCenter, buildColumn, removeColumn } from "../helpers/scenarioPresets";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import { MULTI_PLAYER_ENTRANCE_VOXEL_COL, MULTI_PLAYER_ENTRANCE_VOXEL_ROW } from "../../../src/shared/system/sharedConstants";

describe("voxel scenarios", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("adds a voxel block at an interior position", async () => {
        await runScenario({
            name: "add voxel",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            actions: [{ type: "addVoxel", userIndex: 0, row: 5, col: 5, layer: 0 }],
            assertions: () => {
                const roomMem = ServerRoomManager.roomRuntimeMemories["hub"];
                const voxel = VoxelQueryUtil.getVoxel(roomMem.room.voxelGrid.voxels, 5, 5)!;
                expect(voxel).toBeDefined();
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, 0)).toBe(true);
            },
        });
    });

    it("removes a voxel block", async () => {
        await runScenario({
            name: "remove voxel",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            actions: [
                { type: "addVoxel", userIndex: 0, row: 8, col: 8, layer: 0 },
                { type: "removeVoxel", userIndex: 0, row: 8, col: 8, layer: 0 },
            ],
            assertions: () => {
                const roomMem = ServerRoomManager.roomRuntimeMemories["hub"];
                const voxel = VoxelQueryUtil.getVoxel(roomMem.room.voxelGrid.voxels, 8, 8)!;
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, 0)).toBe(false);
            },
        });
    });

    it("builds and removes a column of blocks", async () => {
        await runScenario({
            name: "column build/remove",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            actions: [
                ...buildColumn(0, 10, 10, 4),
                ...removeColumn(0, 10, 10, 4),
            ],
            assertions: () => {
                const roomMem = ServerRoomManager.roomRuntimeMemories["hub"];
                const voxel = VoxelQueryUtil.getVoxel(roomMem.room.voxelGrid.voxels, 10, 10)!;
                for (let layer = 0; layer < 4; layer++)
                    expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, layer)).toBe(false);
            },
        });
    });

    it("voxel state is consistent after mixed add/remove operations", async () => {
        await runScenario({
            name: "mixed voxel ops",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            actions: [
                // Add 4 blocks in a square
                { type: "addVoxel", userIndex: 0, row: 4, col: 4, layer: 0 },
                { type: "addVoxel", userIndex: 0, row: 4, col: 5, layer: 0 },
                { type: "addVoxel", userIndex: 0, row: 5, col: 4, layer: 0 },
                { type: "addVoxel", userIndex: 0, row: 5, col: 5, layer: 0 },
                // Remove diagonal
                { type: "removeVoxel", userIndex: 0, row: 4, col: 4, layer: 0 },
                { type: "removeVoxel", userIndex: 0, row: 5, col: 5, layer: 0 },
            ],
            assertions: () => {
                const roomMem = ServerRoomManager.roomRuntimeMemories["hub"];
                // Removed blocks
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(
                    VoxelQueryUtil.getVoxel(roomMem.room.voxelGrid.voxels, 4, 4)!, 0)).toBe(false);
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(
                    VoxelQueryUtil.getVoxel(roomMem.room.voxelGrid.voxels, 5, 5)!, 0)).toBe(false);
                // Remaining blocks
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(
                    VoxelQueryUtil.getVoxel(roomMem.room.voxelGrid.voxels, 4, 5)!, 0)).toBe(true);
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(
                    VoxelQueryUtil.getVoxel(roomMem.room.voxelGrid.voxels, 5, 4)!, 0)).toBe(true);
            },
        });
    });

    it("adding a block at multiple collision layers", async () => {
        await runScenario({
            name: "multi-layer blocks",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            actions: [
                { type: "addVoxel", userIndex: 0, row: 15, col: 15, layer: 0 },
                { type: "addVoxel", userIndex: 0, row: 15, col: 15, layer: 1 },
                { type: "addVoxel", userIndex: 0, row: 15, col: 15, layer: 3 },
            ],
            assertions: () => {
                const roomMem = ServerRoomManager.roomRuntimeMemories["hub"];
                const voxel = VoxelQueryUtil.getVoxel(roomMem.room.voxelGrid.voxels, 15, 15)!;
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, 0)).toBe(true);
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, 1)).toBe(true);
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, 2)).toBe(false);
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, 3)).toBe(true);
            },
        });
    });

    it("removing a non-existent block is handled gracefully", async () => {
        await runScenario({
            name: "remove non-existent",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            actions: [
                { type: "removeVoxel", userIndex: 0, row: 10, col: 10, layer: 2 },
            ],
            // Should not crash — the operation just fails silently (with rollback signal)
            assertions: () => {},
        });
    });

    it("duplicate add to occupied layer is rejected", async () => {
        await runScenario({
            name: "duplicate add rejected",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            actions: [
                { type: "addVoxel", userIndex: 0, row: 12, col: 12, layer: 0 },
                { type: "addVoxel", userIndex: 0, row: 12, col: 12, layer: 0 }, // duplicate
            ],
            assertions: () => {
                const roomMem = ServerRoomManager.roomRuntimeMemories["hub"];
                const voxel = VoxelQueryUtil.getVoxel(roomMem.room.voxelGrid.voxels, 12, 12)!;
                // Block should still be there (first add succeeded, second was rejected)
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, 0)).toBe(true);
            },
        });
    });

    it("cannot add a block inside the entrance's no-build zone", async () => {
        await runScenario({
            name: "entrance no-add zone",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            actions: [
                // One cell in front of the entrance → inside the 3x3 no-add zone (rejected)
                { type: "addVoxel", userIndex: 0, row: MULTI_PLAYER_ENTRANCE_VOXEL_ROW - 1, col: MULTI_PLAYER_ENTRANCE_VOXEL_COL, layer: 0 },
                // Two cells in front → outside the zone (allowed), as a control
                { type: "addVoxel", userIndex: 0, row: MULTI_PLAYER_ENTRANCE_VOXEL_ROW - 2, col: MULTI_PLAYER_ENTRANCE_VOXEL_COL, layer: 0 },
            ],
            assertions: () => {
                const voxels = ServerRoomManager.roomRuntimeMemories["hub"].room.voxelGrid.voxels;
                const blocked = VoxelQueryUtil.getVoxel(voxels, MULTI_PLAYER_ENTRANCE_VOXEL_ROW - 1, MULTI_PLAYER_ENTRANCE_VOXEL_COL)!;
                const allowed = VoxelQueryUtil.getVoxel(voxels, MULTI_PLAYER_ENTRANCE_VOXEL_ROW - 2, MULTI_PLAYER_ENTRANCE_VOXEL_COL)!;
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(blocked, 0)).toBe(false);
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(allowed, 0)).toBe(true);
            },
        });
    });

    it("cannot remove the wall blocks framing the entrance", async () => {
        await runScenario({
            name: "entrance no-remove row",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            actions: [
                // A jamb directly beside the doorway → protected (rejected)
                { type: "removeVoxel", userIndex: 0, row: MULTI_PLAYER_ENTRANCE_VOXEL_ROW, col: MULTI_PLAYER_ENTRANCE_VOXEL_COL - 1, layer: 0 },
                // A boundary-wall block far from the entrance → editable now (allowed), as a control
                { type: "removeVoxel", userIndex: 0, row: MULTI_PLAYER_ENTRANCE_VOXEL_ROW, col: 10, layer: 0 },
            ],
            assertions: () => {
                const voxels = ServerRoomManager.roomRuntimeMemories["hub"].room.voxelGrid.voxels;
                const jamb = VoxelQueryUtil.getVoxel(voxels, MULTI_PLAYER_ENTRANCE_VOXEL_ROW, MULTI_PLAYER_ENTRANCE_VOXEL_COL - 1)!;
                const farWall = VoxelQueryUtil.getVoxel(voxels, MULTI_PLAYER_ENTRANCE_VOXEL_ROW, 10)!;
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(jamb, 0)).toBe(true);
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(farWall, 0)).toBe(false);
            },
        });
    });
});
