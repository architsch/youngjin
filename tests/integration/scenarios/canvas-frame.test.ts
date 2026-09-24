/**
 * Canvas frames. A canvas shows one of its pre-encoded looks: the picture alone, over its whole footprint, or
 * one moulded wood board over the footprint whose band frames the picture. An object stores only which look,
 * checked against its type's own; the looks are framed panel strings, which decode as untrusted input like
 * any composition. Rooms saved with bitmap frames (CanvasFrameCoords), or with finishes in the codecs canvases,
 * labels and doors used to store their own, are converted on load.
 * Covers: the Default codec's wood parts, the framed panel codec, a canvas's looks, defaults and permissions,
 * the ObjectGroup migrations, the per-type pre-encoded table, and the thumbnail atlas layout.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import fc from "fast-check";

import { DefaultCompositionCodec } from "../../../src/shared/graphics/mesh/composition/types/compositionCodec/defaultCompositionCodec";
import { FramedPanelCompositionCodec } from "../../../src/shared/graphics/mesh/composition/types/compositionCodec/framedPanelCompositionCodec";
import FramedPanelCompositionConstants from "../../../src/shared/graphics/mesh/composition/types/compositionConstants/framedPanelCompositionConstants";
import MouldingCompositionConstants from "../../../src/shared/graphics/mesh/composition/types/compositionConstants/mouldingCompositionConstants";
import { InstancedMeshCompositionCodecTypeEnumMap } from "../../../src/shared/graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import PreEncodedCompositionStringMap from "../../../src/shared/graphics/mesh/composition/maps/preEncodedCompositionStringMap";
import PreEncodedCompositionIndexMap from "../../../src/shared/graphics/mesh/composition/maps/preEncodedCompositionIndexMap";
import CompositionThumbnailUtil from "../../../src/shared/graphics/mesh/composition/util/compositionThumbnailUtil";
import CompositionMetadataUtil from "../../../src/shared/graphics/mesh/composition/util/compositionMetadataUtil";
import InstancedMeshCompositionPart from "../../../src/shared/graphics/mesh/composition/types/instancedMeshCompositionPart";
import { InstancedMeshCompositionParams } from "../../../src/shared/graphics/mesh/composition/types/compositionParams/instancedMeshCompositionParams";
import ColorUtil from "../../../src/shared/math/util/colorUtil";
import StringUtil from "../../../src/shared/math/util/stringUtil";
import Vec3 from "../../../src/shared/math/types/vec3";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import CanvasObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/canvasObjectTypeConfig";
import ObjectScaleUtil from "../../../src/shared/object/util/objectScaleUtil";
import { LAST_UNSCALED_OBJECT_GROUP_VERSION, writeLegacyObjectGroup } from "../helpers/legacyObjectGroup";
import { getLooks } from "../helpers/composition";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import ObjectGroup from "../../../src/shared/object/types/objectGroup";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import BufferState from "../../../src/shared/networking/types/bufferState";
import EncodableByteString from "../../../src/shared/networking/types/encodableByteString";
import ImageMapUtil from "../../../src/shared/graphics/image/util/imageMapUtil";
import { COMPOSITION_PALETTE_NAME_BY_MATERIAL_ID, GEOMETRY_CODE_BY_ID, INSTANCE_COLORED_MATERIAL_IDS,
    INSTANCED_COLOR_MATERIAL_ID, INSTANCED_WOOD_MATERIAL_ID, MATERIAL_CODE_BY_ID,
    RELIEF_STEP, UNIT_VEC3 } from "../../../src/shared/system/sharedConstants";

const COMPOSITION_KEY = ObjectMetadataKeyEnumMap.InstancedMeshComposition;
const FRAME_COORDS_KEY = ObjectMetadataKeyEnumMap.CanvasFrameCoords;
const ROOM_ID = "canvas-frame-room";
const CANVAS_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType("Canvas");
const DOOR_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType("Door");

const CANVAS_CONFIG = CanvasObjectTypeConfig.components.spawnedByAny;
const CANVAS_COMPOSER = CANVAS_CONFIG.instancedMeshComposer;

// The types that show a framed panel: a canvas's picture or a label's text inside the band.
const FRAMED_PANEL_TYPES = ["Canvas", "Label"];

// A canvas nobody has resized, which is what every case here but the resize ones is about.
function canvasBaseSize()
{
    return ObjectScaleUtil.getObjectSize(CANVAS_TYPE_INDEX, UNIT_VEC3);
}

// The Default codec's quantization grids. A value on the grid must survive a round trip exactly.
const OFFSET_STEP = 0.0625;
const SCALE_STEP = 0.125;

const DEFAULT_CODEC_VERSION = 1;
const DEFAULT_PREFIX = StringUtil.convertRawNumberToVisibleASCII(InstancedMeshCompositionCodecTypeEnumMap.Default)
    + StringUtil.convertRawNumberToVisibleASCII(DEFAULT_CODEC_VERSION);
const FRAMED_PANEL_PREFIX = CompositionMetadataUtil.getCodecPrefix(InstancedMeshCompositionCodecTypeEnumMap.FramedPanel, 0);

// Authored the way the codec stores parts: colors from the material's palette, band width on a
// thickness step, offset and scale on the quantization grid.
function woodPart(overrides: Partial<InstancedMeshCompositionPart> = {}): InstancedMeshCompositionPart
{
    return {
        geometryId: "Square",
        materialId: INSTANCED_WOOD_MATERIAL_ID,
        dir: {x: 0, y: 0, z: 1},
        offset: {x: 0, y: 0, z: 0},
        scale: {x: 1, y: 1, z: 1},
        color: ColorUtil.paletteIndexToRGB("Timber", 12),
        mouldingColor: ColorUtil.paletteIndexToRGB("Timber", 30),
        mouldingThickness: MouldingCompositionConstants.fromThicknessStep(5),
        mouldingIsConvex: true,
        ...overrides,
    };
}

function colorPart(overrides: Partial<InstancedMeshCompositionPart> = {}): InstancedMeshCompositionPart
{
    return {
        geometryId: "Square",
        materialId: INSTANCED_COLOR_MATERIAL_ID,
        dir: {x: 0, y: 0, z: 1},
        offset: {x: 0.5, y: 0, z: 0},
        scale: {x: 1, y: 1, z: 1},
        color: ColorUtil.paletteIndexToRGB("Scenery", 7),
        ...overrides,
    };
}

function decodeDefault(encoded: string): InstancedMeshCompositionPart[]
{
    const parts: InstancedMeshCompositionPart[] = [];
    DefaultCompositionCodec.decode(encoded, UNIT_VEC3, {}, parts);
    return parts;
}

function decodePanel(encoded: string, objectSize: Vec3 = canvasBaseSize()):
    {params: InstancedMeshCompositionParams, parts: InstancedMeshCompositionPart[]}
{
    const params: InstancedMeshCompositionParams = {};
    const parts: InstancedMeshCompositionPart[] = [];
    FramedPanelCompositionCodec.decode(encoded, objectSize, params, parts);
    return {params, parts};
}

function encodePanel(params: InstancedMeshCompositionParams): string
{
    return FRAMED_PANEL_PREFIX + FramedPanelCompositionCodec.encode(params, []);
}

// The wood inputs alone (ids aside), for comparing finishes.
function finishOf(params: InstancedMeshCompositionParams)
{
    return {colors: params.colors, mouldingThickness: params.mouldingThickness,
        mouldingIsConvex: params.mouldingIsConvex};
}

function canvas(objectId: string, metadata: {[key: number]: string} = {}): AddObjectSignal
{
    return objectOfType(CANVAS_TYPE_INDEX, objectId, metadata);
}

function objectOfType(objectTypeIndex: number, objectId: string, metadata: {[key: number]: string} = {}): AddObjectSignal
{
    const encodableMetadata: {[key: number]: EncodableByteString} = {};
    for (const key of Object.keys(metadata))
        encodableMetadata[Number(key)] = new EncodableByteString(metadata[Number(key)]);
    return new AddObjectSignal(ROOM_ID, "user-1", "User One", objectTypeIndex, objectId,
        new ObjectTransform({x: 10.5, y: 2, z: 4.5}, {x: 0, y: 0, z: 1}, {...UNIT_VEC3}),
        encodableMetadata);
}

// Every part must carry finite, in-range moulding inputs the wood material reads.
function expectMoulded(part: InstancedMeshCompositionPart): void
{
    expect(part.mouldingThickness).toBeGreaterThan(0);
    expect(typeof part.mouldingIsConvex).toBe("boolean");
    for (const channel of [part.mouldingColor.x, part.mouldingColor.y, part.mouldingColor.z])
    {
        expect(Number.isFinite(channel)).toBe(true);
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(255);
    }
}

// A drawable panel: one moulded board, with room inside its band for the picture, or no parts at all
// when there is no frame.
function expectDrawablePanel(params: InstancedMeshCompositionParams, parts: InstancedMeshCompositionPart[]): void
{
    expect(params.mouldingThickness).toBeGreaterThanOrEqual(MouldingCompositionConstants.minMouldingThickness);
    if (!params.framed)
    {
        expect(parts).toHaveLength(0);
        return;
    }
    expect(parts).toHaveLength(1);
    const [board] = parts;
    expect(board.geometryId).toBe("Square");
    expect(board.materialId).toBe(INSTANCED_WOOD_MATERIAL_ID);
    expectMoulded(board);
    expect(board.mouldingThickness).toBeGreaterThanOrEqual(MouldingCompositionConstants.minMouldingThickness);
    expect(board.mouldingThickness).toBeLessThanOrEqual(MouldingCompositionConstants.maxMouldingThickness);
    for (const vec of [board.offset, board.dir, board.scale])
        for (const axis of ["x", "y", "z"] as const)
            expect(Number.isFinite(vec[axis])).toBe(true);
    // The picture covers the surface inside the band (see CanvasGameObject).
    const pictureSize = Math.min(board.scale.x, board.scale.y) - 2 * board.mouldingThickness;
    expect(pictureSize).toBeGreaterThan(0);
}

function luma(color: Vec3): number
{
    return 0.2126 * color.x + 0.7152 * color.y + 0.0722 * color.z;
}

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("Default composition codec", () => {
    it("a wood part keeps its geometry, material and moulding through the round trip", () => {
        const part = woodPart();
        const [decoded] = decodeDefault(DEFAULT_PREFIX + DefaultCompositionCodec.encode({}, [part]));

        expect(decoded.geometryId).toBe("Square");
        expect(decoded.materialId).toBe(INSTANCED_WOOD_MATERIAL_ID);
        expect(decoded.mouldingIsConvex).toBe(true);
        expect(decoded.mouldingThickness).toBe(part.mouldingThickness);
        // Palette colors are stored as a position, so they come back exactly.
        expect(decoded.color).toEqual(part.color);
        expect(decoded.mouldingColor).toEqual(part.mouldingColor);
    });

    it("a sunk moulding stays sunk, and parts after a wood part still decode in place", () => {
        const parts = [woodPart({mouldingIsConvex: false}), colorPart()];
        const decoded = decodeDefault(DEFAULT_PREFIX + DefaultCompositionCodec.encode({}, parts));

        expect(decoded).toHaveLength(2);
        expect(decoded[0].mouldingIsConvex).toBe(false);
        expect(decoded[1].materialId).toBe(INSTANCED_COLOR_MATERIAL_ID);
        expect(decoded[1].offset.x).toBe(0.5);
        expect(decoded[1].color).toEqual(parts[1].color);
    });

    // Parts are fixed-width and unseparated, so the decoder works out where each one ends from its
    // material. A part the string stops part-way through cannot be read at all.
    it("a truncated composition yields whole parts and drops the one it cuts", () => {
        const body = DefaultCompositionCodec.encode({}, [woodPart(), colorPart()]);
        const woodChars = 11;
        const colorChars = 9;
        expect(body).toHaveLength(woodChars + colorChars);

        for (let length = 0; length <= body.length; ++length)
        {
            const decoded = decodeDefault(DEFAULT_PREFIX + body.substring(0, length));
            const expectedParts = (length >= woodChars + colorChars) ? 2 : (length >= woodChars) ? 1 : 0;
            expect(decoded, `length ${length}`).toHaveLength(expectedParts);
            if (expectedParts > 0)
                expectMoulded(decoded[0]);
        }
    });

    it("a damaged composition never throws and every part it yields is drawable", () => {
        fc.assert(fc.property(fc.string({unit: "binary-ascii"}), (garbage) => {
            for (const part of decodeDefault(DEFAULT_PREFIX + garbage))
            {
                expect(GEOMETRY_CODE_BY_ID[part.geometryId]).toBeDefined();
                expect(MATERIAL_CODE_BY_ID[part.materialId]).toBeDefined();
                for (const vec of [part.offset, part.dir, part.scale])
                    for (const axis of ["x", "y", "z"] as const)
                        expect(Number.isFinite(vec[axis])).toBe(true);
                if (part.materialId == INSTANCED_WOOD_MATERIAL_ID)
                    expectMoulded(part);
            }
        }), {numRuns: 300});
    });

    it("offsets and scales on the quantization grid come back exactly", () => {
        fc.assert(fc.property(
            fc.integer({min: -40, max: 40}), fc.integer({min: -40, max: 40}),
            fc.integer({min: 1, max: 40}), fc.integer({min: 1, max: 40}),
            (offsetSteps, offsetSteps2, scaleSteps, scaleSteps2) => {
                const part = colorPart({
                    offset: {x: offsetSteps * OFFSET_STEP, y: offsetSteps2 * OFFSET_STEP, z: 0},
                    scale: {x: scaleSteps * SCALE_STEP, y: scaleSteps2 * SCALE_STEP, z: SCALE_STEP},
                });
                const [decoded] = decodeDefault(DEFAULT_PREFIX + DefaultCompositionCodec.encode({}, [part]));
                expect(decoded.offset.x).toBe(part.offset.x);
                expect(decoded.offset.y).toBe(part.offset.y);
                expect(decoded.scale).toEqual(part.scale);
            }), {numRuns: 300});
    });

    // A flat square laid over another is lifted clear of it, so the two don't z-fight.
    it("overlapping coplanar squares are given rising relief, and disjoint ones are not", () => {
        const stacked = decodeDefault(DEFAULT_PREFIX + DefaultCompositionCodec.encode({}, [
            colorPart({offset: {x: 0, y: 0, z: 0}, scale: {x: 1, y: 1, z: 1}}),
            colorPart({offset: {x: 0, y: 0, z: 0}, scale: {x: 0.5, y: 0.5, z: 1}}),
            colorPart({offset: {x: 0, y: 0, z: 0}, scale: {x: 0.25, y: 0.25, z: 1}}),
        ]));
        expect(stacked.map((part) => part.offset.z)).toEqual([RELIEF_STEP, 2 * RELIEF_STEP, 3 * RELIEF_STEP]);

        // Side by side and not touching, so neither sits on the other.
        const sideBySide = decodeDefault(DEFAULT_PREFIX + DefaultCompositionCodec.encode({}, [
            colorPart({offset: {x: -1, y: 0, z: 0}, scale: {x: 1, y: 1, z: 1}}),
            colorPart({offset: {x: 1, y: 0, z: 0}, scale: {x: 1, y: 1, z: 1}}),
        ]));
        expect(sideBySide.map((part) => part.offset.z)).toEqual([RELIEF_STEP, RELIEF_STEP]);

        // Relief is re-derived on every decode rather than stored, so it doesn't accumulate.
        const reEncoded = decodeDefault(DEFAULT_PREFIX + DefaultCompositionCodec.encode({}, stacked));
        expect(reEncoded.map((part) => part.offset.z)).toEqual(stacked.map((part) => part.offset.z));
    });

    // A material the codec tints but has no palette for would encode without a color, and the composer
    // dereferences that color when it uploads the instance.
    it("every material the composer tints has a palette to store its color in", () => {
        for (const materialId of INSTANCE_COLORED_MATERIAL_IDS)
        {
            const paletteName = COMPOSITION_PALETTE_NAME_BY_MATERIAL_ID[materialId];
            expect(paletteName, materialId).toBeDefined();
            expect(ColorUtil.getPaletteSize(paletteName), paletteName).toBeGreaterThan(0);
        }
    });

    it("relief goes towards the face the square shows", () => {
        const [facingBack] = decodeDefault(DEFAULT_PREFIX + DefaultCompositionCodec.encode({},
            [colorPart({dir: {x: 0, y: 0, z: -1}, offset: {x: 0, y: 0, z: 0}})]));
        expect(facingBack.offset.z).toBe(-RELIEF_STEP);
    });
});

describe("framed panel composition", () => {
    const paletteSize = ColorUtil.getPaletteSize("Timber");

    // Any finish the codec can store.
    const anyFinish = fc.record({
        frame: fc.integer({min: 0, max: paletteSize - 1}),
        inner: fc.integer({min: 0, max: paletteSize - 1}),
        thicknessStep: fc.integer({min: 0, max: MouldingCompositionConstants.numThicknessSteps - 1}),
        convex: fc.boolean(),
    }).map(({frame, inner, thicknessStep, convex}) => ({
        colors: {frame: ColorUtil.paletteIndexToRGB("Timber", frame), inner: ColorUtil.paletteIndexToRGB("Timber", inner)},
        mouldingThickness: MouldingCompositionConstants.fromThicknessStep(thicknessStep),
        mouldingIsConvex: convex,
        framed: true,
    }));

    // Any size a canvas can be resized to.
    const scaling = CanvasObjectTypeConfig.scaling;
    const numScales = Math.round((scaling.maxScale.x - scaling.minScale.x) / scaling.scaleStep.x) + 1;
    const anyScale = fc.integer({min: 0, max: numScales - 1})
        .map(step => scaling.minScale.x + step * scaling.scaleStep.x);

    // ─── Codec: round-trip ─────────────────────────────────────────────

    it("any finish survives the round trip, and re-encodes to the same string", () => {
        fc.assert(fc.property(anyFinish, (finish) => {
            const encoded = encodePanel(finish);
            const {params, parts} = decodePanel(encoded);

            expect(params).toEqual(finish);
            expect(encodePanel(params)).toBe(encoded);

            // The board carries exactly these inputs: the band is the frame, inside it the inner color.
            expect(parts[0].mouldingColor).toEqual(finish.colors.frame);
            expect(parts[0].color).toEqual(finish.colors.inner);
            expect(parts[0].mouldingThickness).toBe(params.mouldingThickness);
            expect(parts[0].mouldingIsConvex).toBe(finish.mouldingIsConvex);
        }), {numRuns: 200});
    });

    it("a panel without a frame composes no parts", () => {
        fc.assert(fc.property(anyFinish, (finish) => {
            const {params, parts} = decodePanel(encodePanel({...finish, framed: false}));
            expect(params.framed).toBe(false);
            expect(parts).toHaveLength(0);
        }), {numRuns: 100});
    });

    // ─── Codec: robustness against untrusted input ─────────────────────

    it("decoding an arbitrary string never throws and still yields a drawable panel", () => {
        fc.assert(fc.property(fc.string(), (garbage) => {
            const {params, parts} = decodePanel(FRAMED_PANEL_PREFIX + garbage);
            expectDrawablePanel(params, parts);
        }), {numRuns: 500});
    });

    it("a truncated look decodes to a drawable panel", () => {
        const encoded = PreEncodedCompositionStringMap[getLooks("Canvas")[1].compositionIndex];
        for (let length = 0; length <= encoded.length; ++length)
        {
            const {params, parts} = decodePanel(encoded.substring(0, length));
            expectDrawablePanel(params, parts);
        }
    });

    it("even the widest band leaves room inside it at the smallest size of every framed type", () => {
        for (const objectType of FRAMED_PANEL_TYPES)
        {
            const objectTypeIndex = ObjectTypeConfigMap.getIndexByType(objectType);
            const smallest = ObjectScaleUtil.getObjectSize(objectTypeIndex,
                ObjectTypeConfigMap.getConfigByIndex(objectTypeIndex).scaling!.minScale);
            const {params, parts} = decodePanel(encodePanel({colors: {frame: UNIT_VEC3, inner: UNIT_VEC3},
                mouldingThickness: MouldingCompositionConstants.maxMouldingThickness, mouldingIsConvex: true,
                framed: true}), smallest);
            expectDrawablePanel(params, parts);
            const inner = FramedPanelCompositionConstants.getInnerSize(params, smallest);
            expect(Math.min(inner.x, inner.y), objectType).toBeGreaterThan(0);
        }
    });

    // ─── Shape ─────────────────────────────────────────────────────────

    it("the board covers the canvas's footprint, just proud of the wall it hangs on", () => {
        const [board] = getLooks("Canvas", canvasBaseSize())[1].parts;
        expect(board.scale.x).toBe(CANVAS_CONFIG.collider.baseHitboxSize.sizeX);
        expect(board.scale.y).toBe(CANVAS_CONFIG.collider.baseHitboxSize.sizeY);
        expect(board.offset.x).toBe(0);
        expect(board.offset.y).toBe(0);
        expect(board.offset.z).toBeGreaterThan(0);
    });

    it("the board grows with the canvas, and the band it is framed by does not", () => {
        const scale = CanvasObjectTypeConfig.scaling.maxScale;
        const stretched = ObjectScaleUtil.getObjectSize(CANVAS_TYPE_INDEX, scale);

        const base = getLooks("Canvas", canvasBaseSize())[1].parts[0];
        const big = getLooks("Canvas", stretched)[1].parts[0];

        expect(big.scale.x).toBe(CANVAS_CONFIG.collider.baseHitboxSize.sizeX * scale.x);
        expect(big.scale.y).toBe(CANVAS_CONFIG.collider.baseHitboxSize.sizeY * scale.y);
        // The wood material measures its band in world units, so the frame reads the same at any size.
        expect(big.mouldingThickness).toBe(base.mouldingThickness);
    });

    it("the picture fills the inside of the band, or the whole footprint without a frame", () => {
        fc.assert(fc.property(anyFinish, fc.boolean(), anyScale, anyScale, (finish, framed, scaleX, scaleY) => {
            const size = ObjectScaleUtil.getObjectSize(CANVAS_TYPE_INDEX, {x: scaleX, y: scaleY, z: 1});
            const {params, parts} = decodePanel(encodePanel({...finish, framed}), size);
            const picture = FramedPanelCompositionConstants.getInnerSize(params, size);
            const band = framed ? finish.mouldingThickness : 0;
            for (const axis of ["x", "y"] as const)
            {
                expect(picture[axis]).toBeCloseTo(size[axis] - 2 * band, 9);
                if (framed)
                    expect(parts[0].scale[axis]).toBeCloseTo(size[axis], 9);
            }
        }), {numRuns: 200});
    });
});

describe("a canvas's looks", () => {
    const looks = getLooks("Canvas");

    it("the first is the picture alone, and every other a frame in a finish of its own", () => {
        expect(looks[0].params.framed).toBe(false);
        expect(looks[0].parts).toHaveLength(0);

        const framed = looks.slice(1);
        expect(framed.length).toBeGreaterThan(1);
        for (const look of framed)
        {
            expect(look.params.framed).toBe(true);
            expectDrawablePanel(look.params, look.parts);
        }
        expect(new Set(framed.map(look => JSON.stringify(finishOf(look.params)))).size).toBe(framed.length);
    });

    it("every look is written by the framed panel codec", () => {
        for (const look of looks)
            expect(PreEncodedCompositionStringMap[look.compositionIndex].startsWith(FRAMED_PANEL_PREFIX)).toBe(true);
    });

    // ─── The appearance a canvas falls back on ─────────────────────────

    it("a canvas's default frame depends on where it hangs, is a framed look, and varies across canvases", () => {
        const a = CANVAS_COMPOSER.generateDefaultParts(canvas("same"));
        const b = CANVAS_COMPOSER.generateDefaultParts(canvas("same"));
        expect(b.params.compositionIndex).toBe(a.params.compositionIndex);

        const framedIndices = looks.slice(1).map(look => look.compositionIndex);
        const chosen = new Set<number>();
        for (let i = 0; i < 40; ++i)
        {
            const {params, parts} = CANVAS_COMPOSER.generateDefaultParts(canvas(`canvas-${i}`));
            expect(framedIndices).toContain(params.compositionIndex);
            expectDrawablePanel(params, parts);
            chosen.add(params.compositionIndex);
        }
        expect(chosen.size).toBeGreaterThan(1);
    });

    // ─── Permissions ───────────────────────────────────────────────────

    it("a user may change a canvas's picture and frame, and nothing else", () => {
        const setMetadata = (metadataKey: number, metadataValue: string) =>
            CanvasObjectTypeConfig.canUserSetObjectMetadata({id: "user-1"} as any, {objectById: {}} as any,
                canvas("c") as any, {metadataKey, metadataValue} as any);
        const imagePath = ImageMapUtil.getImageMap("CanvasImageMap").getRandomImagePath();

        expect(setMetadata(ObjectMetadataKeyEnumMap.ImagePath, imagePath)).toBe(true);
        expect(setMetadata(ObjectMetadataKeyEnumMap.ImagePath, "no/such/image")).toBe(false);
        expect(setMetadata(FRAME_COORDS_KEY, "0,0")).toBe(false);
        expect(setMetadata(ObjectMetadataKeyEnumMap.Label, "hello")).toBe(false);

        // A frame only as one of its own looks: another type's builds parts a canvas can't place, and a
        // spelled-out finish skips the list.
        for (const look of looks)
            expect(setMetadata(COMPOSITION_KEY, look.stored)).toBe(true);
        expect(setMetadata(COMPOSITION_KEY, getLooks("Label")[1].stored)).toBe(false);
        expect(setMetadata(COMPOSITION_KEY, PreEncodedCompositionStringMap[looks[1].compositionIndex])).toBe(false);
        expect(setMetadata(COMPOSITION_KEY, "abc")).toBe(false);
    });

    // ─── Config coherence ──────────────────────────────────────────────

    it("a canvas stores an index to one of its looks", () => {
        expect(CANVAS_COMPOSER.codecType).toBe(InstancedMeshCompositionCodecTypeEnumMap.Indexed);
    });
});

// Objects encoded now, with the format's version byte stamped back to the given version.
function decodeAsVersion(objects: AddObjectSignal[], version: number): ObjectGroup
{
    const view = new Uint8Array(64 * 1024);
    const writeState = new BufferState(view);
    // Versions from before the scale are written in their own layout, not stamped onto a current one.
    if (version > LAST_UNSCALED_OBJECT_GROUP_VERSION)
    {
        new ObjectGroup(objects).encodeWithParams(writeState, {});
        view[0] = version;
    }
    else
        writeLegacyObjectGroup(writeState, objects, version);
    return ObjectGroup.decodeWithParams(new BufferState(view.subarray(0, writeState.byteIndex)), ROOM_ID) as ObjectGroup;
}

describe("bitmap frame migration", () => {
    function migratedFrameOf(col: number, row: number): string
    {
        const group = decodeAsVersion([canvas("framed", {[FRAME_COORDS_KEY]: `${col},${row}`})], 2);
        return group.objectById["framed"].metadata[COMPOSITION_KEY]!.str;
    }

    function lookOf(stored: string)
    {
        return getLooks("Canvas").find(look => look.stored == stored);
    }

    it("a framed canvas gets a wood frame in place of its bitmap one, and keeps its picture", () => {
        const group = decodeAsVersion([canvas("framed", {
            [FRAME_COORDS_KEY]: "2,1",
            [ObjectMetadataKeyEnumMap.ImagePath]: "1/1",
        })], 2);
        const migrated = group.objectById["framed"];

        expect(migrated.metadata[FRAME_COORDS_KEY]).toBeUndefined();
        expect(migrated.metadata[ObjectMetadataKeyEnumMap.ImagePath]?.str).toBe("1/1");
        expect(lookOf(migrated.metadata[COMPOSITION_KEY]!.str)?.params.framed).toBe(true);
        expect(group.sourceFormatVersion).toBe(2);
    });

    it("every old atlas cell becomes one of the canvas's frames", () => {
        for (let row = 0; row < 4; ++row)
        {
            for (let col = 0; col < 4; ++col)
                expect(lookOf(migratedFrameOf(col, row))?.params.framed, `cell ${col},${row}`).toBe(true);
        }
    });

    it("cells keep their place in the atlas: the white marble stays pale, the carved dark wood dark", () => {
        // Guards the cell order (column first, row by row), which nothing else would notice going wrong.
        const whiteMarble = lookOf(migratedFrameOf(0, 0))!.params;
        const darkWood = lookOf(migratedFrameOf(3, 3))!.params;
        expect(luma(whiteMarble.colors.frame)).toBeGreaterThan(luma(darkWood.colors.frame) + 60);
    });

    it("an unreadable frame is dropped, leaving the canvas its default frame", () => {
        const invalid = ["", "4,0", "0,4", "a,b", "1", "-1,0", "1,1,1"];
        const group = decodeAsVersion(invalid.map((coords, i) => canvas(`bad-${i}`, {[FRAME_COORDS_KEY]: coords})), 2);
        for (let i = 0; i < invalid.length; ++i)
        {
            const object = group.objectById[`bad-${i}`];
            expect(object.metadata[FRAME_COORDS_KEY]).toBeUndefined();
            expect(object.metadata[COMPOSITION_KEY]).toBeUndefined();
        }
    });

    it("only canvases are reframed", () => {
        const door = new AddObjectSignal(ROOM_ID, "user-1", "User One", DOOR_TYPE_INDEX, "door",
            new ObjectTransform({x: 16, y: 1.75, z: 31}, {x: 0, y: 0, z: -1}, {...UNIT_VEC3}),
            {[FRAME_COORDS_KEY]: new EncodableByteString("0,0")});
        const migrated = decodeAsVersion([door], 2).objectById["door"];
        expect(migrated.metadata[FRAME_COORDS_KEY]).toBeUndefined();
        expect(migrated.metadata[COMPOSITION_KEY]).toBeUndefined();
    });

    it("a current group is decoded untouched and reports its format as current", () => {
        const stored = getLooks("Canvas")[3].stored;
        const group = decodeAsVersion([canvas("current", {[COMPOSITION_KEY]: stored})], ObjectGroup.latestFormatVersion);
        expect(group.sourceFormatVersion).toBe(ObjectGroup.latestFormatVersion);
        expect(group.objectById["current"].metadata[COMPOSITION_KEY]?.str).toBe(stored);
    });
});

/**
 * Before their looks were a list, canvases, labels and doors each stored a finish of their own in a codec of
 * their own (canvas 4, label 6, door 2, all at version 0). Each becomes the look nearest it.
 */
