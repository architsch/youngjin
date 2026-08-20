/**
 * Version migration of a room's voxel grid.
 *
 * A room's contents are stored as an opaque binary blob rather than as database rows, so they are
 * not migrated the way a row is: nothing rewrites them in place, and no migration pass runs over
 * storage. Instead the decoder recognises the version a blob was written in, reads it in that
 * version's own format, and carries it forward one version at a time until it is current — every
 * time the room is loaded, for as long as blobs of that vintage are still out there.
 *
 * That makes the decoder the only thing standing between an old room and being read as nonsense, so
 * these tests run it against rooms that were genuinely written by the old code. The fixtures were
 * produced by the previous commit's own encoder (see the fixtures' README), not by a
 * re-implementation of the old format in this tree — which would only prove that two descriptions
 * of the format agree with each other.
 *
 * What migration owes an existing room, from version 1 to version 2 (the room's height doubling):
 *   - everything the room already held stays exactly where it stood, face for face;
 *   - the ceiling it had becomes a real floor slab at that same height, so the room below it is
 *     left looking exactly as it did;
 *   - the storey the room has gained above that slab arrives empty.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

import BufferState from "../../../src/shared/networking/types/bufferState";
import VoxelGrid from "../../../src/shared/voxel/types/voxelGrid";
import Voxel from "../../../src/shared/voxel/types/voxel";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NUM_VOXEL_COLS, NUM_VOXEL_QUADS_PER_COLLISION_LAYER,
    NUM_VOXEL_QUADS_PER_ROOM, NUM_VOXEL_ROWS, STOREY_FLOOR_COLLISION_LAYER } from "../../../src/shared/system/sharedConstants";

const FIXTURE_DIR = path.join(__dirname, "../fixtures/legacyVoxelGrids");
const FIXTURE_NAMES = ["bare", "procedural_1", "procedural_7", "procedural_12345",
    "procedural_999999", "mixed"];

// The height a room stood at in the format these fixtures were written in.
const LEGACY_NUM_COLLISION_LAYERS = 8;
const LEGACY_COLLISION_LAYER_MAX = LEGACY_NUM_COLLISION_LAYERS - 1;

interface LegacyRoomDescription
{
    masks: number[];
    ceilingQuads: number[];
    floorQuads: number[];
    numVisibleQuads: number;
    layerQuadsHash: number;
}

function loadFixture(name: string): {bytes: Uint8Array, expected: LegacyRoomDescription}
{
    return {
        bytes: new Uint8Array(fs.readFileSync(path.join(FIXTURE_DIR, `${name}.bin`))),
        expected: JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, `${name}.json`), "utf8")),
    };
}

function decode(bytes: Uint8Array): VoxelGrid
{
    return VoxelGrid.decode(new BufferState(bytes)) as VoxelGrid;
}

function quadTextureIndex(quad: number): number
{
    return quad & 0b01111111;
}

function quadIsVisible(quad: number): boolean
{
    return (quad & 0b10000000) != 0;
}

// The same fold the fixtures were written with, over the layers the legacy room had. Every one of
// those layers has to come through migration byte for byte, so this is what says whether it did.
function hashLegacyLayerQuads(grid: VoxelGrid): number
{
    let hash = 0x811c9dc5; // FNV-1a
    for (const voxel of grid.voxels)
    {
        for (let layer = COLLISION_LAYER_MIN; layer <= LEGACY_COLLISION_LAYER_MAX; ++layer)
        {
            const first = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(voxel.row, voxel.col, layer);
            for (let i = 0; i < NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
            {
                hash ^= grid.quadsMem.quads[first + i];
                hash = Math.imul(hash, 0x01000193) >>> 0;
            }
        }
    }
    return hash;
}

function getVoxel(grid: VoxelGrid, row: number, col: number): Voxel
{
    return grid.voxels[row * NUM_VOXEL_COLS + col];
}

describe.each(FIXTURE_NAMES)("migrating a version-1 room (%s)", (name) => {
    const {bytes, expected} = loadFixture(name);

    it("is recognised as an older version than the one being written now", () => {
        expect(bytes[0]).toBe(1);

        // Re-encoding what came out stamps the current version on it, which is what makes the
        // migration a one-time cost per room rather than something paid on every load forever.
        const grid = decode(bytes);
        const out = new BufferState(new Uint8Array(1024 * 1024));
        grid.encode(out);
        expect(out.view[0]).toBe(2);
    });

    it("keeps every layer the room already had, face for face", () => {
        expect(hashLegacyLayerQuads(decode(bytes))).toBe(expected.layerQuadsHash);
    });

    it("keeps every voxel standing where it stood, and adds the storey floor over it", () => {
        const grid = decode(bytes);
        expect(grid.voxels.length).toBe(NUM_VOXEL_ROWS * NUM_VOXEL_COLS);

        for (let i = 0; i < grid.voxels.length; ++i)
        {
            // The room's old contents, plus a slab at the height its ceiling used to hang at.
            expect(grid.voxels[i].collisionLayerMask).toBe(
                expected.masks[i] | (1 << STOREY_FLOOR_COLLISION_LAYER));
        }
    });

    it("leaves the storey above the slab empty", () => {
        const grid = decode(bytes);
        for (const voxel of grid.voxels)
        {
            for (let layer = STOREY_FLOOR_COLLISION_LAYER + 1; layer <= COLLISION_LAYER_MAX; ++layer)
            {
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, layer)).toBe(false);

                const first = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(voxel.row, voxel.col, layer);
                for (let i = 0; i < NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
                    expect(grid.quadsMem.quads[first + i]).toBe(0);
            }
        }
    });

    it("leaves the room's floor exactly as it was", () => {
        const grid = decode(bytes);
        for (let i = 0; i < grid.voxels.length; ++i)
        {
            const voxel = grid.voxels[i];
            const quad = grid.quadsMem.quads[VoxelQueryUtil.getFloorVoxelQuadIndex(voxel.row, voxel.col)];
            expect(quad).toBe(expected.floorQuads[i]);
        }
    });

    it("shows the old ceiling from below, as the underside of the new storey floor", () => {
        const grid = decode(bytes);
        for (let i = 0; i < grid.voxels.length; ++i)
        {
            const voxel = grid.voxels[i];
            const slabQuadIndex = VoxelQueryUtil.getVoxelQuadIndex(
                voxel.row, voxel.col, "y", "-", STOREY_FLOOR_COLLISION_LAYER);
            const slabQuad = grid.quadsMem.quads[slabQuadIndex];

            // It carries what the ceiling tile it replaces carried...
            expect(quadTextureIndex(slabQuad)).toBe(quadTextureIndex(expected.ceilingQuads[i]));

            // ...and is on show under exactly the cells the ceiling tile was on show under, which
            // is every cell not filled to the top by a wall.
            expect(quadIsVisible(slabQuad)).toBe(quadIsVisible(expected.ceilingQuads[i]));
        }
    });

    it("hangs the room's own ceiling over the empty storey instead", () => {
        const grid = decode(bytes);
        for (let i = 0; i < grid.voxels.length; ++i)
        {
            const voxel = grid.voxels[i];
            const quad = grid.quadsMem.quads[
                VoxelQueryUtil.getCeilingVoxelQuadIndex(voxel.row, voxel.col)];

            // Nothing stands against it up there, so every cell of it is on show — including the
            // cells a wall reaching the old ceiling used to cover.
            expect(quadIsVisible(quad)).toBe(true);
            expect(quadTextureIndex(quad)).toBe(quadTextureIndex(expected.ceilingQuads[i]));
        }
    });

    it("comes out of a second decode identical to the first", () => {
        // Migration has to be a function of the blob alone: a room read twice — as it is, once per
        // server that loads it — must not come out differently the second time.
        const first = decode(bytes);
        const second = decode(bytes);
        expect(Array.from(second.quadsMem.quads)).toEqual(Array.from(first.quadsMem.quads));
        expect(second.voxels.map(v => v.collisionLayerMask))
            .toEqual(first.voxels.map(v => v.collisionLayerMask));
    });

    it("survives a round trip through the current format unchanged", () => {
        // What migration produced is written back in the current format, so reading that back has
        // to give the same room — which is the only thing keeping a migrated room from decaying a
        // little more every time it is saved.
        const migrated = decode(bytes);
        const out = new BufferState(new Uint8Array(1024 * 1024));
        migrated.encode(out);
        const reloaded = decode(out.view.slice(0, out.byteIndex));

        expect(Array.from(reloaded.quadsMem.quads)).toEqual(Array.from(migrated.quadsMem.quads));
        expect(reloaded.voxels.map(v => v.collisionLayerMask))
            .toEqual(migrated.voxels.map(v => v.collisionLayerMask));
    });
});

describe("migrating a version-0 room", () => {
    // Version 0 was written in the same binary layout as version 1, and differs from it only in
    // what the room is taken to contain, so a version-0 blob is a version-1 one with a different
    // number on the front. Reading one exercises the whole chain of conversions rather than only
    // the last of them.
    const {bytes} = loadFixture("bare");
    const version0Bytes = bytes.slice();
    version0Bytes[0] = 0;

    it("is carried through every version up to the current one", () => {
        const grid = decode(version0Bytes);

        for (const voxel of grid.voxels)
        {
            expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, STOREY_FLOOR_COLLISION_LAYER))
                .toBe(true);
        }

        // The corner walls version 1 introduced are there, standing through the room's lower storey.
        for (const [row, col] of [[0, 0], [0, NUM_VOXEL_COLS - 1],
            [NUM_VOXEL_ROWS - 1, 0], [NUM_VOXEL_ROWS - 1, NUM_VOXEL_COLS - 1]])
        {
            const voxel = getVoxel(grid, row, col);
            for (let layer = COLLISION_LAYER_MIN; layer <= LEGACY_COLLISION_LAYER_MAX; ++layer)
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, layer)).toBe(true);
        }
    });
});

describe("the migrated room as a room", () => {
    it("holds no quad outside the grid's own range", () => {
        const grid = decode(loadFixture("procedural_12345").bytes);
        expect(grid.quadsMem.quads.length).toBe(NUM_VOXEL_QUADS_PER_ROOM);
    });

    it("leaves the entrance open", () => {
        // A migrated room a player cannot get into is a room that is gone, so this is checked on
        // the far side of the migration rather than only where the doorway is first carved.
        const grid = decode(loadFixture("procedural_1").bytes);
        const entrance = getVoxel(grid, NUM_VOXEL_ROWS - 1, 16);
        expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(entrance, COLLISION_LAYER_MIN)).toBe(false);
    });
});
