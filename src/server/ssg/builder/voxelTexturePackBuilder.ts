import fs from "fs/promises";
import sharp from "sharp";
import FileUtil from "../util/fileUtil";
import ImageFileUtil from "../util/imageFileUtil";
import ProceduralTextureUtil from "../util/proceduralTextureUtil";
import { ImageMapSeeds } from "../data/imageMapSeeds";
import { ProceduralVoxelTextures } from "../data/proceduralVoxelTextures";
import { STATIC_PAGE_ROOT_DIR } from "../../system/serverConstants";
import { NUM_PACK_VOXEL_TEXTURES, NUM_VOXEL_TEXTURES, NUM_VOXEL_TEXTURE_COLS, NUM_VOXEL_TEXTURE_ROWS,
    PROCEDURAL_VOXEL_TEXTURE_MARGIN, VOXEL_TEXTURE_CELL_SIZE } from "../../../shared/system/sharedConstants";

// Near what the packs' own images were encoded at: their cells lose the least to being encoded again there, and
// take no more bytes than they did.
const WEBP_QUALITY = 82;

const SEED = ImageMapSeeds.VoxelTexturePackImageMap;
const ROOT_PATH = `${STATIC_PAGE_ROOT_DIR}/app/assets/${SEED.rootDirName}`;

const ATLAS_WIDTH = NUM_VOXEL_TEXTURE_COLS * VOXEL_TEXTURE_CELL_SIZE;
const NUM_PROCEDURAL_ROWS = NUM_VOXEL_TEXTURE_ROWS - NUM_PACK_VOXEL_TEXTURES / NUM_VOXEL_TEXTURE_COLS;
const PROCEDURAL_HEIGHT = NUM_PROCEDURAL_ROWS * VOXEL_TEXTURE_CELL_SIZE;
const PACK_HEIGHT = NUM_VOXEL_TEXTURE_ROWS * VOXEL_TEXTURE_CELL_SIZE - PROCEDURAL_HEIGHT;

// How many rows of the margin under the lowest procedural cells hold the pack's edge instead (see buildAtlas);
// the rest of that margin still keeps the pack's color from what those cells show.
const PACK_EDGE_ROWS = PROCEDURAL_VOXEL_TEXTURE_MARGIN / 2;

// Writes each voxel texture pack's atlas as the game loads it: the pack's own image, which is left as it is, under
// the rows of procedural cells every pack shares. Runs before the packs' image map is built, which is made of
// these files.
// Unless alwaysRebuild, the rows are drawn only while their image is missing, and an atlas is built only when it
// is older than what it is made of (encoding the atlases is nearly all the work); a change to how either is made
// therefore shows up on the next full SSG run.
export default class VoxelTexturePackBuilder
{
    // The procedural cells every pack shares, as an image of their own beside the packs: the rows an atlas has
    // above its pack's. Lossless, so what is attached to an atlas is exactly what was drawn.
    static readonly PROCEDURAL_ROWS_FILE_NAME = "augmentation.webp";

    private readonly alwaysRebuild: boolean;

    constructor(alwaysRebuild: boolean)
    {
        this.alwaysRebuild = alwaysRebuild;
    }

    async build(): Promise<void>
    {
        if (ProceduralVoxelTextures.length != NUM_VOXEL_TEXTURES - NUM_PACK_VOXEL_TEXTURES)
            throw new Error(`Voxel texture pack generation failed :: ${ProceduralVoxelTextures.length} procedural textures are listed, and the atlas has ${NUM_VOXEL_TEXTURES - NUM_PACK_VOXEL_TEXTURES} cells past a pack's own`);

        const manifest = JSON.parse(await FileUtil.read("manifest.json", ROOT_PATH)) as {images: {path: string}[]};
        if (this.alwaysRebuild || !(await hasProceduralRows()))
            await this.writeProceduralRows();

        const rowsTime = await getModifiedTime(VoxelTexturePackBuilder.PROCEDURAL_ROWS_FILE_NAME);
        const stalePaths: string[] = [];
        for (const image of manifest.images)
        {
            const atlasTime = await getModifiedTime(getAtlasFileName(image.path));
            const packTime = await getModifiedTime(`${image.path}.webp`);
            // A missing pack image is left to buildAtlas to report.
            if (this.alwaysRebuild || atlasTime == undefined || packTime == undefined || rowsTime == undefined
                || atlasTime < packTime || atlasTime < rowsTime)
                stalePaths.push(image.path);
        }
        if (stalePaths.length == 0)
            return;

        const proceduralRows = await readProceduralRows();
        for (const path of stalePaths)
            await this.buildAtlas(path, proceduralRows);
    }

