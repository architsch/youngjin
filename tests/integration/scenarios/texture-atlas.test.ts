/**
 * Texture atlases and label lettering: TextureAtlasAllocator (regions of a texture handed out and taken back,
 * and the guarantee that a room's labels always fit once packed largest first), TextureAtlas (content shared
 * by key, sized for its largest holder up to the atlas's cap, drawn before it is shown, and shrunk rather than
 * left out when full),
 * TextureAtlasLayoutUtil (how content in a region is laid on a quad), what a cut-out picture draws at a point of
 * its quad (InstancedMeshBinding asking the atlas, which a stand-in answers for), LabelTextLayoutUtil (fitting
 * text to a label, or cutting it off at a fixed size, over its line breaks), and FontMetricsUtil reading the
 * bundled label font.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// The picture atlas is drawn on the GPU alone: this answers for reading it back (see
// TextureUtil.readAlphaOnRenderTarget), with whatever opacity a test paints.
const atlasOnGPU = vi.hoisted(() => ({
    alphaAt: (_texelX: number, _texelY: number): number => 255,
    readFails: false,
    readTexels: [] as {x: number, y: number}[],
}));

vi.mock("../../../src/client/graphics/graphicsManager", () => ({
    default: {
        getGameRenderer: () => ({
            readRenderTargetPixels(_renderTarget: unknown, x: number, y: number, width: number, height: number,
                buffer: Uint8Array)
            {
                for (let row = 0; row < height; ++row)
                {
                    for (let col = 0; col < width; ++col)
                    {
                        atlasOnGPU.readTexels.push({x: x + col, y: y + row});
                        if (!atlasOnGPU.readFails)
                            buffer[(row * width + col) * 4 + 3] = atlasOnGPU.alphaAt(x + col, y + row);
                    }
                }
            },
        }),
    },
}));

import * as THREE from "three";
import fc from "fast-check";
import fs from "fs";
import path from "path";
import InstancedMeshBinding from "../../../src/client/graphics/types/mesh/instancedMeshBinding";
import InstancedTexturePackMaterialParams from "../../../src/shared/graphics/material/types/instancedTexturePackMaterialParams";
import TextureAtlasAllocator from "../../../src/client/graphics/types/texture/textureAtlasAllocator";
import TextureAtlasRegion from "../../../src/client/graphics/types/texture/textureAtlasRegion";
import TextureAtlas from "../../../src/client/graphics/types/texture/textureAtlas";
import TextureAtlasHolder from "../../../src/client/graphics/types/texture/textureAtlasHolder";
import TextureAtlasLayoutUtil from "../../../src/client/graphics/util/textureAtlasLayoutUtil";
import TexelRect from "../../../src/client/graphics/types/texture/texelRect";
import CanvasObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/canvasObjectTypeConfig";
import PropObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/propObjectTypeConfig";
import FontMetricsUtil from "../../../src/client/graphics/util/fontMetricsUtil";
import LabelTextLayoutUtil from "../../../src/client/object/util/labelTextLayoutUtil";
import ObjectCategoryConfigMap from "../../../src/shared/object/maps/objectCategoryConfigMap";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import ObjectScaleUtil from "../../../src/shared/object/util/objectScaleUtil";
import DoorObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/doorObjectTypeConfig";
import LabelObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/labelObjectTypeConfig";
import { LABEL_ATLAS_CELL_SIZE, LABEL_ATLAS_CELL_WORLD_SIZE, LABEL_ATLAS_SIZE, PICTURE_ATLAS_CELL_SIZE,
    PICTURE_ATLAS_MAX_REGION_CELLS, PICTURE_ATLAS_SIZE } from "../../../src/shared/system/sharedConstants";

const NUM_CELLS_PER_SIDE = LABEL_ATLAS_SIZE / LABEL_ATLAS_CELL_SIZE;

// As LabelText sizes a region: whole cells, a hair under so an exact fit isn't rounded up.
const toCells = (worldSize: number) => Math.max(1, Math.ceil(worldSize / LABEL_ATLAS_CELL_WORLD_SIZE - 1e-6));

function overlaps(a: TextureAtlasRegion, b: TextureAtlasRegion): boolean
{
    return a.col < b.col + b.numCols && b.col < a.col + a.numCols
        && a.row < b.row + b.numRows && b.row < a.row + a.numRows;
}

function expectDisjointAndInside(regions: TextureAtlasRegion[],
    allocator: {numCols: number, numRows: number, getNumFreeCells(): number})
{
    for (let i = 0; i < regions.length; ++i)
    {
        const r = regions[i];
        expect(r.col).toBeGreaterThanOrEqual(0);
        expect(r.row).toBeGreaterThanOrEqual(0);
        expect(r.col + r.numCols).toBeLessThanOrEqual(allocator.numCols);
        expect(r.row + r.numRows).toBeLessThanOrEqual(allocator.numRows);
        for (let j = i + 1; j < regions.length; ++j)
            expect(overlaps(r, regions[j]), "two regions share a cell").toBe(false);
    }
    const takenCells = regions.reduce((sum, r) => sum + r.numCols * r.numRows, 0);
    expect(allocator.getNumFreeCells()).toBe(allocator.numCols * allocator.numRows - takenCells);
}

// Largest first into an empty atlas, as LabelText packs when an allocation fails.
function packLargestFirst(sizes: {numCols: number, numRows: number}[]): (TextureAtlasRegion | undefined)[]
{
    const allocator = new TextureAtlasAllocator(NUM_CELLS_PER_SIDE, NUM_CELLS_PER_SIDE);
    return [...sizes]
        .sort((a, b) => b.numCols * b.numRows - a.numCols * a.numRows)
        .map(size => allocator.allocate(size.numCols, size.numRows));
}

describe("label atlas allocation", () => {
    const anySize = fc.record({numCols: fc.integer({min: 1, max: 7}), numRows: fc.integer({min: 1, max: 7})});
    const anyOperation = fc.oneof(
        anySize.map(size => ({kind: "allocate" as const, ...size})),
        fc.nat().map(pick => ({kind: "free" as const, pick})));

    it("never hands out a cell twice, or one outside the atlas, however regions come and go", () => {
        fc.assert(fc.property(fc.array(anyOperation, {maxLength: 150}), (operations) => {
            const allocator = new TextureAtlasAllocator(NUM_CELLS_PER_SIDE, NUM_CELLS_PER_SIDE);
            const live: TextureAtlasRegion[] = [];
            for (const operation of operations)
            {
                if (operation.kind == "allocate")
                {
                    const region = allocator.allocate(operation.numCols, operation.numRows);
                    if (region != undefined)
                    {
                        expect(region.numCols).toBe(operation.numCols);
                        expect(region.numRows).toBe(operation.numRows);
                        live.push(region);
                    }
                }
                else if (live.length > 0)
                {
                    allocator.free(live.splice(operation.pick % live.length, 1)[0]);
                }
            }
            expectDisjointAndInside(live, allocator);
        }), {numRuns: 200});
    });

    it("hands out a freed region again once the atlas is full", () => {
        const allocator = new TextureAtlasAllocator(NUM_CELLS_PER_SIDE, NUM_CELLS_PER_SIDE);
        const cells: TextureAtlasRegion[] = [];
        for (let i = 0; i < NUM_CELLS_PER_SIDE * NUM_CELLS_PER_SIDE; ++i)
            cells.push(allocator.allocate(1, 1)!);
        expect(allocator.allocate(1, 1)).toBeUndefined();

        allocator.free(cells[137]);
        expect(allocator.allocate(1, 1)).toEqual(cells[137]);
    });

    it("refuses a region larger than the atlas, or one of no size", () => {
        const allocator = new TextureAtlasAllocator(NUM_CELLS_PER_SIDE, NUM_CELLS_PER_SIDE);
        expect(allocator.allocate(NUM_CELLS_PER_SIDE + 1, 1)).toBeUndefined();
        expect(allocator.allocate(0, 3)).toBeUndefined();
        expect(allocator.getNumFreeCells()).toBe(NUM_CELLS_PER_SIDE * NUM_CELLS_PER_SIDE);
    });

    it("packs equal squares edge to edge from the corner", () => {
        const allocator = new TextureAtlasAllocator(NUM_CELLS_PER_SIDE, NUM_CELLS_PER_SIDE);
        const first = allocator.allocate(4, 4)!;
        const second = allocator.allocate(4, 4)!;
        expect(first).toEqual({col: 0, row: 0, numCols: 4, numRows: 4});
        expect(second.row == 0 || second.col == 0).toBe(true);
        expect(second.col == 4 || second.row == 4).toBe(true);
    });

    it("always has room for a room's worth of labels and door plates, packed largest first", () => {
        // Every label at any size its scaling allows, and every door's plate, at the room caps.
        const labelScaling = LabelObjectTypeConfig.scaling;
        const labelTypeIndex = ObjectTypeConfigMap.getIndexByType("Label");
        const numScaleSteps = Math.round((labelScaling.maxScale.x - labelScaling.minScale.x) / labelScaling.scaleStep.x);
        const anyLabelScale = fc.integer({min: 0, max: numScaleSteps})
            .map(step => labelScaling.minScale.x + step * labelScaling.scaleStep.x);
        const anyLabel = fc.record({x: anyLabelScale, y: anyLabelScale}).map(scale => {
            const size = ObjectScaleUtil.getObjectSize(labelTypeIndex, {...scale, z: 1});
            return {numCols: toCells(size.x), numRows: toCells(size.y)};
        });
        const plate = DoorObjectTypeConfig.components.spawnedByAny.labelText.localTransform.scale;
        const doorPlate = {numCols: toCells(plate.x), numRows: toCells(plate.y)};
        const numDoors = ObjectCategoryConfigMap.getMaxCountPerRoom(DoorObjectTypeConfig.category);
        const numLabels = ObjectCategoryConfigMap.getMaxCountPerRoom(LabelObjectTypeConfig.category);

        fc.assert(fc.property(fc.array(anyLabel, {minLength: numLabels, maxLength: numLabels}), (labels) => {
            const regions = packLargestFirst([...labels, ...Array(numDoors).fill(doorPlate)]);
            expect(regions.every(region => region != undefined), "a label found no room").toBe(true);
        }), {numRuns: 300});

        // The largest labels all at once, the tightest case.
        const largest = {numCols: toCells(3.5), numRows: toCells(3.5)};
        expect(packLargestFirst([...Array(numLabels).fill(largest), ...Array(numDoors).fill(doorPlate)])
            .every(region => region != undefined)).toBe(true);
    });
});

// A holder that remembers the region it was last shown.
function createHolder(): TextureAtlasHolder & {region: TextureAtlasRegion | undefined}
{
    const holder = {
        region: undefined as TextureAtlasRegion | undefined,
        onAtlasRegionChanged: (region: TextureAtlasRegion | undefined) => { holder.region = region; },
    };
    return holder;
}

// Draws that land only when told to, as an image's does once it has loaded.
function createDeferredDraws()
{
    const pending: {region: TextureAtlasRegion, isCurrent: () => boolean, land: () => void}[] = [];
    const draw = (region: TextureAtlasRegion, isCurrent: () => boolean) =>
        new Promise<void>(resolve => pending.push({region, isCurrent, land: resolve}));
    return {draw, pending};
}

// Lets a landed draw's continuation run.
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

describe("texture atlas entries", () => {
    it("draws a key's content once, into one region every holder of it is shown", () => {
        const atlas = new TextureAtlas("test", 8, 8);
        let numDraws = 0;
        const draw = () => { ++numDraws; };
        const a = createHolder();
        const b = createHolder();
        atlas.acquire("image", a, 2, 2, draw);
        atlas.acquire("image", b, 2, 2, draw);

        expect(numDraws).toBe(1);
        expect(a.region).toBeDefined();
        expect(b.region).toBe(a.region);
        expect(atlas.getNumFreeCells()).toBe(64 - 4);
    });

    it("is as large as the largest of its holders asks, and is freed with the last of them", () => {
        const atlas = new TextureAtlas("test", 8, 8);
        const a = createHolder();
        const b = createHolder();
        atlas.acquire("image", a, 2, 2, () => {});
        atlas.acquire("image", b, 3, 1, () => {});
        expect(a.region).toMatchObject({numCols: 3, numRows: 2});
        expect(b.region).toBe(a.region);

        atlas.release("image", b);
        expect(a.region).toMatchObject({numCols: 2, numRows: 2});
        expect(atlas.getNumFreeCells()).toBe(64 - 4);

        atlas.release("image", a);
        expect(atlas.getRegion("image")).toBeUndefined();
        expect(atlas.getNumFreeCells()).toBe(64);
    });

    it("shows a new region only once it is drawn, and drops a draw that lands after a later one started", async () => {
        const atlas = new TextureAtlas("test", 8, 8);
        const {draw, pending} = createDeferredDraws();
        const holder = createHolder();
        atlas.acquire("image", holder, 2, 2, draw);
        expect(holder.region).toBeUndefined();
        pending[0].land();
        await settle();
        const first = holder.region!;
        expect(first).toMatchObject({numCols: 2, numRows: 2});

        // Grown twice before the first growth has drawn.
        atlas.acquire("image", holder, 3, 3, draw);
        atlas.acquire("image", holder, 4, 4, draw);
        expect(holder.region).toBe(first);
        expect(pending[1].isCurrent()).toBe(false);
        expect(pending[2].isCurrent()).toBe(true);

        pending[1].land();
        await settle();
        expect(holder.region).toBe(first);
        pending[2].land();
        await settle();
        expect(holder.region).toMatchObject({numCols: 4, numRows: 4});
        expect(atlas.getNumFreeCells()).toBe(64 - 16);
    });

    it("never draws for a key once its last holder lets go", async () => {
        const atlas = new TextureAtlas("test", 8, 8);
        const {draw, pending} = createDeferredDraws();
        const holder = createHolder();
        atlas.acquire("image", holder, 2, 2, draw);
        atlas.release("image", holder);
        expect(pending[0].isCurrent()).toBe(false);
        pending[0].land();
        await settle();
        expect(holder.region).toBeUndefined();
        expect(atlas.getNumFreeCells()).toBe(64);
    });

    it("caps a region at the atlas's largest, keeping its shape, and leaves an uncapped atlas's alone", () => {
        const capped = new TextureAtlas("test", 8, 8, {maxRegionSide: 2});
        const uncapped = new TextureAtlas("test", 8, 8);
        const cases: [number, number, number, number][] = [[1, 1, 1, 1], [2, 1, 2, 1], [2, 2, 2, 2], [7, 7, 2, 2],
            [7, 2, 2, 1], [1, 5, 1, 2], [4, 3, 2, 2]];
        cases.forEach(([numCols, numRows, cappedCols, cappedRows], i) => {
            const a = createHolder();
            const b = createHolder();
            capped.acquire(`${i}`, a, numCols, numRows, () => {});
            uncapped.acquire(`${i}`, b, numCols, numRows, () => {});
            expect(a.region, `${numCols}x${numRows}`).toMatchObject({numCols: cappedCols, numRows: cappedRows});
            expect(b.region, `${numCols}x${numRows}`).toMatchObject({numCols, numRows});
            capped.release(`${i}`, a);
            uncapped.release(`${i}`, b);
        });
    });

    it("shows every picture a room can hold, however they come and go, shrinking what doesn't fit", () => {
        // The picture atlas as PictureGameObject makes it, and a canvas or prop at every size either type's scaling
        // allows (in cells), up to the cap the two share.
        const numCellsPerSide = PICTURE_ATLAS_SIZE / PICTURE_ATLAS_CELL_SIZE;
        const createCanvasAtlas = () => new TextureAtlas("test", numCellsPerSide, numCellsPerSide,
            {shrinkWhenFull: true, maxRegionSide: PICTURE_ATLAS_MAX_REGION_CELLS});
        expect(PropObjectTypeConfig.category).toBe(CanvasObjectTypeConfig.category);
        const maxCanvases = ObjectCategoryConfigMap.getMaxCountPerRoom(CanvasObjectTypeConfig.category);
        const maxCells = Math.max(...[CanvasObjectTypeConfig, PropObjectTypeConfig].map(config =>
            config.scaling.maxScale.x / config.scaling.scaleStep.x));
        const anyCells = fc.integer({min: 1, max: maxCells});
        // Mostly acquiring, so the atlas fills up.
        const anyOperation = fc.oneof(
            {weight: 4, arbitrary: fc.record({kind: fc.constant("acquire" as const), key: fc.nat(maxCanvases - 1),
                numCols: anyCells, numRows: anyCells})},
            {weight: 1, arbitrary: fc.record({kind: fc.constant("release" as const), key: fc.nat(maxCanvases - 1)})});

        fc.assert(fc.property(fc.array(anyOperation, {maxLength: 400}), (operations) => {
            const atlas = createCanvasAtlas();
            const holders = new Map<string, ReturnType<typeof createHolder>>();
            for (const operation of operations)
            {
                const key = `${operation.key}`;
                if (operation.kind == "acquire")
                {
                    const holder = holders.get(key) ?? createHolder();
                    holders.set(key, holder);
                    atlas.acquire(key, holder, operation.numCols, operation.numRows, () => {});
                }
                else if (holders.has(key))
                {
                    atlas.release(key, holders.get(key)!);
                    holders.delete(key);
                }
            }
            const regions = [...holders.entries()].map(([key, holder]) => {
                expect(holder.region, "an image was left out").toBeDefined();
                expect(holder.region).toBe(atlas.getRegion(key));
                expect(Math.max(holder.region!.numCols, holder.region!.numRows)).toBeLessThanOrEqual(
                    PICTURE_ATLAS_MAX_REGION_CELLS);
                return holder.region!;
            });
            expectDisjointAndInside(regions,
                {numCols: numCellsPerSide, numRows: numCellsPerSide, getNumFreeCells: () => atlas.getNumFreeCells()});
        }), {numRuns: 200});

        // Every picture at its largest, each showing an image of its own: the tightest case.
        const atlas = createCanvasAtlas();
        const holders = Array.from({length: maxCanvases}, () => createHolder());
        holders.forEach((holder, i) => atlas.acquire(`${i}`, holder, maxCells, maxCells, () => {}));
        expect(holders.every(holder => holder.region != undefined)).toBe(true);
    });
});

describe("texture atlas layout", () => {
    const anyAreaSide = fc.integer({min: 1, max: 14}).map(n => n * 0.25);
    const anyArea = fc.record({x: anyAreaSide, y: anyAreaSide});
    const anyTexels: fc.Arbitrary<TexelRect> = fc.record({x: fc.nat(2000), y: fc.nat(2000),
        width: fc.integer({min: 1, max: 512}), height: fc.integer({min: 1, max: 512})});
    const anyQuarterTurns = fc.integer({min: 0, max: 3});
    const EPSILON = 1e-9;

    it("counts whole cells, without rounding an exact fit up", () => {
        expect(TextureAtlasLayoutUtil.getNumCells(1, 0.5)).toBe(2);
        expect(TextureAtlasLayoutUtil.getNumCells(1.01, 0.5)).toBe(3);
        expect(TextureAtlasLayoutUtil.getNumCells(0.1, 0.5)).toBe(1);
    });

    it("stretches filling content (a label's text) over its whole area", () => {
        fc.assert(fc.property(anyArea, anyTexels, (area, texels) => {
            const layout = TextureAtlasLayoutUtil.getLayout(area, texels, "fill", 0);
            expect(layout.quadSize).toEqual(area);
            expect(layout.texelRect).toEqual(texels);
        }));
    });

    it("fits content into its area whole, keeping its shape as turned", () => {
        fc.assert(fc.property(anyArea, anyTexels, anyQuarterTurns, (area, texels, quarterTurns) => {
            const {quadSize, texelRect} = TextureAtlasLayoutUtil.getLayout(area, texels, "fit", quarterTurns);
            expect(texelRect).toEqual(texels);
            expect(quadSize.x).toBeLessThanOrEqual(area.x + EPSILON);
            expect(quadSize.y).toBeLessThanOrEqual(area.y + EPSILON);
            expect(Math.abs(quadSize.x - area.x) < EPSILON || Math.abs(quadSize.y - area.y) < EPSILON).toBe(true);

            const turnedAspect = (quarterTurns % 2 == 0) ? texels.width / texels.height : texels.height / texels.width;
            const areaAspect = area.x / area.y;
            // Content made for the area's shape fills it; any other keeps its own.
            if (Math.abs(turnedAspect - areaAspect) > areaAspect * 0.02)
                expect(quadSize.x / quadSize.y).toBeCloseTo(turnedAspect, 6);
        }));
    });

    it("keeps preserved content at its own size, cutting off from the middle whatever overflows", () => {
        const anyContentSide = fc.integer({min: 1, max: 7}).map(n => n * 0.5);
        const anyContentSize = fc.record({x: anyContentSide, y: anyContentSide});
        fc.assert(fc.property(anyArea, anyTexels, anyContentSize, anyQuarterTurns,
            (area, texels, contentSize, quarterTurns) => {
                const turned = quarterTurns % 2 != 0;
                const {quadSize, texelRect} = TextureAtlasLayoutUtil.getLayout(area, texels, "preserve",
                    quarterTurns, contentSize);
                // Along the quad's axes, the content's sides as the turn lays them.
                expect(quadSize.x).toBeCloseTo(Math.min(area.x, turned ? contentSize.y : contentSize.x), 9);
                expect(quadSize.y).toBeCloseTo(Math.min(area.y, turned ? contentSize.x : contentSize.y), 9);

                // The same share of the content's texels as of its size, taken from the middle.
                expect(texelRect.width / texels.width).toBeCloseTo((turned ? quadSize.y : quadSize.x) / contentSize.x, 9);
                expect(texelRect.height / texels.height).toBeCloseTo((turned ? quadSize.x : quadSize.y) / contentSize.y, 9);
                expect(texelRect.x - texels.x).toBeCloseTo(texels.x + texels.width - (texelRect.x + texelRect.width), 9);
                expect(texelRect.y - texels.y).toBeCloseTo(texels.y + texels.height - (texelRect.y + texelRect.height), 9);
            }));
    });

    it("draws content from its region's corner, never beyond the region", () => {
        const anyRegion = fc.record({col: fc.nat(30), row: fc.nat(30),
            numCols: fc.integer({min: 1, max: 7}), numRows: fc.integer({min: 1, max: 7})});
        const anyAspect = fc.double({min: 0.1, max: 10, noNaN: true});
        fc.assert(fc.property(anyRegion, anyAspect, anyArea, (region, aspect, worldSize) => {
            for (const texels of [
                TextureAtlasLayoutUtil.getFittedTexels(aspect, region, 64),
                TextureAtlasLayoutUtil.getDensityTexels(worldSize, region, 64, 128),
            ])
            {
                expect(texels.x).toBe(region.col * 64);
                expect(texels.y).toBe(region.row * 64);
                expect(texels.width).toBeLessThanOrEqual(region.numCols * 64);
                expect(texels.height).toBeLessThanOrEqual(region.numRows * 64);
            }
            // As large as the region holds, at the content's own shape (to the nearest texel).
            const fitted = TextureAtlasLayoutUtil.getFittedTexels(aspect, region, 64);
            expect(fitted.width == region.numCols * 64 || fitted.height == region.numRows * 64).toBe(true);
            expect(Math.abs(fitted.width - fitted.height * aspect)).toBeLessThanOrEqual(Math.max(1, aspect));
        }));
    });
});

describe("what a cut-out picture draws at a point of its quad", () => {
    // An image's texels in the picture atlas: two cells by one.
    const IMAGE: TexelRect = {x: 3 * PICTURE_ATLAS_CELL_SIZE, y: 5 * PICTURE_ATLAS_CELL_SIZE,
        width: 2 * PICTURE_ATLAS_CELL_SIZE, height: PICTURE_ATLAS_CELL_SIZE};
    const owner = {params: {objectId: "picture"}} as Parameters<InstancedMeshBinding["updateInstanceTextureRect"]>[0];

    function atlasTexture(format: THREE.PixelFormat = THREE.RGBAFormat): THREE.Texture
    {
        return new THREE.WebGLRenderTarget(PICTURE_ATLAS_SIZE, PICTURE_ATLAS_SIZE, {format}).texture;
    }

    /** One instance drawing a rect of the picture atlas, turned, through a material that cuts out at a threshold. */
    function instanceShowing(texels: TexelRect, quarterTurns: number = 0, alphaTest: number = 0.5,
        map: THREE.Texture = atlasTexture()): InstancedMeshBinding
    {
        const geometry = new THREE.PlaneGeometry();
        geometry.setAttribute("uvStart", new THREE.InstancedBufferAttribute(new Float32Array(2), 2));
        geometry.setAttribute("uvSampleSize", new THREE.InstancedBufferAttribute(new Float32Array(2), 2));
        geometry.setAttribute("uvQuarterTurns", new THREE.InstancedBufferAttribute(new Float32Array(1), 1));
        const binding = new InstancedMeshBinding(new InstancedTexturePackMaterialParams("atlas",
            PICTURE_ATLAS_SIZE, PICTURE_ATLAS_SIZE, PICTURE_ATLAS_CELL_SIZE, PICTURE_ATLAS_CELL_SIZE, "dynamicEmpty"),
            "Square", 1, false);
        binding.instancedMesh = new THREE.InstancedMesh(geometry, new THREE.MeshPhongMaterial({map, alphaTest}), 1);
        binding.updateInstanceTextureRect(owner, 0, texels.x, texels.y, texels.width, texels.height);
        binding.updateInstanceTextureTurns(owner, 0, quarterTurns);
        return binding;
    }

    const drawnAt = (binding: InstancedMeshBinding, u: number, v: number) =>
        binding.instanceIsDrawnAt(0, new THREE.Vector2(u, v));

    // Where across a rect's width the middle of a texel column is sampled (a rect is sampled from the centre
    // of its first texel to the centre of its last).
    const uOfColumn = (texels: TexelRect, column: number) => (column - texels.x) / (texels.width - 1);

    beforeEach(() => {
        atlasOnGPU.alphaAt = () => 255;
        atlasOnGPU.readFails = false;
        atlasOnGPU.readTexels.length = 0;
    });

    it("draws where its image is opaque and nothing where it is see-through, whichever part of the image it shows", () => {
        // The image's left half is opaque.
        atlasOnGPU.alphaAt = (x) => (x < IMAGE.x + IMAGE.width / 2) ? 255 : 0;

        const whole = instanceShowing(IMAGE);
        expect(drawnAt(whole, 0.25, 0.5)).toBe(true);
        expect(drawnAt(whole, 0.75, 0.5)).toBe(false);

        // On an area half as wide, the picture shows the image's middle, so the opaque half ends at its own.
        const {texelRect} = TextureAtlasLayoutUtil.getLayout({x: 0.5, y: 0.5}, IMAGE, "preserve", 0, {x: 1, y: 0.5});
        const middle = instanceShowing(texelRect);
        expect(drawnAt(middle, 0, 0.5)).toBe(true);
        expect(drawnAt(middle, 0.45, 0.5)).toBe(true);
        expect(drawnAt(middle, 0.55, 0.5)).toBe(false);
    });

    it("turns with the picture, clockwise as it is seen", () => {
        // Only the image's bottom-left quarter is opaque.
        atlasOnGPU.alphaAt = (x, y) => (x < IMAGE.x + IMAGE.width / 2 && y < IMAGE.y + IMAGE.height / 2) ? 255 : 0;

        const quarters = {bottomLeft: [0.25, 0.25], topLeft: [0.25, 0.75], topRight: [0.75, 0.75], bottomRight: [0.75, 0.25]};
        const shownIn = ["bottomLeft", "topLeft", "topRight", "bottomRight"];
        for (let quarterTurns = 0; quarterTurns < 4; ++quarterTurns)
        {
            const picture = instanceShowing(IMAGE, quarterTurns);
            for (const [name, [u, v]] of Object.entries(quarters))
                expect(drawnAt(picture, u, v), `${quarterTurns} turns, ${name}`).toBe(name == shownIn[quarterTurns]);
        }
    });

    it("blends the texels around the point as the atlas's filter does", () => {
        // Opaque up to a column, half faded in the next, see-through from there on.
        const column = IMAGE.x + 40;
        atlasOnGPU.alphaAt = (x) => (x <= column) ? 255 : (x == column + 1) ? 100 : 0;
        const picture = instanceShowing(IMAGE);

        // Nearer the faded texel's centre than the opaque one's, where the blend of the two is still dense enough.
        expect(drawnAt(picture, uOfColumn(IMAGE, column + 0.7), 0.5)).toBe(true);
        expect(drawnAt(picture, uOfColumn(IMAGE, column + 1), 0.5)).toBe(false);
        expect(drawnAt(picture, uOfColumn(IMAGE, column + 1.4), 0.5)).toBe(false);
    });

    it("cuts out at the material's own threshold", () => {
        atlasOnGPU.alphaAt = () => 128;
        expect(drawnAt(instanceShowing(IMAGE), 0.5, 0.5)).toBe(true);
        atlasOnGPU.alphaAt = () => 127;
        expect(drawnAt(instanceShowing(IMAGE), 0.5, 0.5)).toBe(false);
        expect(drawnAt(instanceShowing(IMAGE, 0, 0.25), 0.5, 0.5)).toBe(true);
    });

    it("reads no texel outside the atlas, even at its very corners", () => {
        const last = PICTURE_ATLAS_SIZE - 1;
        atlasOnGPU.alphaAt = (x, y) => ((x == 0 && y == 0) || (x == last && y == last)) ? 255 : 0;
        const cell = PICTURE_ATLAS_CELL_SIZE;

        expect(drawnAt(instanceShowing({x: 0, y: 0, width: cell, height: cell}), 0, 0)).toBe(true);
        expect(drawnAt(instanceShowing({x: PICTURE_ATLAS_SIZE - cell, y: PICTURE_ATLAS_SIZE - cell, width: cell, height: cell}),
            1, 1)).toBe(true);
        expect(atlasOnGPU.readTexels.length).toBeGreaterThan(0);
        for (const texel of atlasOnGPU.readTexels)
        {
            expect(texel.x >= 0 && texel.x <= last, `x = ${texel.x}`).toBe(true);
            expect(texel.y >= 0 && texel.y <= last, `y = ${texel.y}`).toBe(true);
        }
    });

    it("takes anything that is no cut-out drawn at runtime as drawn all over, without reading anything back", () => {
        atlasOnGPU.alphaAt = () => 0;

        expect(drawnAt(instanceShowing(IMAGE, 0, 0), 0.5, 0.5), "a material that cuts nothing out").toBe(true);
        expect(drawnAt(instanceShowing(IMAGE, 0, 0.5, new THREE.Texture()), 0.5, 0.5), "an image loaded as it is").toBe(true);
        expect(drawnAt(instanceShowing(IMAGE, 0, 0.5, atlasTexture(THREE.RedFormat)), 0.5, 0.5), "coverage alone").toBe(true);
        const unloaded = new InstancedMeshBinding(new InstancedTexturePackMaterialParams("atlas",
            PICTURE_ATLAS_SIZE, PICTURE_ATLAS_SIZE, PICTURE_ATLAS_CELL_SIZE, PICTURE_ATLAS_CELL_SIZE, "dynamicEmpty"),
            "Square", 1, false);
        expect(drawnAt(unloaded, 0.5, 0.5), "a mesh not loaded yet").toBe(true);
        expect(atlasOnGPU.readTexels).toEqual([]);
    });

    it("takes a cut-out as drawn where the atlas can't be read back", () => {
        atlasOnGPU.alphaAt = () => 0;
        atlasOnGPU.readFails = true;

        expect(drawnAt(instanceShowing(IMAGE), 0.5, 0.5)).toBe(true);
        expect(atlasOnGPU.readTexels.length).toBeGreaterThan(0);
    });
});

