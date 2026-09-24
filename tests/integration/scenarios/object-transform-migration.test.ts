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
import { LAST_UNSCALED_OBJECT_GROUP_VERSION, writeLegacyObjectGroup } from "../helpers/legacyObjectGroup";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import ObjectScaleUtil from "../../../src/shared/object/util/objectScaleUtil";
import LabelTextUtil from "../../../src/shared/object/util/labelTextUtil";
import CanvasObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/canvasObjectTypeConfig";
import LampObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/lampObjectTypeConfig";
import StringUtil from "../../../src/shared/math/util/stringUtil";
import { ColorPaletteMap } from "../../../src/shared/math/maps/colorPaletteMap";
import CompositionMetadataUtil from "../../../src/shared/graphics/mesh/composition/util/compositionMetadataUtil";
import VoxelGrid from "../../../src/shared/voxel/types/voxelGrid";
import ObjectGroup from "../../../src/shared/object/types/objectGroup";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import EncodableByteString from "../../../src/shared/networking/types/encodableByteString";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import { MAX_ROOM_Y, NUM_VOXEL_COLS, NUM_VOXEL_ROWS,
    COLLISION_LAYER_HEIGHT, LIGHT_COLOR_PALETTE_NAME, UNIT_VEC3 } from "../../../src/shared/system/sharedConstants";

const FIXTURE_DIR = path.join(__dirname, "../fixtures/legacyVoxelGrids");
const ROOM_ID = "object-migration-room";
const SCRATCH_BUFFER_BYTES = 256 * 1024;

// Room height before the second storey (the fixtures' original range).
const LEGACY_MAX_ROOM_Y = 4;

const CANVAS_OBJECT_TYPE_INDEX = 2;
const COMPOSITION_KEY = ObjectMetadataKeyEnumMap.InstancedMeshComposition;

// Heights a painting was actually hung at in a one-storey room: eye level, and a little above it.
const LEGACY_PLACED_HEIGHTS = [1.5, 2.0];

function canvas(objectId: string, y: number): AddObjectSignal
{
    return new AddObjectSignal(ROOM_ID, "user-1", "User One", CANVAS_OBJECT_TYPE_INDEX, objectId,
        new ObjectTransform({x: 10.5, y, z: 4.5}, {x: 0, y: 0, z: 1}, {...UNIT_VEC3}), {});
}

// A legacy painting at a placed height, scaled by the range ratio into the fraction the old encoder
// wrote (a painting hung at 1.5 reads back uncorrected at 3.0).
function legacyCanvas(objectId: string, placedHeight: number): AddObjectSignal
{
    return canvas(objectId, placedHeight * (ObjectTransform.encodableBounds.maxY / LEGACY_MAX_ROOM_Y));
}

