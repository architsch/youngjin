/**
 * Scenario tests: quadIndex encoding and range validation
 *
 * A quadIndex names one quad of one room, and it travels: the four voxel edit signals carry it
 * between the client and the server. The field it travels in has to be wide enough for the largest
 * index the room can produce, and every entry point that acts on one has to check that the index it
 * was handed names a quad of the room at all.
 *
 * Neither failure announces itself. An index too wide for its field is clamped down to one that
 * still names a real quad, and an index outside the room resolves through the same arithmetic to
 * some other quad inside it — so in both cases the edit succeeds, on the wrong part of the room,
 * and the room is marked dirty and saved that way.
 *
 * Covers:
 * - Every addressable quadIndex survives a round trip through each of the four edit signals
 * - The room's index range fits the field those signals carry it in, including as the room grows
 * - The entrance wall, which sits in the room's last row and so produces its largest indices
 * - Out-of-range indices are refused by VoxelUpdateUtil rather than resolved to another quad
 * - They are refused on the unvalidated path too, which is how generation and the client apply edits
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

// Who the assertions below act as. They are not about who is asking — the editing utilities want
// the person as well as the role he holds, so somebody has to be named.
const actingUser = createEditingUser();

const ROOM_ID = "quad-index-hub";
const SCRATCH_BUFFER_BYTES = 1024;

// Round-trips one quadIndex through a signal's own encode/decode, on a buffer of its own rather than
// the shared write buffer, so that a signal left half-encoded cannot strand that buffer's
// reservation for the rest of the run.
function roundTrip<T>(build: (quadIndex: number) => { encode: (b: BufferState) => void },
    decode: (b: BufferState) => T, quadIndex: number): T
{
    const view = new Uint8Array(SCRATCH_BUFFER_BYTES);
    const writeState = new BufferState(view);
    build(quadIndex).encode(writeState);
    expect(writeState.byteIndex).toBeLessThanOrEqual(SCRATCH_BUFFER_BYTES);
    return decode(new BufferState(view));
}

// The indices most likely to break, rather than a sweep of all of them: the two ends of the range,
// the first index the old two-byte field could not carry, and the quads of the entrance wall — which
// stands in the room's last row and so produces the largest indices any room has.
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
        // The check that keeps this whole class of bug from coming back. Growing the room in any
        // direction grows NUM_VOXEL_QUADS_PER_ROOM, and the growth is silent at the wire: a room
        // whose largest index no longer fits is not rejected, only clamped. This fails first.
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

            // The offsets are read after the index, so a mis-sized index field would also shift
            // every field behind it — these assert the whole signal, not just the index.
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
        // A deployment replaces the server while browser sessions are still running the bundle they
        // loaded before it. For as long as those sessions last, the server is decoding signals
        // written by the previous field layout — here, a two-byte quadIndex where it now reads four.
        //
        // What matters is not that those edits fail, which is unavoidable and ends at the next page
        // load, but *how*. Read as four bytes, the old two run into whatever follows them and come
        // out as an enormous index; the range check is what turns that into a refusal instead of an
        // edit somewhere far away in the room.
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

                // A fractional index matters as much as one past the end: it is what an index
                // arriving from a calculation rather than from this module's own arithmetic looks
                // like, and every "get X from quadIndex" happily takes remainders of it.
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

                // Nothing anywhere in the grid moved, and the room was never marked for saving —
                // which is what a refused edit has to leave behind if it is to leave no trace.
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

                // Called without a room, which skips the can* predicate entirely — the path a room
                // is generated on, and the one a client applies an already-accepted edit on. Before
                // the range check reached the mutators, this path had no validation at all.
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

                // A column offset carrying the block off the near edge of the grid. The destination
                // is derived from the offsets rather than sent, so it is checked in its own right:
                // the voxel index arithmetic would otherwise resolve a column of -1 to the far edge
                // of the row above, moving the block clear across the room.
                const quadIndex = VoxelQueryUtil.getVoxelQuadIndex(5, 5, "y", "-", COLLISION_LAYER_MIN);
                const source = VoxelQueryUtil.getVoxel(voxels, 5, 5)!;
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(source, COLLISION_LAYER_MIN)).toBe(true);

                const masksBefore = voxels.map(voxel => voxel.collisionLayerMask);
                expect(VoxelUpdateUtil.moveVoxelBlock(undefined, voxels, quadIndex, 0, -6, 0)).toBe(false);

                // The block stayed where it was rather than being taken down at one end of a move
                // whose other end went nowhere — and the cell the column would have wrapped onto,
                // which is part of the room's own boundary wall, is as it was.
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(source, COLLISION_LAYER_MIN)).toBe(true);
                expect(voxels.map(voxel => voxel.collisionLayerMask)).toEqual(masksBefore);
            },
        });
    });
});
