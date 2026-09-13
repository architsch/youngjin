/**
 * Object transform migration. Positions are stored as fractions of ranges; when the vertical range was
 * MAX_ROOM_Y, adding a storey doubled every stored object's height. Guards: the ranges are frozen and
 * must still contain the room, and older objects are corrected using the stored voxel grid's version
 * (the object format's own version byte never changed).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "fs";
import path from "path";

import BufferState from "../../../src/shared/networking/types/bufferState";
import VoxelGrid from "../../../src/shared/voxel/types/voxelGrid";
import ObjectGroup from "../../../src/shared/object/types/objectGroup";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import { MAX_ROOM_Y, NUM_VOXEL_COLS, NUM_VOXEL_ROWS,
    COLLISION_LAYER_HEIGHT } from "../../../src/shared/system/sharedConstants";

const FIXTURE_DIR = path.join(__dirname, "../fixtures/legacyVoxelGrids");
const ROOM_ID = "object-migration-room";
const SCRATCH_BUFFER_BYTES = 256 * 1024;

// Room height before the second storey (the fixtures' original range).
const LEGACY_MAX_ROOM_Y = 4;

const CANVAS_OBJECT_TYPE_INDEX = 2;

// Heights a painting was actually hung at in a one-storey room: eye level, and a little above it.
const LEGACY_PLACED_HEIGHTS = [1.5, 2.0];

function canvas(objectId: string, y: number): AddObjectSignal
{
    return new AddObjectSignal(ROOM_ID, "user-1", "User One", CANVAS_OBJECT_TYPE_INDEX, objectId,
        new ObjectTransform({x: 10.5, y, z: 4.5}, {x: 0, y: 0, z: 1}), {});
}

// A legacy painting at a placed height, scaled by the range ratio into the fraction the old encoder
// wrote (a painting hung at 1.5 reads back uncorrected at 3.0).
function legacyCanvas(objectId: string, placedHeight: number): AddObjectSignal
{
    return canvas(objectId, placedHeight * (ObjectTransform.encodableBounds.maxY / LEGACY_MAX_ROOM_Y));
}

// A stored room blob: a real legacy voxel grid, then objects encoded now with their version byte
// stamped back to 0 (both versions share a layout).
function buildRoomBlob(voxelGridBytes: Uint8Array, objects: AddObjectSignal[],
    stampObjectVersion?: number): Uint8Array
{
    const view = new Uint8Array(SCRATCH_BUFFER_BYTES);
    view.set(voxelGridBytes, 0);

    const writeState = new BufferState(view, voxelGridBytes.length);
    const objectVersionByteIndex = writeState.byteIndex;
    new ObjectGroup(objects).encodeWithParams(writeState, {});

    if (stampObjectVersion != undefined)
        view[objectVersionByteIndex] = stampObjectVersion;

    return view.subarray(0, writeState.byteIndex);
}

// Reads a blob back the way the room loader does: the grid first, then the objects dated by it.
function decodeRoomBlob(bytes: Uint8Array): {voxelGrid: VoxelGrid, objectGroup: ObjectGroup}
{
    const readState = new BufferState(bytes);
    const voxelGrid = VoxelGrid.decode(readState) as VoxelGrid;
    const objectGroup = ObjectGroup.decodeWithParams(readState, ROOM_ID,
        voxelGrid.sourceFormatVersion) as ObjectGroup;
    return {voxelGrid, objectGroup};
}

function heightsOf(objectGroup: ObjectGroup): number[]
{
    return Object.values(objectGroup.objectById).map(object => object.transform.pos.y);
}

function legacyVoxelGridBytes(): Uint8Array
{
    return new Uint8Array(fs.readFileSync(path.join(FIXTURE_DIR, "procedural_1.bin")));
}

describe("object transform ranges and migration", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("the room still fits inside the ranges positions are measured against", () => {
        // The ranges are the format: outgrowing one needs a new ObjectGroup version and converter.
        const bounds = ObjectTransform.encodableBounds;
        expect(MAX_ROOM_Y).toBeLessThanOrEqual(bounds.maxY);
        expect(NUM_VOXEL_COLS).toBeLessThanOrEqual(bounds.maxX);
        expect(NUM_VOXEL_ROWS).toBeLessThanOrEqual(bounds.maxZ);
    });

    it("the ranges no longer track the room's own dimensions", () => {
        // Checked on the source, since behavior is identical until the room height changes.
        const source = fs.readFileSync(
            path.join(__dirname, "../../../src/shared/object/types/objectTransform.ts"), "utf8");
        const rangeDefinitions = source.substring(0, source.indexOf("export default class"));

        expect(rangeDefinitions).not.toMatch(/(X|Y|Z)_RANGE\s*=\s*\[[^\]]*[A-Z_]{4,}/);
    });

    it("puts back the height of objects placed before the room gained a storey", () => {
        const blob = buildRoomBlob(legacyVoxelGridBytes(),
            LEGACY_PLACED_HEIGHTS.map((y, i) => legacyCanvas(`legacy-${i}`, y)), 0);

        const {voxelGrid, objectGroup} = decodeRoomBlob(blob);

        expect(voxelGrid.sourceFormatVersion).toBe(1);
        for (const [i, placedHeight] of LEGACY_PLACED_HEIGHTS.entries())
            expect(heightsOf(objectGroup)[i]).toBeCloseTo(placedHeight, 3);
    });

    it("leaves objects placed after the change exactly where they are", () => {
        // A current grid must not trigger rescaling (it would halve present-day heights).
        const currentGridBytes = encodeCurrentVoxelGrid();
        const heights = [2.0, 5.5];
        const blob = buildRoomBlob(currentGridBytes,
            heights.map((y, i) => canvas(`current-${i}`, y)), 0);

        const {voxelGrid, objectGroup} = decodeRoomBlob(blob);

        expect(voxelGrid.sourceFormatVersion).toBe(VoxelGrid.latestFormatVersion);
        for (const [i, height] of heights.entries())
            expect(heightsOf(objectGroup)[i]).toBeCloseTo(height, 3);
    });

    it("keeps a painting off the storey floor that the migration lays", () => {
        // The original symptom: a mid-wall painting ended up inside the new storey floor. The slab sits at
        // the migrated room's full height.
        const storeyFloorY = LEGACY_MAX_ROOM_Y;
        const midWallOfOneStoreyRoom = LEGACY_MAX_ROOM_Y / 2;
        expect(midWallOfOneStoreyRoom * 2).toBeCloseTo(storeyFloorY, 6); // what used to happen

        const blob = buildRoomBlob(legacyVoxelGridBytes(),
            [legacyCanvas("mid-wall", midWallOfOneStoreyRoom)], 0);

        const [height] = heightsOf(decodeRoomBlob(blob).objectGroup);
        expect(height).toBeCloseTo(midWallOfOneStoreyRoom, 3);
        expect(height).toBeLessThan(storeyFloorY);
    });

    it("round-trips a current-version group without moving anything", () => {
        const heights = [0.5, 2.0, 4.5, 7.5];
        const blob = buildRoomBlob(encodeCurrentVoxelGrid(),
            heights.map((y, i) => canvas(`rt-${i}`, y)));

        const {objectGroup} = decodeRoomBlob(blob);
        for (const [i, height] of heights.entries())
            expect(heightsOf(objectGroup)[i]).toBeCloseTo(height, 3);
    });

    it("keeps every object of a legacy group, not just their heights", () => {
        // The old converters returned an empty group; a bare version bump would have emptied legacy rooms.
        const blob = buildRoomBlob(legacyVoxelGridBytes(),
            [legacyCanvas("a", 1.5), legacyCanvas("b", 2.0), legacyCanvas("c", 1.0)], 0);

        const {objectGroup} = decodeRoomBlob(blob);
        // Legacy rooms also gain their entrance door (see ObjectGroup's converters); only canvases matter here.
        const objects = Object.values(objectGroup.objectById)
            .filter(object => object.objectTypeIndex === CANVAS_OBJECT_TYPE_INDEX);

        expect(objects).toHaveLength(3);
        expect(objects.map(o => o.objectId).sort()).toEqual(["a", "b", "c"]);
        for (const object of objects)
        {
            expect(object.objectTypeIndex).toBe(CANVAS_OBJECT_TYPE_INDEX);
            expect(object.transform.pos.x).toBeCloseTo(10.5, 2);
            expect(object.transform.pos.z).toBeCloseTo(4.5, 2);
            expect(object.transform.dir.z).toBeCloseTo(1, 2);
        }
    });

    it("leaves horizontal position untouched by the vertical correction", () => {
        const blob = buildRoomBlob(legacyVoxelGridBytes(), [legacyCanvas("h", 2.0)], 0);
        const [object] = Object.values(decodeRoomBlob(blob).objectGroup.objectById);

        // The x and z ranges didn't change, so they're untouched.
        expect(object.transform.pos.x).toBeCloseTo(10.5, 2);
        expect(object.transform.pos.z).toBeCloseTo(4.5, 2);
    });
});

function encodeCurrentVoxelGrid(): Uint8Array
{
    const view = new Uint8Array(SCRATCH_BUFFER_BYTES);
    const writeState = new BufferState(view);
    VoxelGrid.createBaseGrid().encode(writeState);
    return view.slice(0, writeState.byteIndex);
}
