import fs from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import EntryStore from "./entryStore";
import SampleRenderUtil from "../core/sampleRenderUtil";
import EntryPathUtil from "../core/entryPathUtil";
import { PICTURE_ATLAS_CELL_SIZE, PICTURE_ATLAS_CELL_WORLD_SIZE,
    PICTURE_ATLAS_MAX_REGION_CELLS } from "../../../../src/shared/system/sharedConstants";

// Contact sheet layout, in pixels: a cell holds the largest image that keeps its scale at its own pixels.
const SHEET_COLUMNS = 6;
const SHEET_CELL = PICTURE_ATLAS_MAX_REGION_CELLS * PICTURE_ATLAS_CELL_SIZE + 16;
const SHEET_LABEL_HEIGHT = 36;
const SHEET_HEADER_HEIGHT = 40;
const SHEET_CHECKER = 12;

// The editor's commands over many entries at once, run without the page (see main.ts).
const RenderCommands =
{
    // Each entry's sample made again from its recipe and source (downloaded again from where the entry says it
    // came from, if it isn't on this machine), and its game image from that. Every entry, if none are named.
    renderSamples: async (store: EntryStore, entryPaths?: string[]): Promise<void> =>
    {
        const state = store.readState();
        for (const entryPath of entryPaths ?? Object.keys(state.recipeFile.recipes))
        {
            const recipe = state.recipeFile.recipes[entryPath];
            const entry = state.entries.find(other => other.path == entryPath);
            if (recipe == undefined || entry == undefined)
                throw new Error(`"${entryPath}" is not an entry with a recipe`);

            const samplePath = store.getSamplePath(entryPath);
            const sampleBytes = fs.existsSync(samplePath) ? fs.readFileSync(samplePath) : undefined;
            // An entry taken in as its own image (see EntryStore.adoptUnsampledEntries) has it as its sample too.
            if (store.library.findFile(recipe.sourceSha1) == undefined && sampleBytes != undefined
                && crypto.createHash("sha1").update(sampleBytes).digest("hex") == recipe.sourceSha1)
            {
                await store.library.add(sampleBytes, recipe.sourceFileName,
                    {url: entry.source, author: entry.author || undefined, license: entry.license});
            }
            else if (store.library.findFile(recipe.sourceSha1) == undefined)
            {
                if (!entry.source)
                    throw new Error(`The source of "${entryPath}" isn't on this machine, and the entry doesn't say where it came from`);
                const downloaded = await store.library.addFromUrl(entry.source);
                if (downloaded.sha1 != recipe.sourceSha1)
                    throw new Error(`${entryPath}: ${entry.source} is no longer the file the recipe was made from`);
            }
            const sample = SampleRenderUtil.renderSample(await store.library.decode(recipe.sourceSha1), recipe);
            await store.writeImages(entryPath, sample, recipe, entry.disabled === true);
            console.log(`${entryPath} ${entry.title}: sample ${sample.width}x${sample.height}`);
        }
    },

    // Every game image made again from its full-resolution sample (e.g. at a new atlas density).
    renderGameImages: async (store: EntryStore): Promise<void> =>
    {
        const state = store.readState();
        for (const entry of state.entries)
        {
            const samplePath = store.getSamplePath(entry.path);
            if (!fs.existsSync(samplePath))
                throw new Error(`${entry.path} has no sample: make it again from its recipe with --render-samples`);
            await store.writeImages(entry.path, fs.readFileSync(samplePath), state.recipeFile.recipes[entry.path],
                entry.disabled === true);
            console.log(`${entry.path} ${entry.title}`);
        }
    },

    // Every entry named, or in a subfolder named (all, if none are), on a checkerboard, so cut-outs show, labeled with its
    // path, title and size in cells. An image that keeps its scale is drawn at its own pixels, so all of them share
    // the scale bar at the top; any other is fitted to its cell. Returns where it was written.
    writeContactSheet: async (store: EntryStore, subfoldersOrPaths?: string[]): Promise<string> =>
    {
        const state = store.readState();
        const entries = state.entries.filter(entry => subfoldersOrPaths == undefined
            || subfoldersOrPaths.includes(EntryPathUtil.getSubfolder(entry.path)) || subfoldersOrPaths.includes(entry.path));
        const rows = Math.max(1, Math.ceil(entries.length / SHEET_COLUMNS));
        const sheetWidth = SHEET_COLUMNS * SHEET_CELL;
        const sheetHeight = SHEET_HEADER_HEIGHT + rows * (SHEET_CELL + SHEET_LABEL_HEIGHT);

        const checker = Buffer.alloc(sheetWidth * sheetHeight * 3);
        for (let y = 0; y < sheetHeight; ++y)
        {
            for (let x = 0; x < sheetWidth; ++x)
            {
                const light = (Math.floor(x / SHEET_CHECKER) + Math.floor(y / SHEET_CHECKER)) % 2 == 0;
                checker.fill(light ? 200 : 150, (y * sheetWidth + x) * 3, (y * sheetWidth + x) * 3 + 3);
            }
        }

        const unitPixels = PICTURE_ATLAS_CELL_SIZE / PICTURE_ATLAS_CELL_WORLD_SIZE;
        const header = `<svg width="${sheetWidth}" height="${SHEET_HEADER_HEIGHT}"><rect width="100%" height="100%" fill="#222"/>`
            + `<rect x="8" y="14" width="${unitPixels}" height="12" fill="#ffd21f"/>`
            + `<text x="${unitPixels + 18}" y="25" font-family="sans-serif" font-size="14" fill="#fff">1 unit (a prop's `
            + `largest image); paintings are fitted to their cells</text></svg>`;
        const composites: sharp.OverlayOptions[] = [{input: Buffer.from(header), left: 0, top: 0}];
        for (let i = 0; i < entries.length; ++i)
        {
            const entry = entries[i];
            const left = (i % SHEET_COLUMNS) * SHEET_CELL;
            const top = SHEET_HEADER_HEIGHT + Math.floor(i / SHEET_COLUMNS) * (SHEET_CELL + SHEET_LABEL_HEIGHT);
            const imagePath = store.findGameImage(entry.path);
            if (imagePath != undefined)
            {
                const thumbnail = await sharp(imagePath).resize(SHEET_CELL - 16, SHEET_CELL - 16,
                    {fit: "inside", withoutEnlargement: entry.preserveScale === true}).png().toBuffer();
                const {width, height} = await sharp(thumbnail).metadata();
                composites.push({input: thumbnail, left: left + Math.floor((SHEET_CELL - width!) / 2),
                    top: top + Math.floor((SHEET_CELL - height!) / 2)});
            }

            const output = state.recipeFile.recipes[entry.path]?.output;
            const size = output?.preserveScale ? ` (${output.numCols}x${output.numRows})` : "";
            const label = `${entry.path} ${entry.title}${size}${entry.disabled ? " (disabled)" : ""}`;
            const svg = `<svg width="${SHEET_CELL}" height="${SHEET_LABEL_HEIGHT}"><rect width="100%" height="100%" fill="#222"/>`
                + `<text x="6" y="23" font-family="sans-serif" font-size="14" fill="#fff">${escapeXml(label)}</text></svg>`;
            composites.push({input: Buffer.from(svg), left, top: top + SHEET_CELL});
        }

        const sheetPath = path.join(store.paths.workDir, "contact_sheet.png");
        fs.mkdirSync(store.paths.workDir, {recursive: true});
        await sharp(checker, {raw: {width: sheetWidth, height: sheetHeight, channels: 3}})
            .composite(composites).png().toFile(sheetPath);
        return sheetPath;
    },
}

function escapeXml(text: string): string
{
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default RenderCommands;
