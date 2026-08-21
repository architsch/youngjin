/**
 * Version migration of a room's objects, and the ranges their positions are measured against.
 *
 * An object's position is not stored as a coordinate. Each component is stored as a fraction of a
 * range, and multiplied back out by whatever that range says at the moment it is read — so the range
 * is part of the format. While the vertical one was written as [0, MAX_ROOM_Y], giving the room a
 * second storey doubled it, and every object already in storage came back at twice the height it was
 * placed at. Nothing failed; the stored bytes were still correct, and were still read correctly, as
 * a fraction of a room that had grown underneath them.
 *
 * Two things guard against that here:
 *   - the ranges are frozen, and are asserted to still contain the room, so a room that outgrows one
 *     fails these tests rather than silently moving every object in the game;
 *   - objects written before the change are recognised and put back, using the version of the voxel
 *     grid stored beside them — the object format's own version byte cannot date them, because it
 *     never moved when the meaning of its contents did.
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
    STOREY_FLOOR_COLLISION_LAYER, COLLISION_LAYER_HEIGHT } from "../../../src/shared/system/sharedConstants";

const FIXTURE_DIR = path.join(__dirname, "../fixtures/legacyVoxelGrids");
const ROOM_ID = "object-migration-room";
const SCRATCH_BUFFER_BYTES = 256 * 1024;

// The room's height before it gained a second storey, which is the range the fixtures' objects were
// measured against.
const LEGACY_MAX_ROOM_Y = 4;

const CANVAS_OBJECT_TYPE_INDEX = 2;

// Heights a painting was actually hung at in a one-storey room: eye level, and a little above it.
const LEGACY_PLACED_HEIGHTS = [1.5, 2.0];

function canvas(objectId: string, y: number): AddObjectSignal
{
    return new AddObjectSignal(ROOM_ID, "user-1", "User One", CANVAS_OBJECT_TYPE_INDEX, objectId,
        new ObjectTransform({x: 10.5, y, z: 4.5}, {x: 0, y: 0, z: 1}), {});
}

// A painting as the old code left it in storage, given the height it was actually hung at.
//
// Only the current encoder exists in this tree, and it measures against the present range — so
// writing the placed height directly would store a different fraction than the old encoder stored
// for that same height, and the blob would not be a legacy blob at all. Scaling the height by the
// ratio between the two ranges produces the fraction the old encoder really wrote. The check below
// pins that to what legacy rooms on the server actually hold: a painting hung at 1.5 reads back
// uncorrected at 3.0.
function legacyCanvas(objectId: string, placedHeight: number): AddObjectSignal
{
    return canvas(objectId, placedHeight * (ObjectTransform.encodableBounds.maxY / LEGACY_MAX_ROOM_Y));
}

// Builds a room blob the way storage holds one: a voxel grid, then the objects standing in it.
//
// The objects are encoded by the current encoder and their version byte then stamped back down. The
// two versions lay their bytes out identically, so that produces a real version-0 record — provided
// the heights handed in are the ones the old encoder would have written, which is what legacyCanvas
// is for. The grid in front of them is a real one written by the old code, so what the decoder is
// handed is a genuine pairing of the two.
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
        // The check that keeps this from happening again. These ranges are the format; growing the
        // room past one of them does not fail anywhere else, it just quietly rescales every object
        // already in storage. A room that outgrows one needs a new ObjectGroup version and a
        // converter, and this is what says so.
        const bounds = ObjectTransform.encodableBounds;
        expect(MAX_ROOM_Y).toBeLessThanOrEqual(bounds.maxY);
        expect(NUM_VOXEL_COLS).toBeLessThanOrEqual(bounds.maxX);
        expect(NUM_VOXEL_ROWS).toBeLessThanOrEqual(bounds.maxZ);
    });

    it("the ranges no longer track the room's own dimensions", () => {
        // Written as a fact about the file rather than about behaviour, because the behaviour is
        // indistinguishable until the day someone changes the room's height — which is the day it
        // matters. If MAX_ROOM_Y is reintroduced here, this is what notices.
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
        // Same object bytes, same version byte, a current grid in front of them. Rescaling these
        // would be the original fault repeated in the other direction — every painting in every
        // present-day room dropping to half its height.
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
        // The symptom this whole path exists for. A painting hung at the middle of a one-storey
        // wall read back at exactly the height the storey floor is laid at, so it was left standing
        // inside the new floor.
        const storeyFloorY = STOREY_FLOOR_COLLISION_LAYER * COLLISION_LAYER_HEIGHT;
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
        // The converters this replaced returned an empty group. Bumping the version without
        // replacing them would have emptied every legacy room instead of correcting it.
        const blob = buildRoomBlob(legacyVoxelGridBytes(),
            [legacyCanvas("a", 1.5), legacyCanvas("b", 2.0), legacyCanvas("c", 1.0)], 0);

        const {objectGroup} = decodeRoomBlob(blob);
        const objects = Object.values(objectGroup.objectById);

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

        // x and z are measured against the grid's own dimensions, which did not change — so the
        // correction must not touch them.
        expect(object.transform.pos.x).toBeCloseTo(10.5, 2);
        expect(object.transform.pos.z).toBeCloseTo(4.5, 2);
    });
});

function encodeCurrentVoxelGrid(): Uint8Array
{
    const view = new Uint8Array(SCRATCH_BUFFER_BYTES);
    const writeState = new BufferState(view);
    VoxelGrid.createEmpty().encode(writeState);
    return view.slice(0, writeState.byteIndex);
}
