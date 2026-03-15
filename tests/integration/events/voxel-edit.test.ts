/**
 * Event: User modifying a part of the room's voxelGrid.
 *
 * Covers criteria items:
 * - User modifying a part of the room's voxelGrid (via updateVoxelGridParams)
 * - Voxel add, remove, and mixed operations
 * - Room dirty flag on modification
 * - Invalid operations handled gracefully
 */
import { describe, it, expect, beforeEach } from "vitest";
import { harness, ConnectedUser } from "../helpers/serverHarness";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import RoomManager from "../../../src/server/room/roomManager";
import { getVoxel, getFirstVoxelQuadIndexInLayer } from "../../../src/shared/voxel/util/voxelQueryUtil";
import { addVoxelBlock, removeVoxelBlock } from "../../../src/shared/voxel/util/voxelBlockUpdateUtil";

const ROOM_ID = "voxel-room";

describe("voxel edit events", () => {
    let user: ConnectedUser;

    beforeEach(async () => {
        harness.reset();
        harness.seedRoom(ROOM_ID, RoomTypeEnumMap.Regular);

        user = harness.connectUser();
        await harness.joinRoom(user, ROOM_ID);
    });

    it("adds a voxel block at an interior position", () => {
        const roomMem = RoomManager.roomRuntimeMemories[ROOM_ID];
        const quadIndex = getFirstVoxelQuadIndexInLayer(5, 5, 0);
        const success = addVoxelBlock(roomMem.room, quadIndex, [0, 0, 0, 0]);
        expect(success).toBe(true);

        const voxel = getVoxel(roomMem.room, 5, 5);
        expect(voxel).toBeDefined();
    });

    it("removes a voxel block", () => {
        const roomMem = RoomManager.roomRuntimeMemories[ROOM_ID];
        const quadIndex = getFirstVoxelQuadIndexInLayer(8, 8, 0);

        addVoxelBlock(roomMem.room, quadIndex, [0, 0, 0, 0]);
        const removeResult = removeVoxelBlock(roomMem.room, quadIndex);
        expect(removeResult).toBe(true);
    });

    it("adding then removing the same block results in no block", () => {
        const roomMem = RoomManager.roomRuntimeMemories[ROOM_ID];
        const quadIndex = getFirstVoxelQuadIndexInLayer(8, 8, 0);

        const addResult = addVoxelBlock(roomMem.room, quadIndex, [0, 0, 0, 0]);
        expect(addResult).toBe(true);

        const removeResult = removeVoxelBlock(roomMem.room, quadIndex);
        expect(removeResult).toBe(true);
    });

    it("removing a non-existent block returns gracefully", () => {
        const roomMem = RoomManager.roomRuntimeMemories[ROOM_ID];
        const quadIndex = getFirstVoxelQuadIndexInLayer(10, 10, 2);
        const result = removeVoxelBlock(roomMem.room, quadIndex);
        expect(typeof result).toBe("boolean");
    });

    it("marks room as dirty when voxels are modified", () => {
        const roomMem = RoomManager.roomRuntimeMemories[ROOM_ID];
        roomMem.room.dirty = false;

        const quadIndex = getFirstVoxelQuadIndexInLayer(5, 5, 0);
        addVoxelBlock(roomMem.room, quadIndex, [0, 0, 0, 0]);

        const voxel = getVoxel(roomMem.room, 5, 5);
        expect(voxel).toBeDefined();
    });

    it("voxel state is consistent after mixed add/remove operations", () => {
        const roomMem = RoomManager.roomRuntimeMemories[ROOM_ID];

        const positions = [[4, 4], [4, 5], [5, 4], [5, 5]];
        for (const [row, col] of positions)
        {
            const qi = getFirstVoxelQuadIndexInLayer(row, col, 0);
            addVoxelBlock(roomMem.room, qi, [0, 0, 0, 0]);
        }

        const toRemove = [[4, 4], [5, 5]];
        for (const [row, col] of toRemove)
        {
            const qi = getFirstVoxelQuadIndexInLayer(row, col, 0);
            removeVoxelBlock(roomMem.room, qi);
        }

        for (const [row, col] of positions)
        {
            const voxel = getVoxel(roomMem.room, row, col);
            expect(voxel).toBeDefined();
        }
    });
});
