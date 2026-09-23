/**
 * Canvas frames. A canvas composes one moulded wood board, a margin inside its footprint, from its own wood
 * inputs (frame and inner colors, band width, profile), which a user edits as a door's colors are edited;
 * the picture hangs inside the band, or where the board would be when its frame is off. The stored string
 * is untrusted, and rooms saved with bitmap frames (CanvasFrameCoords) are converted on load.
 * Covers: the Default codec's wood parts, the canvas codec, canvas defaults and permissions, the
 * ObjectGroup migration, the per-type pre-encoded table, and the thumbnail atlas layout.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import fc from "fast-check";

import { DefaultCompositionCodec } from "../../../src/shared/graphics/mesh/composition/types/compositionCodec/defaultCompositionCodec";
import { CanvasCompositionCodec } from "../../../src/shared/graphics/mesh/composition/types/compositionCodec/canvasCompositionCodec";
import CanvasCompositionConstants from "../../../src/shared/graphics/mesh/composition/types/compositionConstants/canvasCompositionConstants";
import MouldingCompositionConstants from "../../../src/shared/graphics/mesh/composition/types/compositionConstants/mouldingCompositionConstants";
import MarginCompositionConstants from "../../../src/shared/graphics/mesh/composition/types/compositionConstants/marginCompositionConstants";
import { InstancedMeshCompositionCodecTypeEnumMap } from "../../../src/shared/graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import PreEncodedCompositionStringMap from "../../../src/shared/graphics/mesh/composition/maps/preEncodedCompositionStringMap";
import PreEncodedCompositionIndexMap from "../../../src/shared/graphics/mesh/composition/maps/preEncodedCompositionIndexMap";
import CompositionThumbnailUtil from "../../../src/shared/graphics/mesh/composition/util/compositionThumbnailUtil";
import InstancedMeshCompositionPart from "../../../src/shared/graphics/mesh/composition/types/instancedMeshCompositionPart";
import { InstancedMeshCompositionParams } from "../../../src/shared/graphics/mesh/composition/types/compositionParams/instancedMeshCompositionParams";
import ColorUtil from "../../../src/shared/math/util/colorUtil";
import StringUtil from "../../../src/shared/math/util/stringUtil";
import Vec3 from "../../../src/shared/math/types/vec3";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import CanvasObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/canvasObjectTypeConfig";
import ObjectScaleUtil from "../../../src/shared/object/util/objectScaleUtil";
import { LAST_UNSCALED_OBJECT_GROUP_VERSION, writeLegacyObjectGroup } from "../helpers/legacyObjectGroup";
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
import { DOOR_CODEC_TYPE, PLAYER_CODEC_TYPE } from "../helpers/composition";

const COMPOSITION_KEY = ObjectMetadataKeyEnumMap.InstancedMeshComposition;
const FRAME_COORDS_KEY = ObjectMetadataKeyEnumMap.CanvasFrameCoords;
const ROOM_ID = "canvas-frame-room";
const CANVAS_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType("Canvas");
const DOOR_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType("Door");

const CANVAS_CONFIG = CanvasObjectTypeConfig.components.spawnedByAny;
const CANVAS_COMPOSER = CANVAS_CONFIG.instancedMeshComposer;

// A canvas nobody has resized, which is what every case here but the resize one is about.
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
const CANVAS_PREFIX = StringUtil.convertRawNumberToVisibleASCII(CANVAS_COMPOSER.codecType)
    + StringUtil.convertRawNumberToVisibleASCII(CANVAS_COMPOSER.codecVersion);

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

function decodeCanvas(encoded: string): {params: InstancedMeshCompositionParams, parts: InstancedMeshCompositionPart[]}
{
    const params: InstancedMeshCompositionParams = {};
    const parts: InstancedMeshCompositionPart[] = [];
    CanvasCompositionCodec.decode(encoded, canvasBaseSize(), params, parts);
    return {params, parts};
}

function encodeCanvas(params: InstancedMeshCompositionParams): string
{
    return CANVAS_PREFIX + CanvasCompositionCodec.encode(params, []);
}

// The wood inputs alone (ids aside), for comparing finishes.
function finishOf(params: InstancedMeshCompositionParams)
{
    return {colors: params.colors, mouldingThickness: params.mouldingThickness,
        mouldingIsConvex: params.mouldingIsConvex};
}

function canvas(objectId: string, metadata: {[key: number]: string} = {}): AddObjectSignal
{
    const encodableMetadata: {[key: number]: EncodableByteString} = {};
    for (const key of Object.keys(metadata))
        encodableMetadata[Number(key)] = new EncodableByteString(metadata[Number(key)]);
    return new AddObjectSignal(ROOM_ID, "user-1", "User One", CANVAS_TYPE_INDEX, objectId,
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

// A drawable canvas: one moulded board, with room inside its band for the picture, or
// no parts at all when its frame is off.
function expectDrawableCanvas(params: InstancedMeshCompositionParams, parts: InstancedMeshCompositionPart[]): void
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

describe("canvas mesh composition", () => {
    const paletteSize = ColorUtil.getPaletteSize("Timber");
    const numThicknessSteps = Math.round((MouldingCompositionConstants.maxMouldingThickness
        - MouldingCompositionConstants.minMouldingThickness) / MouldingCompositionConstants.mouldingThicknessStep) + 1;

    const numMarginSteps = Math.round(MarginCompositionConstants.maxMargin / MarginCompositionConstants.marginStep) + 1;
    const anyMargin = fc.integer({min: 0, max: numMarginSteps - 1})
        .map(step => MarginCompositionConstants.fromMarginStep(step));

    // Any finish the form can produce.
    const anyFinish = fc.record({
        frame: fc.integer({min: 0, max: paletteSize - 1}),
        inner: fc.integer({min: 0, max: paletteSize - 1}),
        thicknessStep: fc.integer({min: 0, max: numThicknessSteps - 1}),
        convex: fc.boolean(),
        margin: anyMargin,
    }).map(({frame, inner, thicknessStep, convex, margin}) => ({
        colors: {frame: ColorUtil.paletteIndexToRGB("Timber", frame), inner: ColorUtil.paletteIndexToRGB("Timber", inner)},
        mouldingThickness: MouldingCompositionConstants.minMouldingThickness
            + thicknessStep * MouldingCompositionConstants.mouldingThicknessStep,
        mouldingIsConvex: convex,
        framed: true,
        margin,
    }));

    // ─── Codec: round-trip & determinism ───────────────────────────────

    it("any finish the form can produce survives the round trip, and re-encodes to the same string", () => {
        fc.assert(fc.property(anyFinish, (finish) => {
            const encoded = encodeCanvas(finish);
            const {params, parts} = decodeCanvas(encoded);

            expect(params.colors).toEqual(finish.colors);
            expect(params.mouldingThickness).toBeCloseTo(finish.mouldingThickness, 9);
            expect(params.mouldingIsConvex).toBe(finish.mouldingIsConvex);
            expect(params.framed).toBe(true);
            expect(params.margin).toBe(finish.margin);
            expect(encodeCanvas(params)).toBe(encoded);

            // The board carries exactly these inputs: the band is the frame, inside it the inner color.
            expect(parts[0].mouldingColor).toEqual(finish.colors.frame);
            expect(parts[0].color).toEqual(finish.colors.inner);
            expect(parts[0].mouldingThickness).toBe(params.mouldingThickness);
            expect(parts[0].mouldingIsConvex).toBe(finish.mouldingIsConvex);
        }), {numRuns: 200});
    });

    it("a canvas with its frame off composes no parts, but keeps its finish for the frame to come back with", () => {
        fc.assert(fc.property(anyFinish, (finish) => {
            const encoded = encodeCanvas({...finish, framed: false});
            const {params, parts} = decodeCanvas(encoded);

            expect(params.framed).toBe(false);
            expect(parts).toHaveLength(0);
            expect(finishOf(params)).toEqual(finishOf(finish));
            expect(encodeCanvas(params)).toBe(encoded);
        }), {numRuns: 100});
    });

    it("a canvas storing nothing past the codec prefix is frameless, with a preset to turn the frame on with", () => {
        const {params, parts} = decodeCanvas(CANVAS_PREFIX);
        expect(params.framed).toBe(false);
        expect(params.margin).toBe(0);
        expect(parts).toHaveLength(0);
        expect(finishOf(params)).toEqual(CanvasCompositionConstants.presets[0]);
    });

    it("a canvas stored before it had a margin keeps its finish, and is drawn over its whole footprint", () => {
        fc.assert(fc.property(anyFinish, (finish) => {
            const encoded = encodeCanvas(finish);
            const {params, parts} = decodeCanvas(encoded.substring(0, encoded.length - 1));
            expect(finishOf(params)).toEqual(finishOf(finish));
            expect(params.framed).toBe(true);
            expect(params.margin).toBe(0);
            expect(parts[0].scale.x).toBe(canvasBaseSize().x);
            expect(parts[0].scale.y).toBe(canvasBaseSize().y);
        }), {numRuns: 50});
    });

    it("the same seed always yields the same canvas", () => {
        fc.assert(fc.property(fc.integer(), (seed) => {
            const a = CanvasCompositionCodec.getRandomComposition(seed, canvasBaseSize());
            const b = CanvasCompositionCodec.getRandomComposition(seed, canvasBaseSize());
            expect(encodeCanvas(b.params)).toBe(encodeCanvas(a.params));
        }), {numRuns: 50});
    });

    it("every preset survives the quantization the codec applies, and no two presets are alike", () => {
        // A preset off the palette or between width steps would decode to a different finish, so the
        // form would never recognize it again.
        const encodedPresets = new Set<string>();
        for (const preset of CanvasCompositionConstants.presets)
        {
            const encoded = encodeCanvas({...preset, framed: true});
            expect(finishOf(decodeCanvas(encoded).params)).toEqual(preset);
            encodedPresets.add(encoded);
        }
        expect(encodedPresets.size).toBe(CanvasCompositionConstants.presets.length);
    });

    // ─── Codec: robustness against untrusted input ─────────────────────

    it("decoding an arbitrary string never throws and still yields a drawable canvas", () => {
        fc.assert(fc.property(fc.string(), (garbage) => {
            const {params, parts} = decodeCanvas(CANVAS_PREFIX + garbage);
            expectDrawableCanvas(params, parts);
        }), {numRuns: 500});
    });

    it("a truncated composition decodes to a drawable canvas", () => {
        const encoded = encodeCanvas({...CanvasCompositionConstants.presets[0], framed: true});
        for (let length = 0; length <= encoded.length; ++length)
        {
            const {params, parts} = decodeCanvas(encoded.substring(0, length));
            expectDrawableCanvas(params, parts);
        }
    });

    it("even the widest band leaves room inside it for the picture", () => {
        const {params, parts} = decodeCanvas(encodeCanvas({...CanvasCompositionConstants.presets[0],
            mouldingThickness: MouldingCompositionConstants.maxMouldingThickness, framed: true}));
        expectDrawableCanvas(params, parts);
    });

    // ─── Shape ─────────────────────────────────────────────────────────

    it("the board covers the canvas's footprint, just proud of the wall it hangs on", () => {
        const {parts} = CanvasCompositionCodec.getRandomComposition(1, canvasBaseSize());
        const [board] = parts;
        expect(board.scale.x).toBe(CANVAS_CONFIG.collider.baseHitboxSize.sizeX);
        expect(board.scale.y).toBe(CANVAS_CONFIG.collider.baseHitboxSize.sizeY);
        expect(board.offset.x).toBe(0);
        expect(board.offset.y).toBe(0);
        expect(board.offset.z).toBeGreaterThan(0);
    });

    it("the board grows with the canvas, and the band it is framed by does not", () => {
        const scale = CanvasObjectTypeConfig.scaling.maxScale;
        const stretched = ObjectScaleUtil.getObjectSize(CANVAS_TYPE_INDEX, scale);

        const base = CanvasCompositionCodec.getRandomComposition(1, canvasBaseSize()).parts[0];
        const big = CanvasCompositionCodec.getRandomComposition(1, stretched).parts[0];

        expect(big.scale.x).toBe(CANVAS_CONFIG.collider.baseHitboxSize.sizeX * scale.x);
        expect(big.scale.y).toBe(CANVAS_CONFIG.collider.baseHitboxSize.sizeY * scale.y);
        // The wood material measures its band in world units, so the frame reads the same at any size.
        expect(big.mouldingThickness).toBe(base.mouldingThickness);
    });

    it("the board and the picture sit a margin inside the footprint, which gives way before the picture would vanish", () => {
        const scaling = CanvasObjectTypeConfig.scaling;
        const numScales = Math.round((scaling.maxScale.x - scaling.minScale.x) / scaling.scaleStep.x) + 1;
        const anyScale = fc.integer({min: 0, max: numScales - 1})
            .map(step => scaling.minScale.x + step * scaling.scaleStep.x);
        fc.assert(fc.property(anyFinish, fc.boolean(), anyScale, anyScale, (finish, framed, scaleX, scaleY) => {
            const size = ObjectScaleUtil.getObjectSize(CANVAS_TYPE_INDEX, {x: scaleX, y: scaleY, z: 1});
            const params = {...finish, framed};
            const parts: InstancedMeshCompositionPart[] = [];
            CanvasCompositionCodec.decode(encodeCanvas(params), size, {}, parts);
            const drawn = CanvasCompositionConstants.getDrawnSize(params, size);
            const picture = CanvasCompositionConstants.getPictureSize(params, size);
            if (framed)
            {
                expect(parts[0].scale.x).toBeCloseTo(drawn.x, 9);
                expect(parts[0].scale.y).toBeCloseTo(drawn.y, 9);
            }
            for (const axis of ["x", "y"] as const)
            {
                expect(drawn[axis]).toBeLessThanOrEqual(size[axis] + 1e-9);
                expect(picture[axis]).toBeGreaterThanOrEqual(MarginCompositionConstants.minInnerSize - 1e-9);
                // Short of the margin only where the picture would otherwise shrink past its minimum.
                if (drawn[axis] > size[axis] - 2 * finish.margin + 1e-9)
                    expect(picture[axis]).toBeCloseTo(MarginCompositionConstants.minInnerSize, 9);
            }
        }), {numRuns: 200});
    });

    // ─── The appearance a canvas falls back on ─────────────────────────

    it("a canvas's default frame depends on where it hangs, is a preset, and varies across canvases", () => {
        const a = CANVAS_COMPOSER.generateDefaultParts(canvas("same"));
        const b = CANVAS_COMPOSER.generateDefaultParts(canvas("same"));
        expect(encodeCanvas(b.params)).toBe(encodeCanvas(a.params));

        const finishes = new Set<string>();
        for (let i = 0; i < 40; ++i)
        {
            const {params, parts} = CANVAS_COMPOSER.generateDefaultParts(canvas(`canvas-${i}`));
            expectDrawableCanvas(params, parts);
            expect(CanvasCompositionConstants.presets).toContainEqual(finishOf(params));
            finishes.add(encodeCanvas(params));
        }
        expect(finishes.size).toBeGreaterThan(1);
    });

    // ─── Permissions ───────────────────────────────────────────────────

    it("a user may change a canvas's picture and frame, and nothing else", () => {
        const setMetadata = (metadataKey: number, metadataValue: string) =>
            CanvasObjectTypeConfig.canUserSetObjectMetadata({id: "user-1"} as any, {objectById: {}} as any,
                canvas("c") as any, {metadataKey, metadataValue} as any);
        const imagePath = ImageMapUtil.getImageMap("CanvasImageMap").getRandomImagePath();

        expect(setMetadata(ObjectMetadataKeyEnumMap.ImagePath, imagePath)).toBe(true);
        expect(setMetadata(ObjectMetadataKeyEnumMap.ImagePath, "no/such/image")).toBe(false);
        expect(setMetadata(COMPOSITION_KEY, encodeCanvas({...CanvasCompositionConstants.presets[3], framed: true}))).toBe(true);
        expect(setMetadata(FRAME_COORDS_KEY, "0,0")).toBe(false);
        expect(setMetadata(ObjectMetadataKeyEnumMap.Label, "hello")).toBe(false);
    });

    // ─── Config coherence ──────────────────────────────────────────────

    it("the canvas composes through a codec of its own", () => {
        expect(CANVAS_COMPOSER.codecType).toBe(InstancedMeshCompositionCodecTypeEnumMap.Canvas);
        // Sharing a codec with another type would let one decode the other's string.
        expect(CANVAS_COMPOSER.codecType).not.toBe(DOOR_CODEC_TYPE);
        expect(CANVAS_COMPOSER.codecType).not.toBe(PLAYER_CODEC_TYPE);
        expect(CANVAS_COMPOSER.codecType).not.toBe(InstancedMeshCompositionCodecTypeEnumMap.Indexed);
    });
});

describe("bitmap frame migration", () => {
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

    function migratedFrameOf(col: number, row: number): string
    {
        const group = decodeAsVersion([canvas("framed", {[FRAME_COORDS_KEY]: `${col},${row}`})], 2);
        return group.objectById["framed"].metadata[COMPOSITION_KEY]!.str;
    }

    it("a framed canvas gets a wood frame in place of its bitmap one, and keeps its picture", () => {
        const group = decodeAsVersion([canvas("framed", {
            [FRAME_COORDS_KEY]: "2,1",
            [ObjectMetadataKeyEnumMap.ImagePath]: "1/1",
        })], 2);
        const migrated = group.objectById["framed"];

        expect(migrated.metadata[FRAME_COORDS_KEY]).toBeUndefined();
        expect(migrated.metadata[ObjectMetadataKeyEnumMap.ImagePath]?.str).toBe("1/1");
        expect(migrated.metadata[COMPOSITION_KEY]!.str.startsWith(CANVAS_PREFIX)).toBe(true);
        expect(group.sourceFormatVersion).toBe(2);
    });

    it("every old atlas cell becomes a canonical, drawable frame of its own", () => {
        const frames = new Set<string>();
        for (let row = 0; row < 4; ++row)
        {
            for (let col = 0; col < 4; ++col)
            {
                const stored = migratedFrameOf(col, row);
                const {params, parts} = decodeCanvas(stored);
                expectDrawableCanvas(params, parts);
                expect(params.framed).toBe(true);
                expect(encodeCanvas(params)).toBe(stored);
                frames.add(stored);
            }
        }
        expect(frames.size).toBe(16);
    });

    it("cells keep their place in the atlas: the white marble stays pale, the carved dark wood dark", () => {
        // Guards the cell order (column first, row by row), which nothing else would notice going wrong.
        const whiteMarble = decodeCanvas(migratedFrameOf(0, 0)).params;
        const darkWood = decodeCanvas(migratedFrameOf(3, 3)).params;
        expect(luma(whiteMarble.colors.frame)).toBeGreaterThan(luma(darkWood.colors.frame) + 60);
        expect(luma(whiteMarble.colors.inner)).toBeGreaterThan(luma(darkWood.colors.inner) + 60);
    });

    it("cells keep their border widths in order: the gold slimmest, then the plain, the jade, the carved", () => {
        // The codec clamps band widths silently, so a range change the table isn't rescaled for would
        // flatten every frame to one width.
        const bandOf = (col: number, row: number) => decodeCanvas(migratedFrameOf(col, row)).params.mouldingThickness;
        const gold = bandOf(1, 1), plain = bandOf(0, 0), jade = bandOf(2, 0), carved = bandOf(3, 3);
        expect(gold).toBeLessThan(plain);
        expect(plain).toBeLessThan(jade);
        expect(jade).toBeLessThan(carved);
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
        const framed = encodeCanvas({...CanvasCompositionConstants.presets[0], framed: true});
        const group = decodeAsVersion([canvas("current", {[COMPOSITION_KEY]: framed})], ObjectGroup.latestFormatVersion);
        expect(group.sourceFormatVersion).toBe(ObjectGroup.latestFormatVersion);
        expect(group.objectById["current"].metadata[COMPOSITION_KEY]?.str).toBe(framed);
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