describe("finish migration", () => {
    const LAST_OWN_FINISH_VERSION = 5;
    const LEGACY_CODEC_TYPE_BY_OBJECT_TYPE: {[objectType: string]: number} = {Door: 2, Canvas: 4, Label: 6};
    const MIN_BAND = 0.04;
    const BAND_STEP = 0.02;
    const NUM_BAND_STEPS = 7;
    const CONVEX_FLAG = 1;
    const FRAMED_FLAG = 2;

    const char = (raw: number) => StringUtil.convertRawNumberToVisibleASCII(raw);
    const paletteIndex = (color: Vec3) => ColorUtil.rgbToPaletteIndex("Timber", color);

    // Frame and inner colors, the band step, and the flags, then (for later panels) the margin step.
    function legacyPanel(objectType: string, finish: InstancedMeshCompositionParams, marginStep?: number): string
    {
        return char(LEGACY_CODEC_TYPE_BY_OBJECT_TYPE[objectType]) + char(0)
            + char(paletteIndex(finish.colors.frame)) + char(paletteIndex(finish.colors.inner))
            + char(Math.round((finish.mouldingThickness - MIN_BAND) / BAND_STEP))
            + char((finish.mouldingIsConvex ? CONVEX_FLAG : 0) | (finish.framed ? FRAMED_FLAG : 0))
            + (marginStep == undefined ? "" : char(marginStep));
    }

    // Timber, plate and knob.
    function legacyDoor(colors: InstancedMeshCompositionParams["colors"]): string
    {
        return char(LEGACY_CODEC_TYPE_BY_OBJECT_TYPE.Door) + char(0)
            + char(paletteIndex(colors.panel)) + char(paletteIndex(colors.label)) + char(paletteIndex(colors.knob));
    }

    function migrated(objectType: string, stored: string | undefined): string | undefined
    {
        const object = objectOfType(ObjectTypeConfigMap.getIndexByType(objectType), "object",
            stored == undefined ? {} : {[COMPOSITION_KEY]: stored});
        return decodeAsVersion([object], LAST_OWN_FINISH_VERSION).objectById["object"].metadata[COMPOSITION_KEY]?.str;
    }

    const anyPanelFinish = fc.record({
        frame: fc.integer({min: 0, max: ColorUtil.getPaletteSize("Timber") - 1}),
        inner: fc.integer({min: 0, max: ColorUtil.getPaletteSize("Timber") - 1}),
        thicknessStep: fc.integer({min: 0, max: NUM_BAND_STEPS - 1}),
        convex: fc.boolean(),
    }).map(({frame, inner, thicknessStep, convex}) => ({
        colors: {frame: ColorUtil.paletteIndexToRGB("Timber", frame), inner: ColorUtil.paletteIndexToRGB("Timber", inner)},
        mouldingThickness: MIN_BAND + thicknessStep * BAND_STEP,
        mouldingIsConvex: convex,
    }));

    it("a finish that is one of the looks on offer becomes that very look", () => {
        for (const objectType of FRAMED_PANEL_TYPES)
        {
            for (const look of getLooks(objectType).filter(look => look.params.framed))
                expect(migrated(objectType, legacyPanel(objectType, look.params)), objectType).toBe(look.stored);
        }
        for (const look of getLooks("Door"))
            expect(migrated("Door", legacyDoor(look.params.colors))).toBe(look.stored);
    });

    it("an unframed canvas or label shows its frameless look, whatever finish it kept", () => {
        for (const objectType of FRAMED_PANEL_TYPES)
        {
            const frameless = getLooks(objectType)[0].stored;
            fc.assert(fc.property(anyPanelFinish, (finish) => {
                expect(migrated(objectType, legacyPanel(objectType, {...finish, framed: false}))).toBe(frameless);
            }), {numRuns: 30});
            // Nothing past the prefix was frameless too.
            expect(migrated(objectType, char(LEGACY_CODEC_TYPE_BY_OBJECT_TYPE[objectType]) + char(0))).toBe(frameless);
        }
    });

    it("a finish of a canvas's or a label's own becomes one of its framed looks, whatever its margin", () => {
        for (const objectType of FRAMED_PANEL_TYPES)
        {
            const framedLooks = getLooks(objectType).slice(1).map(look => look.stored);
            fc.assert(fc.property(anyPanelFinish, fc.integer({min: 0, max: 4}), (finish, marginStep) => {
                const withoutMargin = migrated(objectType, legacyPanel(objectType, {...finish, framed: true}));
                expect(framedLooks).toContain(withoutMargin);
                expect(migrated(objectType, legacyPanel(objectType, {...finish, framed: true}, marginStep)))
                    .toBe(withoutMargin);
            }), {numRuns: 30});
        }
    });

    it("a finish a band step off a look on offer becomes that look", () => {
        const maxBand = MIN_BAND + (NUM_BAND_STEPS - 1) * BAND_STEP;
        for (const objectType of FRAMED_PANEL_TYPES)
        {
            for (const look of getLooks(objectType).filter(look => look.params.framed))
            {
                const thickness = look.params.mouldingThickness;
                const nudged = (thickness + BAND_STEP <= maxBand + 1e-9) ? thickness + BAND_STEP : thickness - BAND_STEP;
                expect(migrated(objectType, legacyPanel(objectType, {...look.params, mouldingThickness: nudged})),
                    `${objectType} ${look.compositionIndex}`).toBe(look.stored);
            }
        }
    });

    it("a finish in any other codec is dropped, and an object that stored none is left without", () => {
        for (const objectType of ["Canvas", "Label", "Door"])
        {
            expect(migrated(objectType, "&!Sa%\""), objectType).toBeUndefined();
            expect(migrated(objectType, undefined), objectType).toBeUndefined();
        }
        // A door's finish on a canvas is another codec's too.
        expect(migrated("Canvas", legacyDoor(getLooks("Door")[0].params.colors))).toBeUndefined();
    });
});

