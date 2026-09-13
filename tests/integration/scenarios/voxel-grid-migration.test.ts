/**
 * Voxel grid version migration. Content blobs aren't rewritten in storage; the decoder reads each
 * version's format and steps it forward on every load. Fixtures were written by the previous commit's
 * encoder (see the fixtures' README), not a reimplementation.
 * - v1 -> v2 (height doubled): existing faces stay put, the old ceiling becomes a floor slab at the same
 *   height, and the new upper storey is empty.
 * - v2 -> v3 (doors hang on walls): the doorway cell is filled and finished like the wall; nothing else
 *   changes (reopening the doorway yields v2 byte for byte).
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
    NUM_VOXEL_ROWS } from "../../../src/shared/system/sharedConstants";

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

function quadTextureIndex(quad: number): number
{
    return quad & 0b01111111;
}

function quadIsVisible(quad: number): boolean
{
    return (quad & 0b10000000) != 0;
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
            expect(grid.voxels[i].collisionLayerMask).toBe(
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
            expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(doorway, layer)).toBe(true);

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
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, layer)).toBe(false);

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
            const quad = grid.quadsMem.quads[VoxelQueryUtil.getFloorVoxelQuadIndex(voxel.row, voxel.col)];
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

            // Nothing stands above it, so every cell is visible.
            expect(quadIsVisible(quad)).toBe(true);
            expect(quadTextureIndex(quad)).toBe(quadTextureIndex(expected.ceilingQuads[i]));
        }
    });

    it("comes out of a second decode identical to the first", () => {
        // Migration depends only on the blob, so repeated loads agree.
        const first = decode(bytes);
        const second = decode(bytes);
        expect(Array.from(second.quadsMem.quads)).toEqual(Array.from(first.quadsMem.quads));
        expect(second.voxels.map(v => v.collisionLayerMask))
            .toEqual(first.voxels.map(v => v.collisionLayerMask));
    });

    it("survives a round trip through the current format unchanged", () => {
        // Re-reading a migrated room must give the same room, or it decays on each save.
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
    // v0 shares v1's layout, so reading one exercises the whole conversion chain.
    const {bytes} = loadFixture("bare");
    const version0Bytes = bytes.slice();
    version0Bytes[0] = 0;

    it("is carried through every version up to the current one", () => {
        const grid = decode(version0Bytes);

        for (const voxel of grid.voxels)
        {
            expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, LEGACY_NUM_COLLISION_LAYERS))
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

    it("seals the doorway, so that the room's door has a wall to hang on", () => {
        // An open doorway would reject the room's own door (see WallAttachedObjectUtil), so this is checked
        // after migration.
        const grid = decode(loadFixture("procedural_1").bytes);
        const entrance = getVoxel(grid, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL);
        expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(entrance, COLLISION_LAYER_MIN)).toBe(true);
    });
});

// ─── Version 3 -> 4: restricted zones ───
// Zones are appended after the voxels, so every v3 byte must read back unchanged (a byte of drift would
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

// The same fold the version-3 fixtures were written with, over the whole of the room's quad memory.
function hashAllQuads(grid: VoxelGrid): number
{
    let hash = 0x811c9dc5; // FNV-1a
    for (let i = 0; i < grid.quadsMem.quads.length; ++i)
    {
        hash ^= grid.quadsMem.quads[i];
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
        expect(grid.voxels.map(v => v.collisionLayerMask)).toEqual(expected.masks);
        expect(hashAllQuads(grid)).toBe(expected.quadsHash);
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
        expect(reloaded.voxels.map(v => v.collisionLayerMask))
            .toEqual(migrated.voxels.map(v => v.collisionLayerMask));
        expect(reloaded.restrictedZones).toEqual(migrated.restrictedZones);
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
