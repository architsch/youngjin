/**
 * Scenario tests: extended permissions — every voxel operation by a visitor in another's Regular room
 * and in a Hub; owning one room doesn't gate editing another. Ownership must never become a condition
 * (owners protect areas via restricted zones; see restricted-zones.test.ts).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runScenario } from "../helpers/scenarioRunner";
import { regularRoom, hubRoom, userAt, setOwner } from "../helpers/scenarioPresets";
import { getPendingSignals } from "../helpers/invariants";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import RoomValidationUtil from "../../../src/shared/room/util/roomValidationUtil";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import { Action } from "../helpers/actions";

// Top-face offset: always visible (hidden faces refuse retexturing whoever asks).
const TOP_FACE_OFFSET = VoxelQueryUtil.getVoxelQuadIndex(10, 10, "y", "+", 0) -
    VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(10, 10, 0);

// Every voxel operation there is, made by one user: a block is built, painted, moved and taken down.
function allVoxelOperations(userIndex: number): Action[]
{
    return [
        { type: "addVoxel", userIndex, row: 10, col: 10, layer: 0 },
        { type: "setVoxelTexture", userIndex, row: 10, col: 10, layer: 0, quadOffset: TOP_FACE_OFFSET, textureIndex: 3 },
        { type: "addVoxel", userIndex, row: 11, col: 11, layer: 0 },
        { type: "moveVoxel", userIndex, row: 11, col: 11, layer: 0, dRow: 1, dCol: 0, dLayer: 0 },
        { type: "removeVoxel", userIndex, row: 10, col: 10, layer: 0 },
    ];
}

// Accepted edits aren't echoed to their sender, so any signal back is a correction.
function expectAllVoxelOperationsTaken(user: Parameters<typeof getPendingSignals>[0], roomID: string)
{
    for (const rollbackSignal of ["removeVoxelBlockSignal", "addVoxelBlockSignal", "setVoxelQuadTextureSignal"])
        expect(getPendingSignals(user, rollbackSignal).length, rollbackSignal).toBe(0);

    const voxels = ServerRoomManager.roomRuntimeMemories[roomID].room.voxelGrid.voxels;
    // Built and then taken down again...
    expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(VoxelQueryUtil.getVoxel(voxels, 10, 10)!, 0)).toBe(false);
    // ...and built and then moved away.
    expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(VoxelQueryUtil.getVoxel(voxels, 11, 11)!, 0)).toBe(false);
}

describe("extended permission scenarios", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("a visitor can perform all voxel operations in somebody else's Regular room", async () => {
        await runScenario({
            name: "visitor full ops in regular",
            rooms: [regularRoom("perm-room")],
            users: [
                userAt(16, 16, "perm-room", { id: "the-owner" }),
                userAt(20, 20, "perm-room", { id: "the-visitor" }),
            ],
            actions: [
                setOwner(0, "perm-room"),
                ...allVoxelOperations(1),
            ],
            assertions: ({ users }) => expectAllVoxelOperationsTaken(users[1], "perm-room"),
        });
    });

    it("anybody can perform all voxel operations in a Hub room", async () => {
        await runScenario({
            name: "visitor full ops in hub",
            rooms: [hubRoom("hub-perm")],
            users: [userAt(16, 16, "hub-perm")],
            actions: allVoxelOperations(0),
            assertions: ({ users }) => expectAllVoxelOperationsTaken(users[0], "hub-perm"),
        });
    });

    it("owning one Regular room is no condition for editing another", async () => {
        await runScenario({
            name: "ownership does not travel",
            rooms: [regularRoom("room-A"), regularRoom("room-B")],
            users: [
                userAt(16, 16, "room-A", { id: "the-traveller" }),
                // Keeps room-A loaded (a Regular room unloads when its last participant leaves).
                userAt(20, 20, "room-A", { id: "the-stayer" }),
            ],
            actions: [
                // Owns room-A, and builds in it.
                setOwner(0, "room-A"),
                { type: "addVoxel", userIndex: 0, row: 10, col: 10, layer: 0 },
                // Walks next door, where he owns nothing, and builds there too.
                { type: "joinRoom", userIndex: 0, roomID: "room-B" },
                { type: "addVoxel", userIndex: 0, row: 11, col: 11, layer: 0 },
            ],
            skipInvariants: true,
            assertions: ({ users }) => {
                const roomA = ServerRoomManager.roomRuntimeMemories["room-A"];
                const roomB = ServerRoomManager.roomRuntimeMemories["room-B"];

                expect(RoomValidationUtil.userOwnsRoom(users[0].user, roomA.room)).toBe(true);
                expect(RoomValidationUtil.userOwnsRoom(users[0].user, roomB.room)).toBe(false);

                const v1 = VoxelQueryUtil.getVoxel(roomA.room.voxelGrid.voxels, 10, 10)!;
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(v1, 0)).toBe(true);
                const v2 = VoxelQueryUtil.getVoxel(roomB.room.voxelGrid.voxels, 11, 11)!;
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(v2, 0)).toBe(true);
            },
        });
    });
});