    // The first row of textures is the lowest, as texture indices count rows from the atlas's bottom.
    private async writeProceduralRows(): Promise<void>
    {
        const cellSize = VOXEL_TEXTURE_CELL_SIZE;
        const pixels = Buffer.alloc(ATLAS_WIDTH * PROCEDURAL_HEIGHT * 3);
        ProceduralVoxelTextures.forEach((spec, index) =>
        {
            const cell = ProceduralTextureUtil.generateCell(spec, cellSize, PROCEDURAL_VOXEL_TEXTURE_MARGIN, index);
            const left = (index % NUM_VOXEL_TEXTURE_COLS) * cellSize;
            const top = (NUM_PROCEDURAL_ROWS - 1 - Math.floor(index / NUM_VOXEL_TEXTURE_COLS)) * cellSize;
            for (let y = 0; y < cellSize; ++y)
            {
                pixels.set(cell.subarray(y * cellSize * 3, (y + 1) * cellSize * 3),
                    ((top + y) * ATLAS_WIDTH + left) * 3);
            }
        });

        const image = sharp(pixels, {raw: {width: ATLAS_WIDTH, height: PROCEDURAL_HEIGHT, channels: 3}})
            .webp({lossless: true});
        await ImageFileUtil.writeImage(VoxelTexturePackBuilder.PROCEDURAL_ROWS_FILE_NAME, image, ROOT_PATH);
    }

    private async buildAtlas(path: string, proceduralRows: Buffer): Promise<void>
    {
        const packImage = ImageFileUtil.readImage(`${path}.webp`, ROOT_PATH);
        const metadata = await packImage?.metadata();
        if (!packImage || metadata?.width != ATLAS_WIDTH || metadata?.height != PACK_HEIGHT)
            throw new Error(`Voxel texture pack generation failed :: "${path}.webp" is ${metadata?.width}x${metadata?.height}, and a pack's own cells take ${ATLAS_WIDTH}x${PACK_HEIGHT}`);

        // The pack's top line of pixels, repeated just above it: the pack's top cells have nothing over them in its
        // own image, and the atlas's lossy color would otherwise bleed down into their upper edge.
        const packTopLine = await packImage.clone().removeAlpha()
            .extract({left: 0, top: 0, width: ATLAS_WIDTH, height: 1}).raw().toBuffer();
        const rowsAbovePack = Buffer.from(proceduralRows);
        for (let row = PROCEDURAL_HEIGHT - PACK_EDGE_ROWS; row < PROCEDURAL_HEIGHT; ++row)
            rowsAbovePack.set(packTopLine, row * ATLAS_WIDTH * 3);

        const atlas = packImage
            .extend({top: PROCEDURAL_HEIGHT, background: {r: 0, g: 0, b: 0}})
            .composite([{input: rowsAbovePack, left: 0, top: 0,
                raw: {width: ATLAS_WIDTH, height: PROCEDURAL_HEIGHT, channels: 3}}])
            // Sharp chroma, since a cell's color must hold right up to the next cell's.
            .webp({quality: WEBP_QUALITY, smartSubsample: true});
        await ImageFileUtil.writeImage(getAtlasFileName(path), atlas, ROOT_PATH);
    }
}

function getAtlasFileName(path: string): string
{
    return `${path}${SEED.augmentedPathSuffix}.webp`;
}

// The bytes of the rows' image, or undefined if there is none. sharp is given these rather than the path: it keeps
// what it loaded from a path, and would hand back the image that was there before the rows were drawn again.
async function readProceduralRowsFile(): Promise<Buffer | undefined>
{
    try
    {
        return await fs.readFile(
            FileUtil.getAbsoluteFilePath(VoxelTexturePackBuilder.PROCEDURAL_ROWS_FILE_NAME, ROOT_PATH));
    }
    catch
    {
        return undefined;
    }
}

// Whether the rows' image is there, at the size the rows take now.
async function hasProceduralRows(): Promise<boolean>
{
    const file = await readProceduralRowsFile();
    if (!file)
        return false;
    const metadata = await sharp(file).metadata().catch(() => undefined);
    return metadata?.width == ATLAS_WIDTH && metadata?.height == PROCEDURAL_HEIGHT;
}

// Raw RGB, rows from the top.
async function readProceduralRows(): Promise<Buffer>
{
    const file = await readProceduralRowsFile();
    if (!file)
        throw new Error(`Voxel texture pack generation failed :: Failed to read the procedural rows (${ROOT_PATH}/${VoxelTexturePackBuilder.PROCEDURAL_ROWS_FILE_NAME})`);
    return await sharp(file).removeAlpha().raw().toBuffer();
}

// When a file under the packs' directory was last written, or undefined if there is none.
async function getModifiedTime(fileName: string): Promise<number | undefined>
{
    try
    {
        return (await fs.stat(FileUtil.getAbsoluteFilePath(fileName, ROOT_PATH))).mtimeMs;
    }
    catch
    {
        return undefined;
    }
}
