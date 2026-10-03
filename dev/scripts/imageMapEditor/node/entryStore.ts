import fs from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import EditorPaths from "./editorPaths";
import ConflictError from "./conflictError";
import RequestError from "./requestError";
import EditorState from "../core/editorState";
import ImageEntry from "../core/imageEntry";
import RecipeFile from "../core/recipeFile";
import SaveEntryRequest from "../core/saveEntryRequest";
import EntryPathUtil from "../core/entryPathUtil";
import IMAGE_LICENSES from "../core/imageLicenses";
import ImageRecipe from "../core/imageRecipe";
import RgbaImage from "../core/rgbaImage";
import SampleRenderUtil from "../core/sampleRenderUtil";
import ImageProcessingUtil from "../core/imageProcessingUtil";
import SourceLibrary from "./sourceLibrary";
import { PICTURE_ATLAS_CELL_SIZE, PICTURE_SEARCH_FILLER_WORDS } from "../../../../src/shared/system/sharedConstants";
import ImageMapSubfolderTab from "../../../../src/shared/graphics/image/types/imageMapSubfolderTab";
import ImageMap from "../../../../src/shared/graphics/image/types/imageMap";

const GAME_IMAGE_QUALITY = 80;
const SAMPLE_QUALITY = 90;
const THUMBNAIL_SUFFIX = ".thumbnail";

// The notices' table of third-party pictures lies between these; the rest of the file is left alone.
const NOTICES_BEGIN = "<!-- pictures:begin (written by the image map editor) -->";
const NOTICES_END = "<!-- pictures:end -->";

// The map's files: its manifest, the game images and full-resolution samples, the editor's recipes, and the
// notices' table of whose images they are. Every change is checked against the state it was based on. A disabled
// entry's game image is parked outside the map's root, so nothing of it ships.
export default class EntryStore
{
    readonly paths: EditorPaths;
    readonly library: SourceLibrary;

    constructor(paths: EditorPaths)
    {
        this.paths = paths;
        this.library = new SourceLibrary(paths);
    }

    readState(): EditorState
    {
        const manifestText = fs.readFileSync(this.getManifestPath(), "utf8");
        const manifest = JSON.parse(manifestText) as {subfolders?: ImageMapSubfolderTab[], images: ImageEntry[]};
        const recipesText = fs.existsSync(this.paths.recipesPath) ? fs.readFileSync(this.paths.recipesPath, "utf8") : "";
        const recipeFile: RecipeFile = recipesText ? JSON.parse(recipesText) : {retiredPaths: [], recipes: {}};
        return {
            subfolders: manifest.subfolders ?? [],
            entries: manifest.images,
            recipeFile,
            hash: crypto.createHash("sha1").update(manifestText).update("\n").update(recipesText).digest("hex"),
            sources: this.library.list(),
            manifestPath: getDisplayPath(this.paths.repoRoot, this.getManifestPath()),
        };
    }

    // Returns the entry's path, which is new for a new entry.
    async saveEntry(request: SaveEntryRequest): Promise<string>
    {
        const state = this.readState();
        if (state.hash != request.baseHash)
            throw new ConflictError(state);
        validateFields(request.fields);

        const existing = (request.path != undefined) ? state.entries.find(entry => entry.path == request.path) : undefined;
        if (request.path != undefined && existing == undefined)
            throw new RequestError(`No entry has the path "${request.path}"`);
        if (request.path == undefined && !state.subfolders.some(subfolder => subfolder.name == request.subfolder))
            throw new RequestError(`No subfolder is named "${request.subfolder}"`);
        const entryPath = request.path
            ?? EntryPathUtil.getNextPath(request.subfolder, state.entries, state.recipeFile.retiredPaths);

        const disabled = request.fields.disabled === true;
        if (request.recipe != undefined)
        {
            const source = await this.library.decode(request.recipe.sourceSha1);
            await this.writeImages(entryPath, SampleRenderUtil.renderSample(source, request.recipe), request.recipe,
                disabled);
        }
        else if (existing == undefined)
        {
            throw new RequestError("A new entry needs a sample");
        }
        else if ((existing.disabled === true) != disabled)
        {
            this.moveGameImage(entryPath, disabled);
        }

        const preserveScale = request.recipe?.output.preserveScale ?? existing?.preserveScale;
        const keywords = putCategoriesFirst(normalizeKeywords(request.fields.keywords ?? ""));
        const entry: ImageEntry = {
            path: entryPath,
            author: request.fields.author.trim(),
            title: request.fields.title.trim(),
            ...(keywords ? {keywords} : {}),
            ...(preserveScale ? {preserveScale: true} : {}),
            ...(request.fields.license ? {source: request.fields.source!.trim(), license: request.fields.license} : {}),
            ...(disabled ? {disabled: true} : {}),
            ...(request.fields.staging === true ? {staging: true} : {}),
        };
        const entries = existing
            ? state.entries.map(other => (other.path == entryPath) ? entry : other)
            : [...state.entries, entry];
        const recipeFile = state.recipeFile;
        if (request.recipe != undefined)
            recipeFile.recipes[entryPath] = request.recipe;

        this.writeManifest(state.subfolders, entries);
        this.writeRecipes(recipeFile);
        this.writeNotices(entries);
        return entryPath;
    }