describe("label lettering layout", () => {
    // A monospaced stand-in for the font: every character is half the font size wide.
    const CHAR_WIDTH = 0.5;
    const measureWidth = (str: string) => Array.from(str).length * CHAR_WIDTH;
    const lineSpacing = LabelTextLayoutUtil.lineSpacing;

    const layOut = (text: string, width: number, height: number, autoSize: boolean, fontSize: number) =>
        LabelTextLayoutUtil.layOut(text, width, height, autoSize, fontSize, measureWidth);

    const anyWord = fc.array(fc.constantFrom(..."abcdefghij".split("")), {minLength: 1, maxLength: 12})
        .map(chars => chars.join(""));
    const anyText = fc.array(anyWord, {minLength: 1, maxLength: 60}).map(words => words.join(" "));
    const anyBox = fc.record({width: fc.integer({min: 40, max: 900}), height: fc.integer({min: 20, max: 900})});

    // Words each followed by a space or a line break.
    const anyBrokenText = fc.array(fc.tuple(anyWord, fc.constantFrom(" ", "\n")), {minLength: 1, maxLength: 40})
        .map(words => words.map(([word, separator]) => word + separator).join(""));

    it("lays out nothing for text with no words", () => {
        expect(layOut("", 200, 100, true, 64).lines).toEqual([]);
        expect(layOut("   ", 200, 100, false, 64).lines).toEqual([]);
        expect(layOut("\n \n", 200, 100, true, 64).lines).toEqual([]);
    });

    it("fits the whole text when sizing it automatically, every word whole and in order", () => {
        fc.assert(fc.property(anyText, anyBox, (text, box) => {
            const {lines, fontSize} = layOut(text, box.width, box.height, true, 64);
            expect(lines.join(" ")).toBe(text);
            expect(lines.length * fontSize * lineSpacing).toBeLessThanOrEqual(box.height * (1 + 1e-9));
            for (const line of lines)
                expect(measureWidth(line) * fontSize).toBeLessThanOrEqual(box.width * (1 + 1e-9));
        }), {numRuns: 300});
    });

    it("fits text over its line breaks too, every word whole and in order", () => {
        fc.assert(fc.property(anyBrokenText, anyBox, (text, box) => {
            const {lines, fontSize} = layOut(text, box.width, box.height, true, 64);
            expect(lines.flatMap(line => line.split(" "))).toEqual(text.trim().split(/\s+/));
            expect(lines.length * fontSize * lineSpacing).toBeLessThanOrEqual(box.height * (1 + 1e-9));
            for (const line of lines)
                expect(measureWidth(line) * fontSize).toBeLessThanOrEqual(box.width * (1 + 1e-9));
        }), {numRuns: 300});
    });

    it("sizes a lone word to whichever of the width and height runs out first", () => {
        const {fontSize} = layOut("Library", 300, 100, true, 64);
        expect(fontSize).toBeCloseTo(Math.min(100 / lineSpacing, 300 / (7 * CHAR_WIDTH)), 6);
    });

    it("evens words out over the lines instead of leaving the last one alone", () => {
        // Greedy filling would give "one two three" and a lone "four".
        const width = "one two three".length * CHAR_WIDTH * 10;
        const {lines} = layOut("one two three four", width, 25, true, 64);
        expect(lines).toEqual(["one two", "three four"]);
    });

    it("starts a new line at every line break, keeping a blank line between lines but none at the ends", () => {
        for (const autoSize of [true, false])
        {
            const {lines} = layOut("\none\n\ntwo three\n", 1000, 1000, autoSize, 20);
            expect(lines, `autoSize ${autoSize}`).toEqual(["one", "", "two three"]);
        }
    });

    it("keeps a fixed size, fitting every line and cutting nothing out of the text", () => {
        fc.assert(fc.property(anyText, anyBox, fc.integer({min: 16, max: 256}), (text, box, fontSize) => {
            const layout = layOut(text, box.width, box.height, false, fontSize);
            expect(layout.fontSize).toBe(fontSize);
            expect(layout.lines.join("").replace(/ /g, "")).toBe(text.replace(/ /g, ""));
            for (const line of layout.lines)
            {
                // A single character wider than the box is the one thing that can't be helped.
                if (Array.from(line).length > 1)
                    expect(measureWidth(line) * fontSize).toBeLessThanOrEqual(box.width + 1e-9);
            }
        }), {numRuns: 300});
    });

    it("breaks a word too long for a line between characters, never inside one", () => {
        const word = "😀".repeat(40);
        const {lines} = layOut(word, 100, 400, false, 20);
        expect(lines.length).toBeGreaterThan(1);
        expect(lines.join("")).toBe(word);
        for (const line of lines)
            expect(Array.from(line).every(char => char == "😀")).toBe(true);
    });

    it("leaves what doesn't fit at a fixed size below the patch, for the caller to cut off", () => {
        const text = Array(128).fill("word").join(" ");
        const {lines, fontSize} = layOut(text, 200, 100, false, 32);
        expect(lines.length * fontSize * lineSpacing).toBeGreaterThan(100);
        expect(lines[0]).toBe("word word"); // top-down, in order
    });
});