describe("pre-encoded compositions by object type", () => {
    it("every object type in the table exists and renders through the indexed codec", () => {
        for (const objectType of Object.keys(PreEncodedCompositionIndexMap))
        {
            expect(ObjectTypeConfigMap.hasType(objectType)).toBe(true);
            const config = ObjectTypeConfigMap.getConfigByIndex(ObjectTypeConfigMap.getIndexByType(objectType));
            expect(config.components.spawnedByAny?.instancedMeshComposer?.codecType)
                .toBe(InstancedMeshCompositionCodecTypeEnumMap.Indexed);
        }
    });

    it("the types' entries partition the whole table", () => {
        const all = Object.values(PreEncodedCompositionIndexMap).flat().sort((a, b) => a - b);
        expect(all).toEqual(PreEncodedCompositionStringMap.map((_, index) => index));
    });

    it("every type that renders through the indexed codec has its appearance in the table", () => {
        for (const config of ObjectTypeConfigMap.getAllConfigs())
        {
            if (config.components.spawnedByAny?.instancedMeshComposer?.codecType
                === InstancedMeshCompositionCodecTypeEnumMap.Indexed)
            {
                expect(PreEncodedCompositionIndexMap[config.objectType]?.length, config.objectType)
                    .toBeGreaterThan(0);
            }
        }
    });
});

describe("composition thumbnail atlas layout", () => {
    it("positions fill rows left to right, and the atlas holds every position", () => {
        fc.assert(fc.property(fc.integer({min: 1, max: 300}), (count) => {
            const numCols = CompositionThumbnailUtil.getNumCols(count);
            const numRows = CompositionThumbnailUtil.getNumRows(count);
            const cells = new Set<string>();
            for (let position = 0; position < count; ++position)
            {
                const {col, row} = CompositionThumbnailUtil.getCell(position);
                expect(col).toBeLessThan(numCols);
                expect(row).toBeLessThan(numRows);
                cells.add(`${col},${row}`);
            }
            expect(cells.size).toBe(count);
            expect(numCols * numRows).toBeLessThan(count + numCols);
        }), {numRuns: 100});
    });

    it("each type gets its own atlas", () => {
        expect(CompositionThumbnailUtil.getAtlasPath("Lamp"))
            .not.toBe(CompositionThumbnailUtil.getAtlasPath("Door"));
    });
});