    // Its number is retired, so the path never names another image.
    deleteEntry(entryPath: string, baseHash: string): void
    {
        const state = this.readState();
        if (state.hash != baseHash)
            throw new ConflictError(state);
        if (!state.entries.some(entry => entry.path == entryPath))
            throw new RequestError(`No entry has the path "${entryPath}"`);

        for (const file of [this.getGameImagePath(entryPath, false), this.getGameImagePath(entryPath, true),
            this.getThumbnailPath(entryPath), this.getSamplePath(entryPath)])
            fs.rmSync(file, {force: true});
        const entries = state.entries.filter(entry => entry.path != entryPath);
        const recipeFile = state.recipeFile;
        delete recipeFile.recipes[entryPath];
        recipeFile.retiredPaths = [...recipeFile.retiredPaths, entryPath];

        this.writeManifest(state.subfolders, entries);
        this.writeRecipes(recipeFile);
        this.writeNotices(entries);
    }

    // Every entry is edited from a recipe, so one without (the paintings, or one added to the manifest by hand) is
    // taken in as the whole of its own image: that image becomes its source and its sample, unchanged, so nothing
    // that ships is made again. Returns the paths taken in.
    async adoptUnsampledEntries(): Promise<string[]>
    {
        const state = this.readState();
        const adopted: string[] = [];
        for (const entry of state.entries)
        {
            if (state.recipeFile.recipes[entry.path] != undefined)
                continue;
            const imagePath = this.findGameImage(entry.path);
            if (imagePath == undefined)
                throw new Error(`${entry.path} has neither a recipe nor a game image`);
            const source = await this.library.add(fs.readFileSync(imagePath), `${entry.path.replace("/", "_")}.webp`,
                {url: entry.source, author: entry.author || undefined, license: entry.license});
            fs.mkdirSync(path.dirname(this.getSamplePath(entry.path)), {recursive: true});
            fs.copyFileSync(imagePath, this.getSamplePath(entry.path));
            state.recipeFile.recipes[entry.path] = {
                sourceSha1: source.sha1,
                sourceFileName: source.fileName,
                corners: [[0, 0], [1, 0], [1, 1], [0, 1]],
                retouches: [],
                output: entry.preserveScale
                    ? {preserveScale: true, numCols: Math.round(source.width / PICTURE_ATLAS_CELL_SIZE),
                        numRows: Math.round(source.height / PICTURE_ATLAS_CELL_SIZE)}
                    : {preserveScale: false, longSide: Math.max(source.width, source.height)},
            };
            adopted.push(entry.path);
        }
        if (adopted.length > 0)
            this.writeRecipes(state.recipeFile);
        return adopted;
    }

    // The manifest, recipes and notices written again as the editor writes them, e.g. after a hand edit.
    rewriteFiles(): void
    {
        const state = this.readState();
        this.writeManifest(state.subfolders, state.entries);
        this.writeRecipes(state.recipeFile);
        this.writeNotices(state.entries);
    }