// A stored room blob: a real legacy voxel grid, then its objects. Writing an older version writes that
// version's own layout (see writeLegacyObjectGroup), not just its version byte.
function buildRoomBlob(voxelGridBytes: Uint8Array, objects: AddObjectSignal[],
    stampObjectVersion?: number): Uint8Array
{
    const view = new Uint8Array(SCRATCH_BUFFER_BYTES);
    view.set(voxelGridBytes, 0);

    const writeState = new BufferState(view, voxelGridBytes.length);
    if (stampObjectVersion == undefined)
        new ObjectGroup(objects).encodeWithParams(writeState, {});
    else if (stampObjectVersion > LAST_UNSCALED_OBJECT_GROUP_VERSION)
    {
        // Laid out as the current version is; only the leading version byte differs.
        new ObjectGroup(objects).encodeWithParams(writeState, {});
        view[voxelGridBytes.length] = stampObjectVersion;
    }
    else
        writeLegacyObjectGroup(writeState, objects, stampObjectVersion);

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

    it("gives every object of a group stored before scale existed its type's base size", () => {
        const blob = buildRoomBlob(encodeCurrentVoxelGrid(),
            [canvas("a", 2.0), canvas("b", 3.0)], LAST_UNSCALED_OBJECT_GROUP_VERSION);

        const {objectGroup} = decodeRoomBlob(blob);

        expect(objectGroup.sourceFormatVersion).toBe(LAST_UNSCALED_OBJECT_GROUP_VERSION);
        for (const object of Object.values(objectGroup.objectById))
            expect(object.transform.scale).toEqual(UNIT_VEC3);
    });

    it("keeps a lamp stored before lamps could be resized at the one voxel by one layer it was drawn at", () => {
        const lampTypeIndex = ObjectTypeConfigMap.getIndexByType("Lamp");
        const lamp = (objectId: string) => new AddObjectSignal(ROOM_ID, "user-1", "User One", lampTypeIndex,
            objectId, new ObjectTransform({x: 10.5, y: 2.25, z: 4}, {x: 0, y: 0, z: 1}, {...UNIT_VEC3}), {});

        // Both with a stored scale (always unit, since lamps had no scaling) and from before scales.
        for (const version of [LAST_UNSCALED_OBJECT_GROUP_VERSION, LAST_UNSCALED_OBJECT_GROUP_VERSION + 1])
        {
            const blob = buildRoomBlob(encodeCurrentVoxelGrid(), [lamp("lamp"), canvas("canvas", 2.0)], version);
            const {objectGroup} = decodeRoomBlob(blob);

            const stored = objectGroup.objectById["lamp"];
            expect(ObjectScaleUtil.getObjectSize(lampTypeIndex, stored.transform.scale).x, `version ${version}`)
                .toBeCloseTo(1, 6);
            expect(ObjectScaleUtil.getObjectSize(lampTypeIndex, stored.transform.scale).y, `version ${version}`)
                .toBeCloseTo(COLLISION_LAYER_HEIGHT, 6);
            expect(stored.transform.pos.y).toBeCloseTo(2.25, 3);
            // Only lamps are converted.
            expect(ObjectScaleUtil.sanitize(CANVAS_OBJECT_TYPE_INDEX, objectGroup.objectById["canvas"].transform.scale))
                .toEqual(UNIT_VEC3);
        }
    });

    it("drops a lamp's stored look, and shrinks one past the largest size where it stands", () => {
        const lampTypeIndex = ObjectTypeConfigMap.getIndexByType("Lamp");
        const LAST_FRAMED_LAMP_VERSION = 5;
        const look = () => ({[COMPOSITION_KEY]: new EncodableByteString("&!Sa%\"")});
        const lamp = (objectId: string, pos: {x: number, y: number, z: number}, scale: number) =>
            new AddObjectSignal(ROOM_ID, "user-1", "User One", lampTypeIndex, objectId,
                new ObjectTransform(pos, {x: 0, y: 0, z: 1}, {x: scale, y: scale, z: 1}), look());
        // On a wall, their bottom edges on the layer boundaries at 0.5 and 2.
        const tall = lamp("tall", {x: 10, y: 1.25, z: 4}, 1.5);
        const kept = lamp("kept", {x: 12, y: 2.5, z: 4}, 1);
        // A canvas's own framed finish of the time: its codec, then frame, inner, band step and flags.
        const framedCanvas = canvas("canvas", 2.0);
        framedCanvas.metadata = {[COMPOSITION_KEY]: new EncodableByteString("%!+5$$")};

        const blob = buildRoomBlob(encodeCurrentVoxelGrid(), [tall, kept, framedCanvas], LAST_FRAMED_LAMP_VERSION);
        const {objectGroup} = decodeRoomBlob(blob);

        for (const objectId of ["tall", "kept"])
            expect(objectGroup.objectById[objectId].metadata[COMPOSITION_KEY], objectId).toBeUndefined();
        // Only lamps lost their looks; a canvas keeps one of its own.
        expect(CompositionMetadataUtil.isIndexedLookOf("Canvas", 0,
            objectGroup.objectById["canvas"].metadata[COMPOSITION_KEY]?.str ?? "")).toBe(true);

        const shrunk = objectGroup.objectById["tall"].transform;
        expect(ObjectScaleUtil.sanitize(lampTypeIndex, shrunk.scale)).toEqual({x: 1, y: 1, z: 1});
        expect(shrunk.pos.x).toBeCloseTo(10, 3);
        expect(shrunk.pos.y - 0.5).toBeCloseTo(0.5, 3);

        const unchanged = objectGroup.objectById["kept"].transform;
        expect(ObjectScaleUtil.sanitize(lampTypeIndex, unchanged.scale)).toEqual({x: 1, y: 1, z: 1});
        expect(unchanged.pos.y).toBeCloseTo(2.5, 3);
    });

    it("carries a lamp's light color over to the nearest one the trimmed palette still offers", () => {
        const LAST_SIX_SATURATION_LIGHT_VERSION = 5;
        const lampTypeIndex = ObjectTypeConfigMap.getIndexByType("Lamp");
        const lightKey = ObjectMetadataKeyEnumMap.LightProperties;
        const char = StringUtil.convertRawNumberToVisibleASCII;
        const lamp = (objectId: string, lightProperties: string | undefined) => new AddObjectSignal(ROOM_ID,
            "user-1", "User One", lampTypeIndex, objectId,
            new ObjectTransform({x: 12, y: 2.5, z: 4}, {x: 0, y: 0, z: 1}, {...UNIT_VEC3}),
            (lightProperties == undefined) ? {} : {[lightKey]: new EncodableByteString(lightProperties)});
        // Color, intensity and range, one char each: a soft green that was dropped, and a pure blue that wasn't.
        const blob = buildRoomBlob(encodeCurrentVoxelGrid(), [lamp("tinted", char(47) + char(8) + char(9)),
            lamp("kept", char(87)), lamp("unset", undefined)], LAST_SIX_SATURATION_LIGHT_VERSION);
        const {objectGroup} = decodeRoomBlob(blob);
        const colorOf = (object: AddObjectSignal) =>
            ColorPaletteMap[LIGHT_COLOR_PALETTE_NAME][LampObjectTypeConfig.util.getColorIndex(object)];

        const tinted = objectGroup.objectById["tinted"];
        expect(colorOf(tinted)).toBe("#c2ffc2");
        expect(LampObjectTypeConfig.util.getIntensity(tinted)).toBe(8);
        expect(LampObjectTypeConfig.util.getRange(tinted)).toBe(9);
        expect(colorOf(objectGroup.objectById["kept"])).toBe("#0000ff");
        expect(objectGroup.objectById["unset"].metadata[lightKey]).toBeUndefined();

        // A current group is already in the trimmed palette's positions.
        const {objectGroup: currentGroup} = decodeRoomBlob(
            buildRoomBlob(encodeCurrentVoxelGrid(), [lamp("current", char(20))]));
        expect(LampObjectTypeConfig.util.getColorIndex(currentGroup.objectById["current"])).toBe(20);
    });

    it("keeps a label's font size at the nearest one still on offer, and its Auto Size as it was", () => {
        const LAST_STEPPED_LABEL_FONT_VERSION = 5;
        const labelTypeIndex = ObjectTypeConfigMap.getIndexByType("Label");
        // A flags character, then the size as a step of 8 pixels above 16.
        const legacyFont = (autoSize: boolean, fontSize: number) =>
            String.fromCharCode(33 + (autoSize ? 1 : 0), 33 + (fontSize - 16) / 8);
        const label = (objectId: string, font: string | undefined) => new AddObjectSignal(ROOM_ID, "user-1",
            "User One", labelTypeIndex, objectId,
            new ObjectTransform({x: 10.5, y: 2.25, z: 4}, {x: 0, y: 0, z: 1}, {...UNIT_VEC3}),
            (font == undefined) ? {} : {[ObjectMetadataKeyEnumMap.LabelFont]: new EncodableByteString(font)});
        // 128's old step is the position of another size now, so it is kept only if converted.
        const expected: {[objectId: string]: [string | undefined, {autoSize: boolean, fontSize: number}]} = {
            "on-offer": [legacyFont(false, 128), {autoSize: false, fontSize: 128}],
            "between": [legacyFont(false, 72), {autoSize: false, fontSize: 80}],
            "largest": [legacyFont(true, 248), {autoSize: true, fontSize: 256}],
            "flags-only": [legacyFont(false, 16).substring(0, 1), {autoSize: false, fontSize: 64}],
            "unset": [undefined, {autoSize: true, fontSize: 64}],
        };

        const blob = buildRoomBlob(encodeCurrentVoxelGrid(),
            Object.entries(expected).map(([objectId, [font]]) => label(objectId, font)), LAST_STEPPED_LABEL_FONT_VERSION);
        const {objectGroup} = decodeRoomBlob(blob);
        for (const [objectId, [, font]] of Object.entries(expected))
            expect(LabelTextUtil.getFont(objectGroup.objectById[objectId]), objectId).toEqual(font);

        // A current group is already in positions.
        const current = label("current", LabelTextUtil.encodeFont(false, 128));
        const {objectGroup: currentGroup} = decodeRoomBlob(buildRoomBlob(encodeCurrentVoxelGrid(), [current]));
        expect(LabelTextUtil.getFont(currentGroup.objectById["current"]).fontSize).toBe(128);
    });

    it("brings a resized object back at the size it was stored at, off the wire's coarser grid", () => {
        // The scale byte decodes slightly below what was written, so what comes back is only right
        // once it is snapped to the type's own step (see ObjectScaleUtil).
        const scaling = CanvasObjectTypeConfig.scaling;
        for (let scale = scaling.minScale.x; scale <= scaling.maxScale.x; scale += scaling.scaleStep.x)
        {
            const resized = canvas("resized", 2.0);
            resized.transform.scale = {x: scale, y: scale, z: 1};
            const blob = buildRoomBlob(encodeCurrentVoxelGrid(), [resized]);

            const stored = decodeRoomBlob(blob).objectGroup.objectById["resized"];
            expect(ObjectScaleUtil.sanitize(CANVAS_OBJECT_TYPE_INDEX, stored.transform.scale))
                .toEqual({x: scale, y: scale, z: 1});
        }
    });

    it("holds a scale no canvas is allowed to whatever the stored bytes say", () => {
        const hostile = canvas("hostile", 2.0);
        hostile.transform.scale = {x: 999, y: -5, z: 7};
        const blob = buildRoomBlob(encodeCurrentVoxelGrid(), [hostile]);

        const stored = decodeRoomBlob(blob).objectGroup.objectById["hostile"];
        const scaling = CanvasObjectTypeConfig.scaling;
        expect(ObjectScaleUtil.sanitize(CANVAS_OBJECT_TYPE_INDEX, stored.transform.scale))
            .toEqual({x: scaling.maxScale.x, y: scaling.minScale.y, z: 1});
    });

    it("holds a type that declares no scaling at its base size, whatever it was handed", () => {
        const doorTypeIndex = ObjectTypeConfigMap.getIndexByType("Door");
        expect(ObjectScaleUtil.sanitize(doorTypeIndex, {x: 3, y: 0.1, z: 2})).toEqual(UNIT_VEC3);
    });

    it("keeps every object of a legacy group, not just their heights", () => {
        // The old converters returned an empty group; a bare version bump would have emptied legacy rooms.
        const blob = buildRoomBlob(legacyVoxelGridBytes(),
            [legacyCanvas("a", 1.5), legacyCanvas("b", 2.0), legacyCanvas("c", 1.0)], 0);

        const {objectGroup} = decodeRoomBlob(blob);
        // Legacy rooms also gain their entrance door (see ObjectGroupVersionMigration); only canvases matter here.
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
