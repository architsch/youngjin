/**
 * Voxel grid version migration. Content blobs aren't rewritten in storage; the decoder reads each
 * version's format and steps it forward on every load. Fixtures were written by the previous commit's
 * encoder (see the fixtures' README), not a reimplementation.
 * - v1 -> v2 (height doubled): existing faces stay put, the old ceiling becomes a floor slab at the same
 *   height, and the new upper storey is empty.
 * - v2 -> v3 (doors hang on walls): the doorway cell is filled and finished like the wall; nothing else
 *   changes (reopening the doorway yields v2 byte for byte).
 * - v4 -> v5 (whether a quad is drawn is no longer stored): the bit that said so is cleared, and the room's
 *   blocks show the faces it drew, bar an outer shell that an older build left drawn.
 * - v5 -> v6 (blocks have shapes): nothing is rewritten. The spare bit now spells a block's shape, and
 *   clear, as every older room has it, spells a whole block.
 *
 * Fixtures record quads as their own versions stored them, with that bit, so a room read today is compared
 * against them with the bit put back from what its blocks show (see legacyQuad).
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

import BufferState from "../../../src/shared/networking/types/bufferState";
import VoxelGrid from "../../../src/shared/voxel/types/voxelGrid";
import Voxel from "../../../src/shared/voxel/types/voxel";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import VoxelUpdateUtil from "../../../src/shared/voxel/util/voxelUpdateUtil";
import { RoomVolumeConstructorMap } from "../../../src/shared/room/generation/maps/roomVolumeConstructorMap";
import RestrictedZone from "../../../src/shared/voxel/types/restrictedZone";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, INITIAL_MULTI_PLAYER_ENTRANCE_HEIGHT_IN_LAYERS,
    INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW,
    MAX_ENCODED_VOXEL_GRID_BYTES, MAX_RESTRICTED_ZONES, NUM_VOXEL_COLS,
    NUM_VOXEL_QUADS_PER_COLLISION_LAYER, NUM_VOXEL_QUADS_PER_ROOM,
    NUM_VOXEL_ROWS, VOXEL_BLOCK_SHAPE_EMPTY, VOXEL_BLOCK_SHAPE_WHOLE } from "../../../src/shared/system/sharedConstants";

const FIXTURE_DIR = path.join(__dirname, "../fixtures/legacyVoxelGrids");
const FIXTURE_NAMES = ["bare", "procedural_1", "procedural_7", "procedural_12345",
    "procedural_999999", "mixed"];

// Legacy room height, and where migration lays the slab (not today's storey floor height).
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

// The migrated room with its doorway reopened (v2's state), so preservation checks run against the
// recorded fixtures; a fill touching anything else wouldn't undo cleanly.
function decodeWithDoorwayReopened(bytes: Uint8Array): VoxelGrid
{
    const grid = decode(bytes);
    const doorway = RoomVolumeConstructorMap["InitialMultiplayerEntrance"]();
    for (let layer = doorway.collisionLayerMin; layer <= doorway.collisionLayerMax; ++layer)
    {
        const first = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(
            doorway.rowMin, doorway.colMin, layer);
        VoxelUpdateUtil.removeVoxelBlock(undefined, grid.voxels, first);

        // Removal hides faces but keeps their paint; a v2 doorway is unpainted, so clear it too.
        for (let i = 0; i < NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
            grid.quadsMem.quads[first + i] = 0;
    }
    return grid;
}

// The bit of a quad that said whether it was drawn, in the formats up to version 4.
const LEGACY_QUAD_VISIBLE_BIT = 0b10000000;

function quadTextureIndex(quad: number): number
{
    return quad & 0b01111111;
}

// Whether a quad a fixture recorded was drawn.
function quadIsVisible(quad: number): boolean
{
    return (quad & LEGACY_QUAD_VISIBLE_BIT) != 0;
}

// A quad of a room read today, as the formats up to version 4 stored it: its texture index under the bit
// that said it was drawn, which the room's blocks now decide.
function legacyQuad(grid: VoxelGrid, quadIndex: number): number
{
    return grid.quadsMem.quads[quadIndex] |
        (VoxelQueryUtil.isVoxelQuadVisible(grid.voxels, quadIndex) ? LEGACY_QUAD_VISIBLE_BIT : 0);
}

// The fixtures' hash over the legacy layers, which must survive migration byte for byte.
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
                hash ^= legacyQuad(grid, first + i);
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

        // Re-encoding stamps the current version, so migration is a one-time cost per room.
        const grid = decode(bytes);
        const out = new BufferState(new Uint8Array(1024 * 1024));
        grid.encode(out);
        expect(out.view[0]).toBe(VoxelGrid.latestFormatVersion);
    });

    it("keeps every layer the room already had, face for face", () => {
        expect(hashLegacyLayerQuads(decodeWithDoorwayReopened(bytes))).toBe(expected.layerQuadsHash);
    });

    it("keeps every voxel standing where it stood, and adds the storey floor over it", () => {
        const grid = decodeWithDoorwayReopened(bytes);
        expect(grid.voxels.length).toBe(NUM_VOXEL_ROWS * NUM_VOXEL_COLS);

        for (let i = 0; i < grid.voxels.length; ++i)
        {
            // The room's old contents, plus a slab at the height its ceiling used to hang at.
            expect(VoxelQueryUtil.getVoxelBlockLayerMask(grid.voxels[i])).toBe(
                expected.masks[i] | (1 << LEGACY_NUM_COLLISION_LAYERS));
        }
    });

    it("fills the doorway in, and finishes it like the wall it is now part of", () => {
        const grid = decode(bytes);
        const doorway = getVoxel(grid, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL);
        const wallBeside = getVoxel(grid, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW,
            INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL - 1);

        for (let layer = COLLISION_LAYER_MIN;
            layer < COLLISION_LAYER_MIN + INITIAL_MULTI_PLAYER_ENTRANCE_HEIGHT_IN_LAYERS; ++layer)
        {
            // Solid, so that a door has something to hang on...
            expect(VoxelQueryUtil.isVoxelBlockPresent(doorway, layer)).toBe(true);

            // ...and finished like its neighbour, so it reads as wall.
            const doorwayFirst = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(
                doorway.row, doorway.col, layer);
            const wallFirst = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(
                wallBeside.row, wallBeside.col, layer);
            const insideFace = VoxelQueryUtil.getVoxelQuadIndex(
                doorway.row, doorway.col, "z", "-", layer) - doorwayFirst;
            expect(quadTextureIndex(grid.quadsMem.quads[doorwayFirst + insideFace]))
                .toBe(quadTextureIndex(grid.quadsMem.quads[wallFirst + insideFace]));
        }
    });

    it("leaves the storey above the slab empty", () => {
        const grid = decode(bytes);
        for (const voxel of grid.voxels)
        {
            for (let layer = LEGACY_NUM_COLLISION_LAYERS + 1; layer <= COLLISION_LAYER_MAX; ++layer)
            {
                expect(VoxelQueryUtil.isVoxelBlockPresent(voxel, layer)).toBe(false);

                const first = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(voxel.row, voxel.col, layer);
                for (let i = 0; i < NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
                    expect(grid.quadsMem.quads[first + i]).toBe(0);
            }
        }
    });

    it("leaves the room's floor exactly as it was", () => {
        const grid = decodeWithDoorwayReopened(bytes);
        for (let i = 0; i < grid.voxels.length; ++i)
        {
            const voxel = grid.voxels[i];
            const quad = legacyQuad(grid, VoxelQueryUtil.getFloorVoxelQuadIndex(voxel.row, voxel.col));
            expect(quad).toBe(expected.floorQuads[i]);
        }
    });

    it("shows the old ceiling from below, as the underside of the new storey floor", () => {
        const grid = decodeWithDoorwayReopened(bytes);
        for (let i = 0; i < grid.voxels.length; ++i)
        {
            const voxel = grid.voxels[i];
            const slabQuadIndex = VoxelQueryUtil.getVoxelQuadIndex(
                voxel.row, voxel.col, "y", "-", LEGACY_NUM_COLLISION_LAYERS);
            const slabQuad = grid.quadsMem.quads[slabQuadIndex];

            // It carries what the ceiling tile it replaces carried...
            expect(quadTextureIndex(slabQuad)).toBe(quadTextureIndex(expected.ceilingQuads[i]));

            // ...visible exactly where the ceiling tile was (every cell not walled to the top).
            expect(VoxelQueryUtil.isVoxelQuadVisible(grid.voxels, slabQuadIndex))
                .toBe(quadIsVisible(expected.ceilingQuads[i]));
        }
    });

    it("hangs the room's own ceiling over the empty storey instead", () => {
        const grid = decode(bytes);
        for (let i = 0; i < grid.voxels.length; ++i)
        {
            const voxel = grid.voxels[i];
            const quadIndex = VoxelQueryUtil.getCeilingVoxelQuadIndex(voxel.row, voxel.col);

            // Nothing stands above it, so every cell is visible.
            expect(VoxelQueryUtil.isVoxelQuadVisible(grid.voxels, quadIndex)).toBe(true);
            expect(quadTextureIndex(grid.quadsMem.quads[quadIndex]))
                .toBe(quadTextureIndex(expected.ceilingQuads[i]));
        }
    });

    it("no longer holds which of its quads are drawn", () => {
        expect(decode(bytes).quadsMem.quads.every(quad => quad < LEGACY_QUAD_VISIBLE_BIT)).toBe(true);
    });

    it("comes out of a second decode identical to the first", () => {
        // Migration depends only on the blob, so repeated loads agree.
        const first = decode(bytes);
        const second = decode(bytes);
        expect(Array.from(second.quadsMem.quads)).toEqual(Array.from(first.quadsMem.quads));
        expect(second.voxels.map(v => VoxelQueryUtil.getVoxelBlockLayerMask(v)))
            .toEqual(first.voxels.map(v => VoxelQueryUtil.getVoxelBlockLayerMask(v)));
    });

    it("survives a round trip through the current format unchanged", () => {
        // Re-reading a migrated room must give the same room, or it decays on each save.
        const migrated = decode(bytes);
        const out = new BufferState(new Uint8Array(1024 * 1024));
        migrated.encode(out);
        const reloaded = decode(out.view.slice(0, out.byteIndex));

        expect(Array.from(reloaded.quadsMem.quads)).toEqual(Array.from(migrated.quadsMem.quads));
        expect(reloaded.voxels.map(v => VoxelQueryUtil.getVoxelBlockLayerMask(v)))
            .toEqual(migrated.voxels.map(v => VoxelQueryUtil.getVoxelBlockLayerMask(v)));
    });
});

describe("migrating a version-0 room", () => {
    // v0 shares v1's layout, so reading one exercises the whole conversion chain.
    const {bytes} = loadFixture("bare");
    const version0Bytes = bytes.slice();
    version0Bytes[0] = 0;

    it("is carried through every version up to the current one", () => {
        const grid = decode(version0Bytes);

        for (const voxel of grid.voxels)
        {
            expect(VoxelQueryUtil.isVoxelBlockPresent(voxel, LEGACY_NUM_COLLISION_LAYERS))
                .toBe(true);
        }

        // The corner walls version 1 introduced are there, standing through the room's lower storey.
        for (const [row, col] of [[0, 0], [0, NUM_VOXEL_COLS - 1],
            [NUM_VOXEL_ROWS - 1, 0], [NUM_VOXEL_ROWS - 1, NUM_VOXEL_COLS - 1]])
        {
            const voxel = getVoxel(grid, row, col);
            for (let layer = COLLISION_LAYER_MIN; layer <= LEGACY_COLLISION_LAYER_MAX; ++layer)
                expect(VoxelQueryUtil.isVoxelBlockPresent(voxel, layer)).toBe(true);
        }
    });
});

describe("the migrated room as a room", () => {
    it("holds no quad outside the grid's own range", () => {
        const grid = decode(loadFixture("procedural_12345").bytes);
        expect(grid.quadsMem.quads.length).toBe(NUM_VOXEL_QUADS_PER_ROOM);
    });

    it("seals the doorway, so that the room's door has a wall to hang on", () => {
        // An open doorway would reject the room's own door (see ObjectAttachmentUtil), so this is checked
        // after migration.
        const grid = decode(loadFixture("procedural_1").bytes);
        const entrance = getVoxel(grid, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL);
        expect(VoxelQueryUtil.isVoxelBlockPresent(entrance, COLLISION_LAYER_MIN)).toBe(true);
    });
});

// ─── Version 3 -> 4: restricted zones ───
// Zones are appended after the voxels, so every v3 voxel must read back unchanged (a byte of drift would
// still decode, just subtly wrong).

const V3_FIXTURE_DIR = path.join(__dirname, "../fixtures/voxelGridsV3");
const V3_FIXTURE_NAMES = ["solid", "hub", "regular", "mixed"];

interface Version3RoomDescription
{
    masks: number[];
    quadsHash: number;
    numVisibleQuads: number;
    byteLength: number;
}

function loadVersion3Fixture(name: string): {bytes: Uint8Array, expected: Version3RoomDescription}
{
    return {
        bytes: new Uint8Array(fs.readFileSync(path.join(V3_FIXTURE_DIR, `${name}.bin`))),
        expected: JSON.parse(fs.readFileSync(path.join(V3_FIXTURE_DIR, `${name}.json`), "utf8")),
    };
}

// The same fold the version-3 and version-4 fixtures were written with, over the whole of the room's quad
// memory as those versions held it.
function hashAllQuads(grid: VoxelGrid): number
{
    let hash = 0x811c9dc5; // FNV-1a
    for (let i = 0; i < grid.quadsMem.quads.length; ++i)
    {
        hash ^= legacyQuad(grid, i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash;
}

describe.each(V3_FIXTURE_NAMES)("migrating a version-3 room (%s)", (name) => {
    const {bytes, expected} = loadVersion3Fixture(name);

    it("is recognised as an older version than the one being written now", () => {
        expect(bytes[0]).toBe(3);
        expect(bytes.length).toBe(expected.byteLength);
        expect(decode(bytes).sourceFormatVersion).toBe(3);
    });

    it("comes back with every voxel exactly as it was written", () => {
        const grid = decode(bytes);
        expect(grid.voxels.map(v => VoxelQueryUtil.getVoxelBlockLayerMask(v))).toEqual(expected.masks);
        expect(hashAllQuads(grid)).toBe(expected.quadsHash);
        expect(countVisibleQuads(grid)).toBe(expected.numVisibleQuads);
        expect(grid.quadsMem.quads.every(quad => quad < LEGACY_QUAD_VISIBLE_BIT)).toBe(true);
    });

    it("comes back holding no restricted zones", () => {
        // Pre-zone rooms have no zones, so they stay fully editable.
        expect(decode(bytes).restrictedZones).toEqual([]);
    });

    it("survives a round trip through the current format unchanged", () => {
        const migrated = decode(bytes);
        migrated.restrictedZones = [new RestrictedZone(2, 9, 3, 11), new RestrictedZone(20, 20, 0, 31)];

        const out = new BufferState(new Uint8Array(MAX_ENCODED_VOXEL_GRID_BYTES));
        migrated.encode(out);
        expect(out.view[0]).toBe(VoxelGrid.latestFormatVersion);

        const reloaded = decode(out.view.slice(0, out.byteIndex));
        expect(Array.from(reloaded.quadsMem.quads)).toEqual(Array.from(migrated.quadsMem.quads));
        expect(reloaded.voxels.map(v => VoxelQueryUtil.getVoxelBlockLayerMask(v)))
            .toEqual(migrated.voxels.map(v => VoxelQueryUtil.getVoxelBlockLayerMask(v)));
        expect(reloaded.restrictedZones).toEqual(migrated.restrictedZones);
    });
});

// ─── Version 4 -> 5: whether a quad is drawn is no longer stored ───
// The layout doesn't change, so a careless reader would still decode these. What must hold is that the
// room's blocks show the faces the old bit said were drawn (see VoxelQueryUtil.isVoxelQuadVisible).

const V4_FIXTURE_DIR = path.join(__dirname, "../fixtures/voxelGridsV4");
const V4_FIXTURE_NAMES = ["hub", "regular", "mixed", "shell"];

interface Version4RoomDescription
{
    masks: number[];
    quadsHash: number;
    quadsHashWithoutOuterShell: number;
    numVisibleQuads: number;
    numVisibleOuterShellQuads: number;
    restrictedZones: number[][];
    byteLength: number;
}

function loadVersion4Fixture(name: string): {bytes: Uint8Array, expected: Version4RoomDescription}
{
    return {
        bytes: new Uint8Array(fs.readFileSync(path.join(V4_FIXTURE_DIR, `${name}.bin`))),
        expected: JSON.parse(fs.readFileSync(path.join(V4_FIXTURE_DIR, `${name}.json`), "utf8")),
    };
}

function countVisibleQuads(grid: VoxelGrid): number
{
    let count = 0;
    for (let quadIndex = 0; quadIndex < NUM_VOXEL_QUADS_PER_ROOM; ++quadIndex)
    {
        if (VoxelQueryUtil.isVoxelQuadVisible(grid.voxels, quadIndex))
            ++count;
    }
    return count;
}

describe.each(V4_FIXTURE_NAMES)("migrating a version-4 room (%s)", (name) => {
    const {bytes, expected} = loadVersion4Fixture(name);

    it("is recognised as an older version than the one being written now", () => {
        expect(bytes[0]).toBe(4);
        expect(bytes.length).toBe(expected.byteLength);
        expect(decode(bytes).sourceFormatVersion).toBe(4);
    });

    it("comes back with every voxel and every zone exactly as it was written", () => {
        const grid = decode(bytes);
        expect(grid.voxels.map(v => VoxelQueryUtil.getVoxelBlockLayerMask(v))).toEqual(expected.masks);
        expect(grid.restrictedZones.map(zone => [zone.rowMin, zone.rowMax, zone.colMin, zone.colMax]))
            .toEqual(expected.restrictedZones);
    });

    it("shows the faces it was stored as drawing, each in its texture, without an outer shell", () => {
        const grid = decode(bytes);
        expect(hashAllQuads(grid)).toBe(expected.quadsHashWithoutOuterShell);
        expect(countVisibleQuads(grid)).toBe(expected.numVisibleQuads - expected.numVisibleOuterShellQuads);
    });

    it("leaves the bit that said so unused, and keeps it so through a save", () => {
        const migrated = decode(bytes);
        expect(migrated.quadsMem.quads.every(quad => quad < LEGACY_QUAD_VISIBLE_BIT)).toBe(true);

        const out = new BufferState(new Uint8Array(MAX_ENCODED_VOXEL_GRID_BYTES));
        migrated.encode(out);
        expect(out.view[0]).toBe(VoxelGrid.latestFormatVersion);

        const reloaded = decode(out.view.slice(0, out.byteIndex));
        expect(Array.from(reloaded.quadsMem.quads)).toEqual(Array.from(migrated.quadsMem.quads));
        expect(reloaded.voxels.map(v => VoxelQueryUtil.getVoxelBlockLayerMask(v)))
            .toEqual(migrated.voxels.map(v => VoxelQueryUtil.getVoxelBlockLayerMask(v)));
        expect(reloaded.restrictedZones).toEqual(migrated.restrictedZones);
    });
});

describe("a room saved while the outer shell was still drawn", () => {
    // The shell stopped being drawn without the rooms already saved being rewritten, so theirs stayed
    // stored as drawn. Nothing stores it now.
    const {bytes, expected} = loadVersion4Fixture("shell");

    it("is the fixture whose stored shell the others lack", () => {
        expect(expected.numVisibleOuterShellQuads).toBeGreaterThan(0);
        for (const other of V4_FIXTURE_NAMES.filter(name => name != "shell"))
            expect(loadVersion4Fixture(other).expected.numVisibleOuterShellQuads, other).toBe(0);
    });

    it("comes back with no face drawn on the outside of the grid", () => {
        const grid = decode(bytes);
        for (let layer = COLLISION_LAYER_MIN; layer <= COLLISION_LAYER_MAX; ++layer)
        {
            const outwardQuadIndices: number[] = [];
            for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
            {
                outwardQuadIndices.push(VoxelQueryUtil.getVoxelQuadIndex(row, 0, "x", "-", layer));
                outwardQuadIndices.push(VoxelQueryUtil.getVoxelQuadIndex(row, NUM_VOXEL_COLS - 1, "x", "+", layer));
            }
            for (let col = 0; col < NUM_VOXEL_COLS; ++col)
            {
                outwardQuadIndices.push(VoxelQueryUtil.getVoxelQuadIndex(0, col, "z", "-", layer));
                outwardQuadIndices.push(VoxelQueryUtil.getVoxelQuadIndex(NUM_VOXEL_ROWS - 1, col, "z", "+", layer));
            }
            for (const quadIndex of outwardQuadIndices)
                expect(VoxelQueryUtil.isVoxelQuadVisible(grid.voxels, quadIndex)).toBe(false);
        }
    });
});

// ─── Version 5: the last format holding whole blocks only ───
// Its layout is the one still written, and its blocks are all whole, which is written the same way now. So
// one of these rooms must come back as it was, and be written again exactly as it was after its version.

const V5_FIXTURE_DIR = path.join(__dirname, "../fixtures/voxelGridsV5");
const V5_FIXTURE_NAMES = ["hub", "regular", "mixed"];

interface Version5RoomDescription
{
    masks: number[];
    quadsHash: number;
    numVisibleQuads: number;
    restrictedZones: number[][];
    byteLength: number;
}

function loadVersion5Fixture(name: string): {bytes: Uint8Array, expected: Version5RoomDescription}
{
    return {
        bytes: new Uint8Array(fs.readFileSync(path.join(V5_FIXTURE_DIR, `${name}.bin`))),
        expected: JSON.parse(fs.readFileSync(path.join(V5_FIXTURE_DIR, `${name}.json`), "utf8")),
    };
}

// The fold the version-5 fixtures were written with: over the room's quad memory as it is, which by then
// held texture indices alone.
function hashQuadMemory(grid: VoxelGrid): number
{
    let hash = 0x811c9dc5; // FNV-1a
    for (let i = 0; i < grid.quadsMem.quads.length; ++i)
    {
        hash ^= grid.quadsMem.quads[i];
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash;
}

describe.each(V5_FIXTURE_NAMES)("reading a version-5 room (%s)", (name) => {
    const {bytes, expected} = loadVersion5Fixture(name);

    it("is the room its fixture says it is", () => {
        expect(bytes[0]).toBe(5);
        expect(bytes.length).toBe(expected.byteLength);
        expect(decode(bytes).sourceFormatVersion).toBe(5);
    });

    it("comes back with every voxel, quad and zone exactly as it was written", () => {
        const grid = decode(bytes);
        expect(grid.voxels.map(v => VoxelQueryUtil.getVoxelBlockLayerMask(v))).toEqual(expected.masks);
        expect(hashQuadMemory(grid)).toBe(expected.quadsHash);
        expect(countVisibleQuads(grid)).toBe(expected.numVisibleQuads);
        expect(grid.restrictedZones.map(zone => [zone.rowMin, zone.rowMax, zone.colMin, zone.colMax]))
            .toEqual(expected.restrictedZones);
    });

    it("holds whole blocks and nothing else", () => {
        const grid = decode(bytes);
        expect(Array.from(grid.quadsMem.blockShapes).every(shape =>
            shape == VOXEL_BLOCK_SHAPE_EMPTY || shape == VOXEL_BLOCK_SHAPE_WHOLE)).toBe(true);
    });

    it("is written again exactly as it was, after its version", () => {
        const out = new BufferState(new Uint8Array(MAX_ENCODED_VOXEL_GRID_BYTES));
        decode(bytes).encode(out);
        expect(out.view[0]).toBe(VoxelGrid.latestFormatVersion);
        expect(Array.from(out.view.slice(1, out.byteIndex))).toEqual(Array.from(bytes.slice(1)));
    });
});

// ─── Version 6: blocks have shapes ──────────────────────────────────────────
// The layout is version 5's still. What is new is in the bit each quad's byte had to spare: on a block's
// four side quads it says that one of the block's sub-blocks is cut away (see Voxel).

describe("a room holding shrunk blocks", () => {
    const SHAPES = [VOXEL_BLOCK_SHAPE_WHOLE, 0b0101, 0b1010, 0b0011, 0b1100, 0b0001, 0b0010, 0b0100, 0b1000];
    const ROW = 10;
    const LAYER = 5;

    // One block of every shape in a row of an otherwise open stretch, each with textures of its own.
    function buildRoom(shapes: number[] = SHAPES): VoxelGrid
    {
        const grid = VoxelGrid.createBaseGrid();
        for (let col = 1; col <= 2 * shapes.length; ++col)
        {
            for (let layer = COLLISION_LAYER_MIN; layer <= COLLISION_LAYER_MAX; ++layer)
                VoxelUpdateUtil.removeVoxelBlock(undefined, grid.voxels, VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(ROW, col, layer));
        }
        shapes.forEach((shape, i) => {
            const textures = Array.from({length: NUM_VOXEL_QUADS_PER_COLLISION_LAYER}, (_, face) => 10 * (i + 1) + face);
            expect(VoxelUpdateUtil.addVoxelBlock(undefined, grid.voxels,
                VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(ROW, 2 * i + 1, LAYER), textures, undefined, shape)).toBe(true);
        });
        return grid;
    }

    function encode(grid: VoxelGrid): Uint8Array
    {
        const out = new BufferState(new Uint8Array(MAX_ENCODED_VOXEL_GRID_BYTES));
        grid.encode(out);
        return out.view.slice(0, out.byteIndex);
    }

    // Where a stored block's six quad bytes start, found by walking the layout itself.
    function storedBlockByteIndex(bytes: Uint8Array, row: number, col: number, layer: number): number
    {
        let byteIndex = 1; // past the version
        for (let voxelIndex = 0; voxelIndex < row * NUM_VOXEL_COLS + col; ++voxelIndex)
        {
            const mask = bytes[byteIndex + 2] | (bytes[byteIndex + 3] << 8);
            byteIndex += 4 + NUM_VOXEL_QUADS_PER_COLLISION_LAYER * countBits(mask);
        }
        const mask = bytes[byteIndex + 2] | (bytes[byteIndex + 3] << 8);
        expect(mask & (1 << layer), "the block is stored").not.toBe(0);
        return byteIndex + 4 + NUM_VOXEL_QUADS_PER_COLLISION_LAYER * countBits(mask & ((1 << layer) - 1));
    }

    function countBits(mask: number): number
    {
        let count = 0;
        for (; mask != 0; mask >>>= 1)
            count += mask & 1;
        return count;
    }

    it("comes back from its encoding with every block's shape and every quad as it was", () => {
        const grid = buildRoom();
        const reloaded = decode(encode(grid));

        expect(reloaded.sourceFormatVersion).toBe(VoxelGrid.latestFormatVersion);
        SHAPES.forEach((shape, i) => {
            expect(VoxelQueryUtil.getVoxelBlockShapeAt(reloaded.voxels, ROW, 2 * i + 1, LAYER), `block ${i}`).toBe(shape);
            const first = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(ROW, 2 * i + 1, LAYER);
            expect(Array.from(reloaded.quadsMem.quads.subarray(first, first + NUM_VOXEL_QUADS_PER_COLLISION_LAYER)), `block ${i}`)
                .toEqual(Array.from({length: NUM_VOXEL_QUADS_PER_COLLISION_LAYER}, (_, face) => 10 * (i + 1) + face));
        });
        expect(Array.from(reloaded.quadsMem.blockShapes)).toEqual(Array.from(grid.quadsMem.blockShapes));
        expect(countVisibleQuads(reloaded)).toBe(countVisibleQuads(grid));
        // Written again, it is the same bytes: reading and writing agree on what the spare bits mean.
        expect(Array.from(encode(reloaded))).toEqual(Array.from(encode(grid)));
    });

    it("takes exactly the bytes the same room of whole blocks takes, and differs from it in the spare bits alone", () => {
        const shrunk = encode(buildRoom());
        const whole = encode(buildRoom(SHAPES.map(() => VOXEL_BLOCK_SHAPE_WHOLE)));
        expect(shrunk.length).toBe(whole.length);

        const differing: number[] = [];
        for (let i = 0; i < whole.length; ++i)
        {
            if (shrunk[i] != whole[i])
                differing.push(shrunk[i] ^ whole[i]);
        }
        // One bit for each sub-block cut away: two from each of the four halves, three from each quarter.
        expect(differing.length).toBe(4 * 2 + 4 * 3);
        expect(differing.every(difference => difference == 0b10000000)).toBe(true);
    });

    it("spells a sub-block cut away on the side quad that stands for it, and nothing on the top and bottom", () => {
        const bytes = encode(buildRoom());
        SHAPES.forEach((shape, i) => {
            const first = storedBlockByteIndex(bytes, ROW, 2 * i + 1, LAYER);
            const spareBits = Array.from(bytes.subarray(first, first + NUM_VOXEL_QUADS_PER_COLLISION_LAYER),
                quadByte => quadByte >> 7);
            // Bottom, top, then the sub-blocks in the order of a shape's bits (x half + 2 * z half).
            expect(spareBits, `block ${i}`).toEqual([0, 0,
                (shape & 0b0001) ? 0 : 1, (shape & 0b0010) ? 0 : 1, (shape & 0b0100) ? 0 : 1, (shape & 0b1000) ? 0 : 1]);
        });
    });

    it("is refused when a stored block's bits spell no shape a block can have", () => {
        const bytes = encode(buildRoom());
        const first = storedBlockByteIndex(bytes, ROW, 1, LAYER); // the whole block
        const withSubBlocksCutAway = (...subBlocks: number[]) => {
            const tampered = bytes.slice();
            for (const subBlock of subBlocks)
                tampered[first + 2 + subBlock] |= 0b10000000;
            return tampered;
        };

        // Two sub-blocks left that only touch at a corner, three left in an L, and none left at all (a
        // layer with no block is simply not stored, so a stored one with nothing in it is a fault too).
        expect(() => decode(withSubBlocksCutAway(0, 3))).toThrow(/shape is invalid/);
        expect(() => decode(withSubBlocksCutAway(1, 2))).toThrow(/shape is invalid/);
        expect(() => decode(withSubBlocksCutAway(2))).toThrow(/shape is invalid/);
        expect(() => decode(withSubBlocksCutAway(0, 1, 2, 3))).toThrow(/shape is invalid/);
        // (Cutting a rectangle's worth away is just another block.)
        expect(VoxelQueryUtil.getVoxelBlockShapeAt(decode(withSubBlocksCutAway(0, 2)).voxels, ROW, 1, LAYER)).toBe(0b1010);

        // The bottom and top quads' spare bits are not part of the shape, and are dropped on reading.
        const strayBits = bytes.slice();
        strayBits[first] |= 0b10000000;
        strayBits[first + 1] |= 0b10000000;
        const read = decode(strayBits);
        expect(VoxelQueryUtil.getVoxelBlockShapeAt(read.voxels, ROW, 1, LAYER)).toBe(VOXEL_BLOCK_SHAPE_WHOLE);
        expect(Array.from(encode(read))).toEqual(Array.from(bytes));
    });

    it("keeps its quads' own memory to texture indices, whatever its blocks' shapes", () => {
        const reloaded = decode(encode(buildRoom()));
        expect(reloaded.quadsMem.quads.every(quadByte => (quadByte & 0b10000000) == 0)).toBe(true);
    });
});

describe("the encoded room's size bound", () => {
    it("holds for the largest room there is, with every zone it may carry", () => {
        // The encode buffer is sized from this bound, so exceeding it would write past the buffer.
        const grid = VoxelGrid.createBaseGrid(); // solid floor to ceiling: the costliest room to write
        for (let i = 0; i < MAX_RESTRICTED_ZONES; ++i)
            grid.restrictedZones.push(new RestrictedZone(i, i, 0, NUM_VOXEL_COLS - 1));

        const out = new BufferState(new Uint8Array(MAX_ENCODED_VOXEL_GRID_BYTES));
        grid.encode(out);
        expect(out.byteIndex).toBe(MAX_ENCODED_VOXEL_GRID_BYTES);
    });
});
