/**
 * Voxel texture packs: the procedural textures SSG adds to every pack (one for each cell past a pack's own, the
 * same pixels on every draw, averaging to their color, a metal's shine in streaks all over it and never a broad
 * sheen, no part of a painted wall flat, as continuous across the edge they tile at as inside, in
 * a margin of their own continuation), the atlas the builder writes (the pack's image left as it is, its cells
 * kept where they were under the procedural rows, each of those at its texture index, another size refused),
 * the packs' image map made of those atlases, what a build redoes (the rows kept as an image of their own and
 * attached as it stands, drawn again only when missing, another size or on a full build; an atlas built only when
 * missing or older than what it is made of, or on a full build), the rows and atlases as shipped (the atlases the
 * ones the game loads, previewed whole, and both current with the packs and the textures as drawn today), and the
 * texels a quad shows of its texture (the quarter of a pack's own cell it lies over, of a procedural one inside
 * its margin, the quads over one world unit making up the whole between them, read the way each face is turned,
 * never past its cell, sampled from texel centre to texel centre).
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("../../../src/client/graphics/graphicsManager", async () => {
    const THREE = await import("three");
    const camera = new THREE.PerspectiveCamera();
    const scene = new THREE.Scene();
    const lightBlockMap = { requestRecomputation() {}, resetForRoom(_voxels?: unknown) {} };
    return { default: { getCamera: () => camera, getScene: () => scene, getLightBlockMap: () => lightBlockMap } };
});

vi.mock("../../../src/client/app", () => ({
    default: { getCurrentRoom: vi.fn(), getVoxelQuads: vi.fn(), getUser: vi.fn(), getEnv: vi.fn() },
}));

vi.mock("../../../src/client/graphics/types/gizmo/generic/worldSpaceOutlineRect", () => ({
    default: class WorldSpaceOutlineRectStub
    {
        static async create() { return new WorldSpaceOutlineRectStub(); }
        addToParent() {}
        setTransform() {}
        setTransformRaw() {}
        setVisible() {}
        dispose() {}
    },
}));

// Imported by the modules under test; nothing here needs a running game.
vi.mock("../../../src/client/object/clientObjectManager", () => ({
    default: { getMyPlayer: vi.fn(), getObjectById: vi.fn() },
}));

import * as THREE from "three";
import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import ProceduralTextureUtil from "../../../src/server/ssg/util/proceduralTextureUtil";
import { ProceduralVoxelTextures } from "../../../src/server/ssg/data/proceduralVoxelTextures";
import { ImageMapSeeds } from "../../../src/server/ssg/data/imageMapSeeds";
import VoxelTexturePackBuilder from "../../../src/server/ssg/builder/voxelTexturePackBuilder";
import ImageMapBuilder from "../../../src/server/ssg/builder/imageMapBuilder";
import ImageMapUtil from "../../../src/shared/graphics/image/util/imageMapUtil";
import ColorUtil from "../../../src/shared/math/util/colorUtil";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import VoxelUpdateUtil from "../../../src/shared/voxel/util/voxelUpdateUtil";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import InstancedTexturePackMaterialParams from "../../../src/shared/graphics/material/types/instancedTexturePackMaterialParams";
import VoxelGameObject from "../../../src/client/object/types/gameObject/voxelGameObject";
import GameObject from "../../../src/client/object/types/gameObject/gameObject";
import VoxelQuadInstanceUtil from "../../../src/client/voxel/util/voxelQuadInstanceUtil";
import InstancedMeshBinding from "../../../src/client/graphics/types/mesh/instancedMeshBinding";
import TexelRect from "../../../src/client/graphics/types/texture/texelRect";
import { getUVScales } from "../../../src/client/graphics/shaders/instancedTexturePackShader";
import { createTestRoom } from "../helpers/roomContent";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NUM_PACK_VOXEL_TEXTURES, NUM_VOXEL_TEXTURES, NUM_VOXEL_TEXTURE_COLS,
    NUM_VOXEL_TEXTURE_ROWS, PROCEDURAL_VOXEL_TEXTURE_MARGIN, VOXEL_TEXTURE_CELL_SIZE } from "../../../src/shared/system/sharedConstants";

const CELL = VOXEL_TEXTURE_CELL_SIZE;
const MARGIN = PROCEDURAL_VOXEL_TEXTURE_MARGIN;
const TILE = CELL - 2 * MARGIN; // the size a procedural texture tiles at
const ATLAS_WIDTH = NUM_VOXEL_TEXTURE_COLS * CELL;
const ATLAS_HEIGHT = NUM_VOXEL_TEXTURE_ROWS * CELL;
const PACK_HEIGHT = (NUM_PACK_VOXEL_TEXTURES / NUM_VOXEL_TEXTURE_COLS) * CELL;
const ROWS_HEIGHT = ATLAS_HEIGHT - PACK_HEIGHT; // of the procedural rows, above a pack's own

const PACKS_DIR = "public/app/assets/voxel_texture_packs";
const SUFFIX = ImageMapSeeds.VoxelTexturePackImageMap.augmentedPathSuffix;
const ROWS_FILE = VoxelTexturePackBuilder.PROCEDURAL_ROWS_FILE_NAME;

// Where a texture's cell lies in an atlas image, whose rows run from the top (texture indices count from the bottom).
function cellOrigin(textureIndex: number): {left: number, top: number}
{
    return {left: (textureIndex % NUM_VOXEL_TEXTURE_COLS) * CELL,
        top: (NUM_VOXEL_TEXTURE_ROWS - 1 - Math.floor(textureIndex / NUM_VOXEL_TEXTURE_COLS)) * CELL};
}

// The average color of a rect of raw RGB pixels.
function meanColor(pixels: Uint8Array, imageWidth: number, left: number, top: number, width: number, height: number): number[]
{
    const sum = [0, 0, 0];
    for (let y = top; y < top + height; ++y)
    {
        for (let x = left; x < left + width; ++x)
        {
            for (let channel = 0; channel < 3; ++channel)
                sum[channel] += pixels[(y * imageWidth + x) * 3 + channel];
        }
    }
    return sum.map(value => value / (width * height));
}

// The least, mean and greatest brightness (the mean of a pixel's channels) in a rect of a tile.
function brightnessIn(tile: Uint8Array, left: number, top: number, width: number, height: number):
    {min: number, mean: number, max: number}
{
    let min = Infinity, max = -Infinity, sum = 0;
    for (let y = top; y < top + height; ++y)
    {
        for (let x = left; x < left + width; ++x)
        {
            const i = (y * TILE + x) * 3;
            const brightness = (tile[i] + tile[i + 1] + tile[i + 2]) / 3;
            min = Math.min(min, brightness);
            max = Math.max(max, brightness);
            sum += brightness;
        }
    }
    return {min, mean: sum / (width * height), max};
}

// How far two images of the same size are apart, as the mean difference of a channel.
function meanDifference(a: Uint8Array, b: Uint8Array): number
{
    expect(a.length).toBe(b.length);
    let sum = 0;
    for (let i = 0; i < a.length; ++i)
        sum += Math.abs(a[i] - b[i]);
    return sum / a.length;
}

// From the file's bytes rather than its path: sharp keeps what it loaded from a path, and these tests build the
// same file more than once.
async function readPixels(filePath: string): Promise<Uint8Array>
{
    return new Uint8Array(await sharp(fs.readFileSync(filePath)).removeAlpha().raw().toBuffer());
}

async function readSize(filePath: string): Promise<(number | undefined)[]>
{
    const metadata = await sharp(fs.readFileSync(filePath)).metadata();
    return [metadata.width, metadata.height];
}

// A directory of its own holding the given packs, where `run` builds as SSG does: their atlases (everything, or
// only what is out of date), and their image map, whose module it gets back. The builders read and write under the
// directory a build was started in (PWD). Taken away afterwards.
async function withPacks<T>(packs: {name: string, image: Buffer}[],
    run: (site: {packsDir: string, build: (alwaysRebuild: boolean) => Promise<void>,
        buildMap: () => Promise<string>}) => Promise<T>): Promise<T>
{
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "voxel-texture-pack-"));
    const startedIn = process.env.PWD;
    try
    {
        const packsDir = path.join(dir, PACKS_DIR);
        const mapsDir = path.join(dir, "src/shared/graphics/image/maps");
        fs.mkdirSync(packsDir, {recursive: true});
        fs.mkdirSync(mapsDir, {recursive: true});
        fs.writeFileSync(path.join(packsDir, "manifest.json"),
            JSON.stringify({images: packs.map(pack => ({path: pack.name, author: "", title: pack.name}))}));
        for (const pack of packs)
            fs.writeFileSync(path.join(packsDir, `${pack.name}.webp`), pack.image);

        process.env.PWD = dir;
        return await run({
            packsDir,
            build: (alwaysRebuild) => new VoxelTexturePackBuilder(alwaysRebuild).build(),
            buildMap: async () => {
                await new ImageMapBuilder(ImageMapSeeds.VoxelTexturePackImageMap).build();
                return fs.readFileSync(path.join(mapsDir, "voxelTexturePackImageMap.ts"), "utf8");
            },
        });
    }
    finally
    {
        process.env.PWD = startedIn;
        fs.rmSync(dir, {recursive: true, force: true});
    }
}

// The rows of procedural cells as they are drawn now, laid out as an atlas has them.
function drawProceduralRows(): Buffer
{
    const pixels = Buffer.alloc(ATLAS_WIDTH * ROWS_HEIGHT * 3);
    ProceduralVoxelTextures.forEach((spec, index) => {
        const cell = ProceduralTextureUtil.generateCell(spec, CELL, MARGIN, index);
        const {left, top} = cellOrigin(NUM_PACK_VOXEL_TEXTURES + index);
        for (let y = 0; y < CELL; ++y)
            pixels.set(cell.subarray(y * CELL * 3, (y + 1) * CELL * 3), ((top + y) * ATLAS_WIDTH + left) * 3);
    });
    return pixels;
}

// Makes a file as old as if it had last been written so many minutes ago.
function setAge(filePath: string, minutes: number): void
{
    const time = new Date(Date.now() - minutes * 60_000);
    fs.utimesSync(filePath, time, time);
}

// A pack image whose cells are each one flat color of their own.
function packColor(col: number, row: number): number[]
{
    return [40 + col * 24, 40 + row * 24, 200 - (col + row) * 10];
}
async function makePackImage(width: number = ATLAS_WIDTH, height: number = PACK_HEIGHT): Promise<Buffer>
{
    const pixels = Buffer.alloc(width * height * 3);
    for (let y = 0; y < height; ++y)
    {
        for (let x = 0; x < width; ++x)
            pixels.set(packColor(Math.floor(x / CELL), Math.floor(y / CELL)), (y * width + x) * 3);
    }
    return await sharp(pixels, {raw: {width, height, channels: 3}}).webp({lossless: true}).toBuffer();
}

describe("procedural voxel textures", () => {
    it("are listed one for each cell of the atlas past a pack's own", () => {
        expect(ProceduralVoxelTextures.length).toBe(NUM_VOXEL_TEXTURES - NUM_PACK_VOXEL_TEXTURES);
        expect(NUM_PACK_VOXEL_TEXTURES % NUM_VOXEL_TEXTURE_COLS).toBe(0);
        // A quad's texture is stored in seven bits (see Voxel).
        expect(NUM_VOXEL_TEXTURES).toBeLessThanOrEqual(128);
    });

    it("draw the same pixels every time, and others from another seed", () => {
        ProceduralVoxelTextures.forEach((spec, index) => {
            const cell = Buffer.from(ProceduralTextureUtil.generateCell(spec, CELL, MARGIN, index));
            expect(cell.length).toBe(CELL * CELL * 3);
            expect(cell.equals(ProceduralTextureUtil.generateCell(spec, CELL, MARGIN, index)), `texture ${index}`)
                .toBe(true);
            expect(cell.equals(ProceduralTextureUtil.generateCell(spec, CELL, MARGIN, index + 1000)), `texture ${index}`)
                .toBe(false);
        });
    });

    it("average to their color", () => {
        ProceduralVoxelTextures.forEach((spec, index) => {
            const tile = ProceduralTextureUtil.generateCell(spec, TILE, 0, index);
            const color = ColorUtil.hexToRGB(spec.colorHex);
            const mean = meanColor(tile, TILE, 0, 0, TILE, TILE);
            [color.x, color.y, color.z].forEach((wanted, channel) => {
                expect(Math.abs(mean[channel] - wanted), `texture ${index} (${spec.colorHex}), channel ${channel}`)
                    .toBeLessThan(1);
            });
        });
    });

    it("give a metal bright streaks all over, and no sheen broad enough to show where it repeats", () => {
        const QUARTER = TILE / 4;
        const metals = ProceduralVoxelTextures.map((spec, index) => ({spec, index}))
            .filter(({spec}) => spec.surface == "metal");
        expect(metals.length).toBeGreaterThan(0);

        for (const {spec, index} of metals)
        {
            const tile = ProceduralTextureUtil.generateCell(spec, TILE, 0, index);
            const overall = brightnessIn(tile, 0, 0, TILE, TILE).mean;
            for (let i = 0; i < 4; ++i)
            {
                // What a sheen would brighten or dim together: a band the whole height or the whole width, and
                // a quarter of each.
                const where = `texture ${index} (${spec.colorHex}), quarter ${i}`;
                expect(Math.abs(brightnessIn(tile, i * QUARTER, 0, QUARTER, TILE).mean - overall), where)
                    .toBeLessThan(1);
                expect(Math.abs(brightnessIn(tile, 0, i * QUARTER, TILE, QUARTER).mean - overall), where)
                    .toBeLessThan(1);
                for (let j = 0; j < 4; ++j)
                {
                    const part = brightnessIn(tile, i * QUARTER, j * QUARTER, QUARTER, QUARTER);
                    expect(Math.abs(part.mean - overall), `${where}, ${j}`).toBeLessThan(2);
                    expect(part.max - overall, `${where}, ${j}`).toBeGreaterThan(12);
                }
            }
        }
    });

    it("leave no part of a painted wall flat", () => {
        // In patches a few pores across: with pores all over, the flattest holds at least half the detail of a
        // typical one.
        const PATCH = 8;
        expect(TILE % PATCH).toBe(0);

        ProceduralVoxelTextures.forEach((spec, index) => {
            if (spec.surface != "paintedConcrete")
                return;
            const tile = ProceduralTextureUtil.generateCell(spec, TILE, 0, index);
            const ranges: number[] = [];
            for (let top = 0; top < TILE; top += PATCH)
            {
                for (let left = 0; left < TILE; left += PATCH)
                {
                    const patch = brightnessIn(tile, left, top, PATCH, PATCH);
                    ranges.push(patch.max - patch.min);
                }
            }
            ranges.sort((a, b) => a - b);
            expect(ranges[0], `texture ${index} (${spec.colorHex})`)
                .toBeGreaterThanOrEqual(0.5 * ranges[ranges.length >> 1]);
        });
    });

    it("are as continuous across the edge they tile at as anywhere inside", () => {
        // The step from each line of pixels to the next, the last line's next being the first (the edge the
        // texture tiles at), measured two ways: pixel by pixel, and as what a run of pixels along the line takes
        // together, which is how a break in the texture's broad shapes shows under its fine detail. A crop of a
        // larger texture, which doesn't tile, fails most of these.
        const RUN = 16;
        const steps = (tile: Uint8Array, alongX: boolean): {plain: number[], coherent: number[]} => {
            const plain: number[] = [], coherent: number[] = [];
            for (let line = 0; line < TILE; ++line)
            {
                const previousLine = (line - 1 + TILE) % TILE;
                let plainSum = 0, coherentSum = 0;
                for (let runStart = 0; runStart < TILE; runStart += RUN)
                {
                    const runSum = [0, 0, 0];
                    for (let i = runStart; i < runStart + RUN; ++i)
                    {
                        for (let channel = 0; channel < 3; ++channel)
                        {
                            const difference = tile[(alongX ? i * TILE + line : line * TILE + i) * 3 + channel]
                                - tile[(alongX ? i * TILE + previousLine : previousLine * TILE + i) * 3 + channel];
                            runSum[channel] += difference;
                            plainSum += Math.abs(difference);
                        }
                    }
                    coherentSum += (Math.abs(runSum[0]) + Math.abs(runSum[1]) + Math.abs(runSum[2])) / (3 * RUN);
                }
                plain.push(plainSum / (TILE * 3));
                coherent.push(coherentSum / (TILE / RUN));
            }
            return {plain, coherent};
        };
        expect(TILE % RUN).toBe(0);

        ProceduralVoxelTextures.forEach((spec, index) => {
            const tile = ProceduralTextureUtil.generateCell(spec, TILE, 0, index);
            for (const alongX of [true, false])
            {
                const where = `texture ${index} (${spec.surface}), ${alongX ? "left to right" : "top to bottom"}`;
                for (const [atEdge, ...inside] of Object.values(steps(tile, alongX)))
                    expect(atEdge, where).toBeLessThanOrEqual(1.25 * Math.max(...inside));
            }
        });
    });

    it("come in a margin that is their own continuation", () => {
        ProceduralVoxelTextures.forEach((spec, index) => {
            const tile = ProceduralTextureUtil.generateCell(spec, TILE, 0, index);
            const cell = ProceduralTextureUtil.generateCell(spec, CELL, MARGIN, index);
            for (let y = 0; y < CELL; ++y)
            {
                for (let x = 0; x < CELL; ++x)
                {
                    const from = (((y - MARGIN + TILE) % TILE) * TILE + (x - MARGIN + TILE) % TILE) * 3;
                    if (cell[(y * CELL + x) * 3] != tile[from] || cell[(y * CELL + x) * 3 + 1] != tile[from + 1]
                        || cell[(y * CELL + x) * 3 + 2] != tile[from + 2])
                        expect.fail(`texture ${index} :: the cell's pixel (${x},${y}) isn't the tile's, repeated`);
                }
            }
        });
    });
});

describe("building a pack's atlas", () => {
    it("leaves the pack's image as it is and keeps its cells where they were, under the procedural rows", async () => {
        const image = await makePackImage();
        await withPacks([{name: "pack", image}], async ({packsDir, build}) => {
            await build(true);
            expect(fs.readFileSync(path.join(packsDir, "pack.webp")).equals(image)).toBe(true);

            const atlasPath = path.join(packsDir, `pack${SUFFIX}.webp`);
            expect(await readSize(atlasPath)).toEqual([ATLAS_WIDTH, ATLAS_HEIGHT]);

            const atlas = await readPixels(atlasPath);
            const own = await readPixels(path.join(packsDir, "pack.webp"));
            const packTop = ATLAS_HEIGHT - PACK_HEIGHT;
            expect(meanDifference(atlas.subarray(packTop * ATLAS_WIDTH * 3), own)).toBeLessThan(3);

            // The pack's top cells keep their upper edge: no color comes down into it from the cells above.
            for (let col = 0; col < NUM_VOXEL_TEXTURE_COLS; ++col)
            {
                const inAtlas = meanColor(atlas, ATLAS_WIDTH, col * CELL, packTop, CELL, 1);
                const inPack = meanColor(own, ATLAS_WIDTH, col * CELL, 0, CELL, 1);
                inPack.forEach((wanted, channel) =>
                    expect(Math.abs(inAtlas[channel] - wanted), `the top line of the pack's cell in column ${col}`)
                        .toBeLessThan(3));
            }
        });
    });

    it("puts each procedural texture at its texture index", async () => {
        await withPacks([{name: "pack", image: await makePackImage()}], async ({packsDir, build}) => {
            await build(true);
            const atlas = await readPixels(path.join(packsDir, `pack${SUFFIX}.webp`));
            ProceduralVoxelTextures.forEach((spec, index) => {
                const {left, top} = cellOrigin(NUM_PACK_VOXEL_TEXTURES + index);
                const color = ColorUtil.hexToRGB(spec.colorHex);
                // What a quad shows of the cell, which no neighbour's color reaches.
                const mean = meanColor(atlas, ATLAS_WIDTH, left + MARGIN, top + MARGIN, TILE, TILE);
                [color.x, color.y, color.z].forEach((wanted, channel) => {
                    expect(Math.abs(mean[channel] - wanted), `texture ${index} (${spec.colorHex}), channel ${channel}`)
                        .toBeLessThan(3);
                });
            });
            // And a pack's own first texture stays at the bottom left.
            const {left, top} = cellOrigin(0);
            const firstCell = meanColor(atlas, ATLAS_WIDTH, left + 8, top + 8, CELL - 16, CELL - 16);
            packColor(0, PACK_HEIGHT / CELL - 1).forEach((wanted, channel) =>
                expect(Math.abs(firstCell[channel] - wanted)).toBeLessThan(3));
        });
    });

    it("refuses a pack image that isn't the size of a pack's own cells", async () => {
        const image = await makePackImage(ATLAS_WIDTH, PACK_HEIGHT - CELL);
        await expect(withPacks([{name: "pack", image}], ({build}) => build(true)))
            .rejects.toThrow(/a pack's own cells take/);
    });

    it("builds the packs' image map of the atlases, each previewed whole", async () => {
        await withPacks([{name: "pack", image: await makePackImage()}], async ({packsDir, build, buildMap}) => {
            await build(true);
            const mapModule = await buildMap();
            expect(mapModule).toContain(`{path:"pack",keywords:"pack",coords:",0,0",width:${ATLAS_WIDTH},height:${ATLAS_HEIGHT}}`);
            const cellWidth = ImageMapSeeds.VoxelTexturePackImageMap.gridCellSize;
            const cellHeight = ImageMapSeeds.VoxelTexturePackImageMap.gridCellHeight;
            expect(mapModule).toContain(`, ${cellHeight}, "${SUFFIX}"));`);

            // One cell of the atlas's own shape, showing it from its top row to its bottom one.
            const gridPath = path.join(packsDir, "grid.webp");
            expect(await readSize(gridPath)).toEqual([cellWidth, cellHeight]);
            expect(cellWidth / cellHeight).toBe(ATLAS_WIDTH / ATLAS_HEIGHT);
            const grid = await readPixels(gridPath);
            const scale = cellWidth / ATLAS_WIDTH;
            const lastTexture = ColorUtil.hexToRGB(ProceduralVoxelTextures[ProceduralVoxelTextures.length - 1].colorHex);
            const topRight = meanColor(grid, cellWidth, cellWidth - CELL * scale + 4, 4, CELL * scale - 8, CELL * scale - 8);
            [lastTexture.x, lastTexture.y, lastTexture.z].forEach((wanted, channel) =>
                expect(Math.abs(topRight[channel] - wanted)).toBeLessThan(6));
        });
    });
});

describe("building only what changed", () => {
    const flatColor = [200, 40, 120];
    const makeFlatImage = (width: number, height: number): Promise<Buffer> =>
        sharp({create: {width, height, channels: 3, background: {r: flatColor[0], g: flatColor[1], b: flatColor[2]}}})
            .webp({lossless: true}).toBuffer();

    it("keeps the procedural rows as an image of their own, exactly as drawn", async () => {
        await withPacks([{name: "pack", image: await makePackImage()}], async ({packsDir, build}) => {
            await build(false);
            expect(await readSize(path.join(packsDir, ROWS_FILE))).toEqual([ATLAS_WIDTH, ROWS_HEIGHT]);
            expect(drawProceduralRows().equals(await readPixels(path.join(packsDir, ROWS_FILE)))).toBe(true);
        });
    });

    it("gives an atlas what that image holds, drawing it again only when it is missing, another size, or everything is rebuilt", async () => {
        await withPacks([{name: "pack", image: await makePackImage()}], async ({packsDir, build}) => {
            const rowsPath = path.join(packsDir, ROWS_FILE);
            const atlasPath = path.join(packsDir, `pack${SUFFIX}.webp`);
            await build(false);

            // Another image in its place is left as it is, and is what the atlas gets.
            const flatRows = await makeFlatImage(ATLAS_WIDTH, ROWS_HEIGHT);
            fs.writeFileSync(rowsPath, flatRows);
            setAge(atlasPath, 60);
            await build(false);
            expect(fs.readFileSync(rowsPath).equals(flatRows)).toBe(true);
            const {left, top} = cellOrigin(NUM_PACK_VOXEL_TEXTURES);
            const cell = meanColor(await readPixels(atlasPath), ATLAS_WIDTH, left + MARGIN, top + MARGIN, TILE, TILE);
            // Loosely: the atlas's encoding shifts so strong a color, but nowhere near the texture drawn for the cell.
            flatColor.forEach((wanted, channel) => expect(Math.abs(cell[channel] - wanted)).toBeLessThan(10));

            // One of another size isn't the rows.
            fs.writeFileSync(rowsPath, await makeFlatImage(16, 16));
            await build(false);
            expect(drawProceduralRows().equals(await readPixels(rowsPath))).toBe(true);

            fs.rmSync(rowsPath);
            await build(false);
            expect(drawProceduralRows().equals(await readPixels(rowsPath))).toBe(true);

            fs.writeFileSync(rowsPath, flatRows);
            await build(true);
            expect(drawProceduralRows().equals(await readPixels(rowsPath))).toBe(true);
        });
    });

    it("leaves an atlas newer than its pack's image and the rows, and builds one older than either, or missing", async () => {
        await withPacks([{name: "pack", image: await makePackImage()}], async ({packsDir, build}) => {
            const packPath = path.join(packsDir, "pack.webp");
            const rowsPath = path.join(packsDir, ROWS_FILE);
            const atlasPath = path.join(packsDir, `pack${SUFFIX}.webp`);
            const wasBuilt = (): boolean => fs.statSync(atlasPath).mtimeMs > Date.now() - 20 * 60_000;
            const makeUpToDate = () => { setAge(packPath, 120); setAge(rowsPath, 120); setAge(atlasPath, 60); };
            await build(false);

            makeUpToDate();
            await build(false);
            expect(wasBuilt()).toBe(false);

            setAge(packPath, 30);
            await build(false);
            expect(wasBuilt()).toBe(true);

            makeUpToDate();
            setAge(rowsPath, 30);
            await build(false);
            expect(wasBuilt()).toBe(true);

            fs.rmSync(atlasPath);
            await build(false);
            expect(wasBuilt()).toBe(true);

            // Everything is rebuilt on asking, whatever its age.
            makeUpToDate();
            await build(true);
            expect(wasBuilt()).toBe(true);
        });
    });
});

describe("the shipped packs", () => {
    const map = () => ImageMapUtil.getImageMap("VoxelTexturePackImageMap");

    it("are loaded as their atlases, which the chooser previews whole", () => {
        expect(map().getImageMetadataList().length).toBeGreaterThan(0);
        for (const image of map().getImageMetadataList())
        {
            expect(map().getImageURLByPath("assets", image.path))
                .toBe(`assets/voxel_texture_packs/${image.path}${SUFFIX}.webp`);
            expect([image.width, image.height], image.path).toEqual([ATLAS_WIDTH, ATLAS_HEIGHT]);
        }
        expect(map().getGridCellSize() / map().getGridCellHeight()).toBe(ATLAS_WIDTH / ATLAS_HEIGHT);
    });

    it("ship the procedural rows as they are drawn today", async () => {
        expect(drawProceduralRows().equals(await readPixels(path.join(PACKS_DIR, ROWS_FILE))),
            `${PACKS_DIR}/${ROWS_FILE} is out of date with the procedural textures: run SSG`).toBe(true);
    });

    it("ship the atlases the builder makes of them today", async () => {
        const packs = map().getImageMetadataList().map(image =>
            ({name: image.path, image: fs.readFileSync(path.join(PACKS_DIR, `${image.path}.webp`))}));
        await withPacks(packs, async ({packsDir, build}) => {
            await build(true);
            for (const pack of packs)
            {
                const fileName = `${pack.name}${SUFFIX}.webp`;
                const shipped = await readPixels(path.join(PACKS_DIR, fileName));
                const built = await readPixels(path.join(packsDir, fileName));
                expect(meanDifference(shipped, built),
                    `${PACKS_DIR}/${fileName} is out of date with its pack or the procedural textures: run SSG`)
                    .toBeLessThan(1);
            }
        });
    });
});

describe("the texels a quad shows of its texture", () => {
    // The voxels one tile lies over: a world unit of the floor plan, two voxels each way from the first.
    const ROW = 10, COL = 10;
    const UNIT_ROWS = [ROW, ROW + 1], UNIT_COLS = [COL, COL + 1];
    const EVEN_LAYER = 2, ODD_LAYER = 3;
    const room = createTestRoom("texels", "texels", RoomTypeEnumMap.Hub);
    const voxels = room.voxelGrid.voxels;

    // The first voxel's floor and a wall's two kinds of layer, which show a quarter of a tile each.
    const floorQuad = VoxelQueryUtil.getFloorVoxelQuadIndex(ROW, COL);
    const evenLayerWallQuad = VoxelQueryUtil.getVoxelQuadIndex(ROW, COL, "x", "+", EVEN_LAYER);
    const oddLayerWallQuad = VoxelQueryUtil.getVoxelQuadIndex(ROW, COL, "x", "+", ODD_LAYER);

    // The quads lying over the whole unit: its four floors, and a wall's faces two blocks along and two up.
    const unitFloorQuads = UNIT_ROWS.flatMap(row =>
        UNIT_COLS.map(col => VoxelQueryUtil.getFloorVoxelQuadIndex(row, col)));
    const unitWallQuads = UNIT_ROWS.flatMap(row => [EVEN_LAYER, ODD_LAYER].map(layer =>
        VoxelQueryUtil.getVoxelQuadIndex(row, COL, "x", "+", layer)));

    // All of them are drawn: the unit is open down to its floor but for a wall two blocks high hanging over
    // its first col, and so are the voxels the wall's faces look into.
    const blockQuadIndexOf = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer;
    for (let layer = COLLISION_LAYER_MIN; layer <= COLLISION_LAYER_MAX; ++layer)
    {
        for (const row of UNIT_ROWS)
        {
            for (const col of UNIT_COLS)
                VoxelUpdateUtil.removeVoxelBlock(undefined, voxels, blockQuadIndexOf(row, col, layer));
        }
    }
    for (const layer of [EVEN_LAYER, ODD_LAYER])
    {
        for (const row of UNIT_ROWS)
            VoxelUpdateUtil.addVoxelBlock(undefined, voxels, blockQuadIndexOf(row, COL, layer));
    }

    // The four quarters of a square of texels, in the order sortedRects gives them.
    function quartersOf(whole: TexelRect): TexelRect[]
    {
        const width = whole.width / 2, height = whole.height / 2;
        return [
            {x: whole.x, y: whole.y, width, height}, {x: whole.x, y: whole.y + height, width, height},
            {x: whole.x + width, y: whole.y, width, height}, {x: whole.x + width, y: whole.y + height, width, height},
        ];
    }
    const sortedRects = (rects: TexelRect[]) => [...rects].sort((a, b) => (a.x - b.x) || (a.y - b.y));

    // As a real VoxelGameObject maps a quad wearing the texture.
    function shownTexels(quadIndex: number, textureIndex: number): TexelRect
    {
        room.voxelQuads[quadIndex] = textureIndex;
        let shown: TexelRect | undefined;
        const gameObject = Object.assign(Object.create(VoxelGameObject.prototype), {
            params: {transform: {pos: {x: 0, y: 0, z: 0}}},
            voxels,
            instancedMeshGraphics: {
                rentInstanceFromPool: () => 0,
                updateInstanceTransform: () => {},
                updateInstanceTextureRect: (_instancedMeshId: string, _instanceId: number,
                    x: number, y: number, width: number, height: number) => { shown = {x, y, width, height}; },
            },
        }) as VoxelGameObject;
        try
        {
            gameObject.updateVoxelQuadInstance(quadIndex);
        }
        finally
        {
            VoxelQuadInstanceUtil.unbind(quadIndex, 0);
        }
        return shown!;
    }

    it("shows the quarter of a pack's own cell a quad lies over, up a wall by the half its layer takes", () => {
        const textureIndex = 45; // column 5 of row 5
        const cellX = 5 * CELL, cellY = 5 * CELL, HALF = CELL / 2;
        // The first voxel of its unit: a floor reads along +x and, up the tile, along -z, and a face on the +x
        // side along -z.
        expect(shownTexels(floorQuad, textureIndex)).toEqual({x: cellX, y: cellY + HALF, width: HALF, height: HALF});
        expect(shownTexels(oddLayerWallQuad, textureIndex))
            .toEqual({x: cellX + HALF, y: cellY, width: HALF, height: HALF});
        expect(shownTexels(evenLayerWallQuad, textureIndex))
            .toEqual({x: cellX + HALF, y: cellY + HALF, width: HALF, height: HALF});
    });

    it("shows a procedural cell inside its margin", () => {
        const textureIndex = NUM_PACK_VOXEL_TEXTURES + 6; // column 6 of the first procedural row
        const tileX = 6 * CELL + MARGIN, tileY = NUM_PACK_VOXEL_TEXTURES / NUM_VOXEL_TEXTURE_COLS * CELL + MARGIN;
        const HALF = TILE / 2;
        expect(shownTexels(floorQuad, textureIndex)).toEqual({x: tileX, y: tileY + HALF, width: HALF, height: HALF});
        expect(shownTexels(oddLayerWallQuad, textureIndex))
            .toEqual({x: tileX + HALF, y: tileY, width: HALF, height: HALF});
        expect(shownTexels(evenLayerWallQuad, textureIndex))
            .toEqual({x: tileX + HALF, y: tileY + HALF, width: HALF, height: HALF});
    });

    it("keeps every texture inside its own cell, the quads over one world unit making up all that tiles of it", () => {
        for (let textureIndex = 0; textureIndex < NUM_VOXEL_TEXTURES; ++textureIndex)
        {
            const cellX = (textureIndex % NUM_VOXEL_TEXTURE_COLS) * CELL;
            const cellY = Math.floor(textureIndex / NUM_VOXEL_TEXTURE_COLS) * CELL;
            const floors = unitFloorQuads.map(quadIndex => shownTexels(quadIndex, textureIndex));
            const walls = unitWallQuads.map(quadIndex => shownTexels(quadIndex, textureIndex));
            for (const rect of [...floors, ...walls])
            {
                expect([rect.x, rect.y, rect.width, rect.height].every(Number.isInteger), `texture ${textureIndex}`)
                    .toBe(true);
                expect(rect.x, `texture ${textureIndex}`).toBeGreaterThanOrEqual(cellX);
                expect(rect.y, `texture ${textureIndex}`).toBeGreaterThanOrEqual(cellY);
                expect(rect.x + rect.width, `texture ${textureIndex}`).toBeLessThanOrEqual(cellX + CELL);
                expect(rect.y + rect.height, `texture ${textureIndex}`).toBeLessThanOrEqual(cellY + CELL);
            }
            expect(cellY + CELL, `texture ${textureIndex}`).toBeLessThanOrEqual(ATLAS_HEIGHT);

            // What tiles: all of a pack's own cell, and what is inside a procedural one's margin. Four floors
            // share it out as its quarters, and so do a wall's faces two along and two up.
            const margin = (textureIndex < NUM_PACK_VOXEL_TEXTURES) ? 0 : MARGIN;
            const quarters = quartersOf({x: cellX + margin, y: cellY + margin,
                width: CELL - 2 * margin, height: CELL - 2 * margin});
            expect(sortedRects(floors), `texture ${textureIndex}`).toEqual(quarters);
            expect(sortedRects(walls), `texture ${textureIndex}`).toEqual(quarters);
        }
    });

    it("shows the faces of blocks side by side the halves of the tile they lie over, whichever way they face", () => {
        const textureIndex = 45; // column 5 of row 5
        const cellX = 5 * CELL, cellY = 5 * CELL, HALF = CELL / 2;
        // The voxels of another world unit, out on the open floor: its two rows and its two cols.
        const LOW_ROW = 20, HIGH_ROW = 21, LOW_COL = 20, HIGH_COL = 21;

        // What a face shows of a block put there alone, on an odd layer (whose walls show the lower half of
        // the tile), so that every side of it is drawn.
        const shownBy = (row: number, col: number, axis: "x" | "y" | "z", orientation: "-" | "+",
            texture: number = textureIndex): TexelRect => {
            const blockQuadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, ODD_LAYER);
            VoxelUpdateUtil.addVoxelBlock(undefined, voxels, blockQuadIndex);
            try
            {
                return shownTexels(VoxelQueryUtil.getVoxelQuadIndex(row, col, axis, orientation, ODD_LAYER), texture);
            }
            finally
            {
                VoxelUpdateUtil.removeVoxelBlock(undefined, voxels, blockQuadIndex);
            }
        };

        // Seen from in front, a face on the +z side reads along +x, and one on the -z side along -x.
        for (const row of [LOW_ROW, HIGH_ROW])
        {
            expect(shownBy(row, LOW_COL, "z", "+")).toEqual({x: cellX, y: cellY, width: HALF, height: HALF});
            expect(shownBy(row, HIGH_COL, "z", "+")).toEqual({x: cellX + HALF, y: cellY, width: HALF, height: HALF});
            expect(shownBy(row, LOW_COL, "z", "-")).toEqual({x: cellX + HALF, y: cellY, width: HALF, height: HALF});
            expect(shownBy(row, HIGH_COL, "z", "-")).toEqual({x: cellX, y: cellY, width: HALF, height: HALF});
        }

        // One on the +x side reads along -z, and one on the -x side along +z.
        for (const col of [LOW_COL, HIGH_COL])
        {
            expect(shownBy(LOW_ROW, col, "x", "+")).toEqual({x: cellX + HALF, y: cellY, width: HALF, height: HALF});
            expect(shownBy(HIGH_ROW, col, "x", "+")).toEqual({x: cellX, y: cellY, width: HALF, height: HALF});
            expect(shownBy(LOW_ROW, col, "x", "-")).toEqual({x: cellX, y: cellY, width: HALF, height: HALF});
            expect(shownBy(HIGH_ROW, col, "x", "-")).toEqual({x: cellX + HALF, y: cellY, width: HALF, height: HALF});
        }

        // A top reads along +x and, up the tile, along -z.
        expect(shownBy(LOW_ROW, LOW_COL, "y", "+")).toEqual({x: cellX, y: cellY + HALF, width: HALF, height: HALF});
        expect(shownBy(LOW_ROW, HIGH_COL, "y", "+"))
            .toEqual({x: cellX + HALF, y: cellY + HALF, width: HALF, height: HALF});
        expect(shownBy(HIGH_ROW, LOW_COL, "y", "+")).toEqual({x: cellX, y: cellY, width: HALF, height: HALF});
        expect(shownBy(HIGH_ROW, HIGH_COL, "y", "+")).toEqual({x: cellX + HALF, y: cellY, width: HALF, height: HALF});

        // A procedural cell is shared out the same way, inside its margin.
        const procedural = NUM_PACK_VOXEL_TEXTURES + 6;
        const tileX = 6 * CELL + MARGIN, tileY = NUM_PACK_VOXEL_TEXTURES / NUM_VOXEL_TEXTURE_COLS * CELL + MARGIN;
        expect(shownBy(LOW_ROW, HIGH_COL, "z", "+", procedural))
            .toEqual({x: tileX + TILE / 2, y: tileY, width: TILE / 2, height: TILE / 2});
    });

    it("samples a rect from the centre of its first texel to the centre of its last, on the atlas's own shape", () => {
        const params = new InstancedTexturePackMaterialParams("atlas", ATLAS_WIDTH, ATLAS_HEIGHT, CELL, CELL,
            "staticImageFromPath");
        const geometry = new THREE.PlaneGeometry();
        geometry.setAttribute("uvStart", new THREE.InstancedBufferAttribute(new Float32Array(2), 2));
        geometry.setAttribute("uvSampleSize", new THREE.InstancedBufferAttribute(new Float32Array(2), 2));
        const binding = new InstancedMeshBinding(params, "Square", 1, false);
        binding.instancedMesh = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial(), 1);

        const rect = shownTexels(evenLayerWallQuad, NUM_VOXEL_TEXTURES - 1);
        binding.updateInstanceTextureRect({params: {objectId: "quad"}} as GameObject, 0,
            rect.x, rect.y, rect.width, rect.height);

        // What the shader samples across the quad (see instancedTexturePackShader), in texels.
        const [uScale, vScale] = getUVScales(ATLAS_WIDTH, ATLAS_HEIGHT, CELL, CELL);
        const start = geometry.getAttribute("uvStart");
        const size = geometry.getAttribute("uvSampleSize");
        expect(start.getX(0) * ATLAS_WIDTH).toBeCloseTo(rect.x + 0.5, 3);
        expect((start.getX(0) + size.getX(0) * uScale) * ATLAS_WIDTH).toBeCloseTo(rect.x + rect.width - 0.5, 3);
        expect(start.getY(0) * ATLAS_HEIGHT).toBeCloseTo(rect.y + 0.5, 3);
        expect((start.getY(0) + size.getY(0) * vScale) * ATLAS_HEIGHT).toBeCloseTo(rect.y + rect.height - 0.5, 3);
    });
});