describe("the label font", () => {
    const file = fs.readFileSync(path.join(__dirname, "../../../public/app/assets/resources/Tinos/Tinos-Regular-Latin.ttf"));
    const metrics = FontMetricsUtil.parse(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
    const advanceOf = (char: string) => metrics.advanceByCodePoint.get(char.codePointAt(0)!);

    it("is read from the file's own tables, as fontTools reads them", () => {
        expect(metrics.unitsPerEm).toBe(2048);
        expect([metrics.ascent, metrics.descent]).toEqual([1825, 443]);
        expect(metrics.advanceByCodePoint.size).toBe(321);
        expect(["A", "W", " ", "é", "�"].map(advanceOf)).toEqual([1479, 1933, 512, 909, 1721]);
        expect(metrics.missingAdvance).toBe(1593);
    });

    it("measures a string as its characters' advances added up, whatever it is split into", () => {
        fc.assert(fc.property(fc.string({unit: fc.constantFrom(..."Tinos, café!".split(""))}), fc.nat(), (str, cut) => {
            const at = cut % (str.length + 1);
            expect(FontMetricsUtil.measureWidth(metrics, str) * metrics.unitsPerEm).toBe(
                (FontMetricsUtil.measureWidth(metrics, str.slice(0, at))
                    + FontMetricsUtil.measureWidth(metrics, str.slice(at))) * metrics.unitsPerEm);
        }), {numRuns: 200});
    });

    it("draws what it lacks as U+FFFD, composing accents first and keeping whitespace for the layout", () => {
        expect(FontMetricsUtil.replaceMissingChars(metrics, "Café ☕\n한글\tok"))
            .toBe("Café �\n��\tok");
        expect(FontMetricsUtil.replaceMissingChars(metrics, "Grand Library, № 😀")).toBe("Grand Library, � �");
    });
});
