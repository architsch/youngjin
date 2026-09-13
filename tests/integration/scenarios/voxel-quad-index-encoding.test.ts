/**
 * Scenario tests: quadIndex encoding and range validation. Both failures are silent: an index too wide
 * for its field is clamped, and an out-of-range index resolves to another quad, so the wrong part of the
 * room is edited and saved.
 * Covers: round trips through the four edit signals; the index range fitting their field; the entrance
 * wall (largest indices); refusal of out-of-range indices by VoxelUpdateUtil, including on the
 * unvalidated path used by generation and the client.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runScenario } from "../helpers/scenarioRunner";
import { EMPTY_HUB, userAtCenter } from "../helpers/scenarioPresets";
import { createEditingUser } from "../helpers/mockUser";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import VoxelUpdateUtil from "../../../src/shared/voxel/util/voxelUpdateUtil";
import BufferState from "../../../src/shared/networking/types/bufferState";
import EncodableByteString from "../../../src/shared/networking/types/encodableByteString";
import EncodableRaw4ByteNumber from "../../../src/shared/networking/types/encodableRaw4ByteNumber";
import AddVoxelBlockSignal from "../../../src/shared/voxel/types/update/addVoxelBlockSignal";
import RemoveVoxelBlockSignal from "../../../src/shared/voxel/types/update/removeVoxelBlockSignal";
import MoveVoxelBlockSignal from "../../../src/shared/voxel/types/update/moveVoxelBlockSignal";
import SetVoxelQuadTextureSignal from "../../../src/shared/voxel/types/update/setVoxelQuadTextureSignal";
import { COLLISION_LAYER_MIN, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW,
    NUM_VOXEL_COLS, NUM_VOXEL_QUADS_PER_ROOM, NUM_VOXEL_ROWS } from "../../../src/shared/system/sharedConstants";

// The acting user (editing utilities require one).
const actingUser = createEditingUser();

const ROOM_ID = "quad-index-hub";
const SCRATCH_BUFFER_BYTES = 1024;

// Round-trips via a signal's own encode/decode on a private buffer, so a failed encode can't strand the
// shared buffer's reservation.
function roundTrip<T>(build: (quadIndex: number) => { encode: (b: BufferState) => void },
    decode: (b: BufferState) => T, quadIndex: number): T
{
    const view = new Uint8Array(SCRATCH_BUFFER_BYTES);
    const writeState = new BufferState(view);
    build(quadIndex).encode(writeState);
    expect(writeState.byteIndex).toBeLessThanOrEqual(SCRATCH_BUFFER_BYTES);
    return decode(new BufferState(view));
}

// Likely breakpoints: the range ends, the first index past the old two-byte field, and the entrance wall
// (in the room's last row).
function getInterestingQuadIndices(): number[]
{
    const entranceFirst = VoxelQueryUtil.getFirstVoxelQuadIndexInVoxel(
        INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL);
    const lastVoxelFirst = VoxelQueryUtil.getFirstVoxelQuadIndexInVoxel(
        NUM_VOXEL_ROWS - 1, NUM_VOXEL_COLS - 1);

    return [
        0,
        1,
        65535,
        65536,
        entranceFirst,
        lastVoxelFirst,
        NUM_VOXEL_QUADS_PER_ROOM - 1,
    ];
}

describe("voxel quadIndex encoding and validation", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("the room's quadIndex range fits the field the edit signals carry it in", () => {
        // Growing the room silently grows NUM_VOXEL_QUADS_PER_ROOM, and oversized indices are clamped, not
        // rejected; this fails first.
        expect(NUM_VOXEL_QUADS_PER_ROOM - 1).toBeLessThanOrEqual(EncodableRaw4ByteNumber.MAX_VALUE);
    });

    it("every edit signal carries the largest quadIndex the room can produce", () => {
        for (const quadIndex of getInterestingQuadIndices())
        {
            const added = roundTrip(
                (i) => new AddVoxelBlockSignal(ROOM_ID, i, [1, 2, 3, 4, 5, 6]),
                (b) => AddVoxelBlockSignal.decode(b) as AddVoxelBlockSignal, quadIndex);
            expect(added.quadIndex).toBe(quadIndex);
            expect(added.quadTextureIndicesWithinLayer).toEqual([1, 2, 3, 4, 5, 6]);

            const removed = roundTrip(
                (i) => new RemoveVoxelBlockSignal(ROOM_ID, i),
                (b) => RemoveVoxelBlockSignal.decode(b) as RemoveVoxelBlockSignal, quadIndex);
            expect(removed.quadIndex).toBe(quadIndex);

            // Offsets follow the index, so a mis-sized index field shifts them too; the whole signal is asserted.
            const moved = roundTrip(
                (i) => new MoveVoxelBlockSignal(ROOM_ID, i, -1, 2, -3),
                (b) => MoveVoxelBlockSignal.decode(b) as MoveVoxelBlockSignal, quadIndex);
            expect(moved.quadIndex).toBe(quadIndex);
            expect([moved.rowOffset, moved.colOffset, moved.collisionLayerOffset]).toEqual([-1, 2, -3]);

            const textured = roundTrip(
                (i) => new SetVoxelQuadTextureSignal(ROOM_ID, i, 42),
                (b) => SetVoxelQuadTextureSignal.decode(b) as SetVoxelQuadTextureSignal, quadIndex);
            expect(textured.quadIndex).toBe(quadIndex);
            expect(textured.textureIndex).toBe(42);

            expect(added.roomID).toBe(ROOM_ID);
        }
    });

    it("refuses an edit from a client still sending the narrower index field", async () => {
        // During a deploy, old bundles send a two-byte quadIndex that the server reads as four bytes,
        // yielding a huge index; the range check must refuse it rather than edit elsewhere.
        const roomID = "deploy-window-room";
        const oldQuadIndex = 4321;

        const view = new Uint8Array(SCRATCH_BUFFER_BYTES);
        const writeState = new BufferState(view);
        new EncodableByteString(roomID).encode(writeState);
        view[writeState.byteIndex++] = (oldQuadIndex >> 8) & 0xFF;
        view[writeState.byteIndex++] = oldQuadIndex & 0xFF;

        const decoded = RemoveVoxelBlockSignal.decode(
            new BufferState(view)) as RemoveVoxelBlockSignal;
        expect(decoded.roomID).toBe(roomID);
        expect(VoxelQueryUtil.isValidVoxelQuadIndex(decoded.quadIndex)).toBe(false);

        await runScenario({
            name: "old client field width",
            rooms: [{ ...EMPTY_HUB, id: ROOM_ID }],
            users: [userAtCenter(ROOM_ID)],
            actions: [],
            assertions: () => {
                const { room } = ServerRoomManager.roomRuntimeMemories[ROOM_ID];
                const { voxels } = room.voxelGrid;
                const masksBefore = voxels.map(voxel => voxel.collisionLayerMask);
                room.dirty = false;

                expect(VoxelUpdateUtil.removeVoxelBlock(
                    actingUser, voxels, decoded.quadIndex, room)).toBe(false);

                expect(voxels.map(voxel => voxel.collisionLayerMask)).toEqual(masksBefore);
                expect(room.dirty).toBe(false);
            },
        });
    });

    it("recognizes which quadIndices name a quad of the room", () => {
        expect(VoxelQueryUtil.isValidVoxelQuadIndex(0)).toBe(true);
        expect(VoxelQueryUtil.isValidVoxelQuadIndex(NUM_VOXEL_QUADS_PER_ROOM - 1)).toBe(true);

        expect(VoxelQueryUtil.isValidVoxelQuadIndex(-1)).toBe(false);
        expect(VoxelQueryUtil.isValidVoxelQuadIndex(NUM_VOXEL_QUADS_PER_ROOM)).toBe(false);
        expect(VoxelQueryUtil.isValidVoxelQuadIndex(1.5)).toBe(false);
        expect(VoxelQueryUtil.isValidVoxelQuadIndex(NaN)).toBe(false);
    });

    it("refuses every out-of-range quadIndex without touching the room", async () => {
        await runScenario({
            name: "out-of-range quadIndex",
            rooms: [{ ...EMPTY_HUB, id: ROOM_ID }],
            users: [userAtCenter(ROOM_ID)],
            actions: [],
            assertions: () => {
                const { room } = ServerRoomManager.roomRuntimeMemories[ROOM_ID];
                const { voxels } = room.voxelGrid;

                // Fractional indices matter too (they come from calculations, and quadIndex getters take remainders).
                const outOfRange = [NUM_VOXEL_QUADS_PER_ROOM, NUM_VOXEL_QUADS_PER_ROOM + 7, -1, 1.5, NaN];

                const masksBefore = voxels.map(voxel => voxel.collisionLayerMask);
                room.dirty = false;

                for (const quadIndex of outOfRange)
                {
                    expect(VoxelUpdateUtil.canAddVoxelBlock(actingUser, room, quadIndex)).toBe(false);
                    expect(VoxelUpdateUtil.canRemoveVoxelBlock(actingUser, room, quadIndex)).toBe(false);
                    expect(VoxelUpdateUtil.canSetVoxelQuadTexture(actingUser, room, quadIndex)).toBe(false);
                    expect(VoxelUpdateUtil.canMoveVoxelBlock(actingUser, room, quadIndex, 0, 0, 1)).toBe(false);

                    expect(VoxelUpdateUtil.addVoxelBlock(actingUser, voxels, quadIndex, undefined, room)).toBe(false);
                    expect(VoxelUpdateUtil.removeVoxelBlock(actingUser, voxels, quadIndex, room)).toBe(false);
                    expect(VoxelUpdateUtil.setVoxelQuadTexture(actingUser, voxels, quadIndex, 3, room)).toBe(false);
                    expect(VoxelUpdateUtil.moveVoxelBlock(actingUser, voxels, quadIndex, 0, 0, 1, room)).toBe(false);
                }

                // A refused edit leaves no trace: no voxel moved, and the room isn't dirty.
                expect(voxels.map(voxel => voxel.collisionLayerMask)).toEqual(masksBefore);
                expect(room.dirty).toBe(false);
            },
        });
    });

    it("refuses an out-of-range quadIndex on the unvalidated path as well", async () => {
        await runScenario({
            name: "out-of-range quadIndex, no room",
            rooms: [{ ...EMPTY_HUB, id: ROOM_ID }],
            users: [userAtCenter(ROOM_ID)],
            actions: [],
            assertions: () => {
                const { room } = ServerRoomManager.roomRuntimeMemories[ROOM_ID];
                const { voxels } = room.voxelGrid;

                // Without a room the can* predicate is skipped (as in generation and client apply), so the
                // mutators must check the range themselves.
                const masksBefore = voxels.map(voxel => voxel.collisionLayerMask);

                for (const quadIndex of [NUM_VOXEL_QUADS_PER_ROOM + 7, -1, 1.5, NaN])
                {
                    expect(VoxelUpdateUtil.addVoxelBlock(undefined, voxels, quadIndex)).toBe(false);
                    expect(VoxelUpdateUtil.removeVoxelBlock(undefined, voxels, quadIndex)).toBe(false);
                    expect(VoxelUpdateUtil.setVoxelQuadTexture(undefined, voxels, quadIndex, 3)).toBe(false);
                    expect(VoxelUpdateUtil.moveVoxelBlock(undefined, voxels, quadIndex, 0, 0, 1)).toBe(false);
                }

                expect(voxels.map(voxel => voxel.collisionLayerMask)).toEqual(masksBefore);
            },
        });
    });

    it("refuses a move whose destination leaves the room", async () => {
        await runScenario({
            name: "move off the grid",
            rooms: [{ ...EMPTY_HUB, id: ROOM_ID }],
            users: [userAtCenter(ROOM_ID)],
            actions: [{ type: "addVoxel", userIndex: 0, row: 5, col: 5, layer: COLLISION_LAYER_MIN }],
            assertions: () => {
                const { room } = ServerRoomManager.roomRuntimeMemories[ROOM_ID];
                const { voxels } = room.voxelGrid;

                // A column offset off the grid's near edge: the destination is derived, so it's checked on its
                // own (a column of -1 would otherwise wrap to the far edge of the adjacent row).
                const quadIndex = VoxelQueryUtil.getVoxelQuadIndex(5, 5, "y", "-", COLLISION_LAYER_MIN);
                const source = VoxelQueryUtil.getVoxel(voxels, 5, 5)!;
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(source, COLLISION_LAYER_MIN)).toBe(true);

                const masksBefore = voxels.map(voxel => voxel.collisionLayerMask);
                expect(VoxelUpdateUtil.moveVoxelBlock(undefined, voxels, quadIndex, 0, -6, 0)).toBe(false);

                // The block stays, and the boundary cell it would have wrapped onto is unchanged.
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(source, COLLISION_LAYER_MIN)).toBe(true);
                expect(voxels.map(voxel => voxel.collisionLayerMask)).toEqual(masksBefore);
            },
        });
    });
});