    // The sample (a saved one, or one just rendered), and the game image made from it (see
    // SampleRenderUtil.getGameImageLayout), parked if the entry is disabled. Either keeps its alpha only when some
    // of it is see-through.
    async writeImages(entryPath: string, sampleInput: Buffer | RgbaImage, recipe: ImageRecipe,
        disabled: boolean): Promise<void>
    {
        const sample: RgbaImage = Buffer.isBuffer(sampleInput) ? await decodeRaw(sharp(sampleInput)) : sampleInput;
        const raw = {width: sample.width, height: sample.height, channels: 4 as const};
        const encode = (image: RgbaImage, quality: number) => {
            const encoder = sharp(Buffer.from(image.data.buffer, image.data.byteOffset, image.data.length),
                {raw: {width: image.width, height: image.height, channels: 4}});
            return ImageProcessingUtil.hasTransparency(image)
                ? encoder.webp({quality, alphaQuality: 100}) : encoder.removeAlpha().webp({quality});
        };

        const layout = SampleRenderUtil.getGameImageLayout(recipe.output, sample.width, sample.height,
            PICTURE_ATLAS_CELL_SIZE);
        const content = await decodeRaw(sharp(Buffer.from(sample.data.buffer, sample.data.byteOffset, sample.data.length),
            {raw}).resize(layout.content.width, layout.content.height, {fit: "fill", kernel: "lanczos3"}));
        const gameImage = SampleRenderUtil.finishGameImage(content, layout, ImageProcessingUtil.getMarginColor(sample),
            recipe);

        const gameImagePath = this.getGameImagePath(entryPath, disabled);
        fs.mkdirSync(path.dirname(this.getSamplePath(entryPath)), {recursive: true});
        fs.mkdirSync(path.dirname(gameImagePath), {recursive: true});
        await Promise.all([
            encode(sample, SAMPLE_QUALITY).toFile(this.getSamplePath(entryPath)),
            encode(gameImage, GAME_IMAGE_QUALITY).toFile(gameImagePath),
        ]);
        if (disabled)
            this.removeShippedFiles(entryPath);
        else
            fs.rmSync(this.getGameImagePath(entryPath, true), {force: true});
    }

    // Where an entry's game image is kept: in the map's root, or parked while the entry is disabled.
    getGameImagePath(entryPath: string, disabled: boolean): string
    {
        return path.join(disabled ? this.paths.disabledImagesDir : this.paths.imagesDir, `${entryPath}.webp`);
    }

    // Wherever the entry's game image is, if anywhere.
    findGameImage(entryPath: string): string | undefined
    {
        return [false, true].map(disabled => this.getGameImagePath(entryPath, disabled)).find(file => fs.existsSync(file));
    }

    getSamplePath(entryPath: string): string
    {
        return path.join(this.paths.samplesDir, `${entryPath}.webp`);
    }

    private getThumbnailPath(entryPath: string): string
    {
        return path.join(this.paths.imagesDir, `${entryPath}${THUMBNAIL_SUFFIX}.webp`);
    }

    // Parks the game image of an entry being disabled, or puts it back. Its thumbnail goes with it; the map's
    // rebuild makes one again.
    private moveGameImage(entryPath: string, disabled: boolean): void
    {
        const from = this.getGameImagePath(entryPath, !disabled);
        const to = this.getGameImagePath(entryPath, disabled);
        if (fs.existsSync(from))
        {
            fs.mkdirSync(path.dirname(to), {recursive: true});
            fs.renameSync(from, to);
        }
        if (disabled)
            this.removeShippedFiles(entryPath);
    }

    private removeShippedFiles(entryPath: string): void
    {
        fs.rmSync(this.getGameImagePath(entryPath, false), {force: true});
        fs.rmSync(this.getThumbnailPath(entryPath), {force: true});
    }

    private getManifestPath(): string
    {
        return path.join(this.paths.imagesDir, "manifest.json");
    }

    // One image per line, so a change to one is one line of the diff.
    private writeManifest(subfolders: ImageMapSubfolderTab[], entries: ImageEntry[]): void
    {
        const lines = ["{"];
        if (subfolders.length > 0)
        {
            lines.push(`    "subfolders": [`);
            lines.push(subfolders.map(subfolder => {
                const categories = subfolder.categories?.map(category =>
                    `{"name": ${JSON.stringify(category.name)}, "title": ${JSON.stringify(category.title)}}`);
                return `        {"name": ${JSON.stringify(subfolder.name)}, "title": ${JSON.stringify(subfolder.title)}`
                    + (categories ? `, "categories": [${categories.join(", ")}]` : "") + "}";
            }).join(",\n"));
            lines.push(`    ],`);
        }
        lines.push(`    "images": [`);
        lines.push(entries.map(entry => {
            const fields = [`"path": ${JSON.stringify(entry.path)}`, `"author": ${JSON.stringify(entry.author)}`,
                `"title": ${JSON.stringify(entry.title)}`];
            if (entry.keywords)
                fields.push(`"keywords": ${JSON.stringify(entry.keywords)}`);
            if (entry.preserveScale)
                fields.push(`"preserveScale": true`);
            if (entry.source)
                fields.push(`"source": ${JSON.stringify(entry.source)}`, `"license": ${JSON.stringify(entry.license)}`);
            if (entry.disabled)
                fields.push(`"disabled": true`);
            if (entry.staging)
                fields.push(`"staging": true`);
            return `        {${fields.join(", ")}}`;
        }).join(",\n"));
        lines.push(`    ]`);
        lines.push("}");
        fs.writeFileSync(this.getManifestPath(), lines.join("\n") + "\n");
    }

    private writeRecipes(recipeFile: RecipeFile): void
    {
        fs.mkdirSync(path.dirname(this.paths.recipesPath), {recursive: true});
        const recipes = Object.fromEntries(Object.entries(recipeFile.recipes).sort(([a], [b]) => comparePaths(a, b)));
        fs.writeFileSync(this.paths.recipesPath,
            JSON.stringify({retiredPaths: recipeFile.retiredPaths, recipes}, null, 4) + "\n");
    }

    // A row for every third party's image that ships (not a disabled one), naming its author, source and terms.
    private writeNotices(entries: ImageEntry[]): void
    {
        const text = fs.readFileSync(this.paths.noticesPath, "utf8");
        const begin = text.indexOf(NOTICES_BEGIN);
        const end = text.indexOf(NOTICES_END);
        if (begin < 0 || end < begin)
            throw new Error(`${this.paths.noticesPath} has no table of pictures between "${NOTICES_BEGIN}" and "${NOTICES_END}"`);

        const rows = entries.filter(entry => entry.source && !entry.disabled).map(entry =>
            `| \`${entry.path}.webp\` | ${escapeCell(entry.title)} | ${escapeCell(entry.author)} `
            + `| [${escapeCell(getSourceName(entry.source!))}](${entry.source}) | ${escapeCell(entry.license ?? "")} |`);
        const table = ["| File | Title | Author | Source | License |", "|---|---|---|---|---|", ...rows].join("\n");
        fs.writeFileSync(this.paths.noticesPath,
            text.substring(0, begin + NOTICES_BEGIN.length) + "\n" + table + "\n" + text.substring(end));
    }
}

// A third party's image names where it came from and one of the licenses on offer; with neither, it is
// original artwork.
function validateFields(fields: SaveEntryRequest["fields"]): void
{
    if (fields.title.trim().length == 0)
        throw new RequestError("An entry needs a title");
    if (!fields.license && fields.source?.trim())
        throw new RequestError("An image from elsewhere needs its license, or it can't be used");
    if (fields.license && !IMAGE_LICENSES.includes(fields.license))
        throw new RequestError(`"${fields.license}" is not a license on offer: ${IMAGE_LICENSES.join(", ")}`);
    if (fields.license && !fields.source?.trim())
        throw new RequestError("An image under a third party's license needs the address it came from");
    if (fields.disabled && fields.staging)
        throw new RequestError("An entry is either disabled or staging, not both");
}

// Lowercase single words, leaving out filler words (which a search passes over) and any found inside another: a
// search finds each word typed anywhere in them, so "bell pepper, pepper" finds just what "bell, pepper" does.
// Spaced for reading (the builder packs them tighter).
function normalizeKeywords(keywords: string): string
{
    const words = [...new Set(keywords.toLowerCase().split(/[\s,]+/)
        .filter(word => word.length > 0 && !PICTURE_SEARCH_FILLER_WORDS.includes(word)))];
    return words.filter(word => !words.some(other => other != word && other.includes(word))).join(", ");
}

// The words marked as categories first, as typed, then the rest (see ImageMetadata.keywords).
function putCategoriesFirst(keywords: string): string
{
    const words = keywords.split(", ").filter(word => word.length > 0);
    const named = words.filter(word => word.endsWith(ImageMap.CATEGORY_MARK));
    return [...named, ...words.filter(word => !named.includes(word))].join(", ");
}

// A photo's id on Unsplash, whose page URLs end in it; the site's name otherwise.
function getSourceName(source: string): string
{
    try
    {
        const url = new URL(source);
        if (url.hostname.endsWith("unsplash.com"))
            return url.pathname.slice(-11);
        return url.hostname;
    }
    catch
    {
        return source;
    }
}

async function decodeRaw(image: sharp.Sharp): Promise<RgbaImage>
{
    const {data, info} = await image.ensureAlpha().raw().toBuffer({resolveWithObject: true});
    return {width: info.width, height: info.height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length)};
}

// Relative to the repository when inside it.
function getDisplayPath(repoRoot: string, filePath: string): string
{
    const relativePath = path.relative(repoRoot, filePath);
    return relativePath.startsWith("..") ? filePath : relativePath;
}

function escapeCell(text: string): string
{
    return text.replace(/\|/g, "\\|");
}

// By subfolder, then by number.
function comparePaths(a: string, b: string): number
{
    const [folderA, numberA] = a.split("/");
    const [folderB, numberB] = b.split("/");
    return (folderA == folderB) ? parseInt(numberA) - parseInt(numberB) : folderA.localeCompare(folderB);
}
