import { execFile } from "child_process";
import { promisify } from "util";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { STATIC_PAGE_ROOT_DIR } from "../../system/serverConstants";
import CompositionThumbnailUtil from "../../../shared/graphics/mesh/composition/util/compositionThumbnailUtil";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import PreEncodedCompositions from "../types/preEncodedCompositions";

const ASSETS_ROOT_PATH = `${STATIC_PAGE_ROOT_DIR}/app/assets`;
const WORK_DIR = "temp/composition_thumbnail"; // gitignored
const RENDERER_WEBPACK_CONFIG = "dev/config/webpack.config.compositionThumbnail.js";
const FINGERPRINTS_FILE_NAME = "fingerprints.json";

// SwiftShader renders on the CPU, so every machine produces the same pixels and the committed atlases
// change only when the look does.
const BROWSER_ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"];

const execFileAsync = promisify(execFile);

// Draws each object type's pre-encoded compositions (see CompositionThumbnailUtil for the layout) by
// running the game's own materials in a headless browser (see compositionThumbnailRenderer.ts).
// Unless alwaysRebuild, a type whose compositions are unchanged since its last atlas is skipped; shader
// changes therefore show up on the next full SSG run.
export default class CompositionThumbnailBuilder
{
    private readonly compositions: PreEncodedCompositions;
    private readonly alwaysRebuild: boolean;

    constructor(compositions: PreEncodedCompositions, alwaysRebuild: boolean)
    {
        this.compositions = compositions;
        this.alwaysRebuild = alwaysRebuild;
    }

    async build(): Promise<void>
    {
        const fingerprints = await readFingerprints();
        const staleObjectTypes: string[] = [];
        for (const objectType of Object.keys(this.compositions.indicesByObjectType))
        {
            if (this.alwaysRebuild || fingerprints[objectType] !== this.getFingerprint(objectType)
                || !(await fileExists(getAtlasFilePath(objectType))))
                staleObjectTypes.push(objectType);
        }
        if (staleObjectTypes.length == 0)
            return;

        const rendererBundlePath = await bundleRenderer();

        const { chromium } = await import("@playwright/test");
        let browser;
        try
        {
            browser = await chromium.launch({ args: BROWSER_ARGS });
        }
        catch (err)
        {
            throw new Error(`Composition thumbnail generation failed :: Could not launch Chromium (try "npx playwright install chromium"): ${err}`);
        }

        try
        {
            const page = await browser.newPage();
            // three.js reports shader compile failures only through the console.
            const pageErrors: string[] = [];
            page.on("console", (message) => { if (message.type() === "error") pageErrors.push(message.text()); });
            page.on("pageerror", (error) => pageErrors.push(error.message));
            await page.setContent("<!DOCTYPE html><html><body></body></html>");
            await page.addScriptTag({ path: rendererBundlePath });

            for (const objectType of staleObjectTypes)
            {
                const encodedCompositions = this.compositions.indicesByObjectType[objectType]
                    .map(index => this.compositions.encodedStrings[index]);
                const pixelsList: string[] = await page.evaluate(
                    (args) => (globalThis as any).renderCompositionThumbnails(args.encodedCompositions, args.cellSize, args.view),
                    { encodedCompositions, cellSize: CompositionThumbnailUtil.getCellSize(), view: getView(objectType) });
                if (pageErrors.length > 0)
                    throw new Error(`Composition thumbnail generation failed :: The renderer reported errors (objectType = ${objectType}):\n${pageErrors.join("\n")}`);

                await writeAtlas(objectType, pixelsList);
                fingerprints[objectType] = this.getFingerprint(objectType);
            }
        }
        finally
        {
            await browser.close();
        }

        await fs.writeFile(getWorkFilePath(FINGERPRINTS_FILE_NAME), JSON.stringify(fingerprints, null, 4));
    }

    private getFingerprint(objectType: string): string
    {
        const encodedCompositions = this.compositions.indicesByObjectType[objectType]
            .map(index => this.compositions.encodedStrings[index]);
        return crypto.createHash("sha256")
            .update(JSON.stringify({encodedCompositions, cellSize: CompositionThumbnailUtil.getCellSize(),
                view: getView(objectType)}))
            .digest("hex");
    }
}

function getView(objectType: string): {yawDeg: number, pitchDeg: number}
{
    return CompositionThumbnailUtil.getView(
        ObjectTypeConfigMap.getConfigByIndex(ObjectTypeConfigMap.getIndexByType(objectType)));
}

async function bundleRenderer(): Promise<string>
{
    const root = process.env.PWD as string;
    try
    {
        await execFileAsync(path.join(root, "node_modules/.bin/webpack"),
            ["--config", path.join(root, RENDERER_WEBPACK_CONFIG)],
            { cwd: root, maxBuffer: 16 * 1024 * 1024 });
    }
    catch (err)
    {
        throw new Error(`Composition thumbnail generation failed :: Could not bundle the renderer: ${err}`);
    }
    return getWorkFilePath("bundle.js");
}

// Cells arrive supersampled and bottom row first (see compositionThumbnailRenderer.ts).
async function writeAtlas(objectType: string, pixelsList: string[]): Promise<void>
{
    const cellSize = CompositionThumbnailUtil.getCellSize();
    const composites: sharp.OverlayOptions[] = [];
    for (let position = 0; position < pixelsList.length; ++position)
    {
        const pixels = Buffer.from(pixelsList[position], "base64");
        const renderSize = Math.round(Math.sqrt(pixels.length / 4));
        const cellImage = await sharp(pixels, { raw: { width: renderSize, height: renderSize, channels: 4 } })
            .flip()
            .resize(cellSize, cellSize)
            .png()
            .toBuffer();
        const cell = CompositionThumbnailUtil.getCell(position);
        composites.push({ input: cellImage, left: cell.col * cellSize, top: cell.row * cellSize });
    }

    const atlas = sharp({ create: {
        width: CompositionThumbnailUtil.getNumCols(pixelsList.length) * cellSize,
        height: CompositionThumbnailUtil.getNumRows(pixelsList.length) * cellSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
    }}).composite(composites).webp({ lossless: true }); // lossy blocks notch the frames' thin edges

    const atlasFilePath = getAtlasFilePath(objectType);
    await fs.mkdir(path.dirname(atlasFilePath), { recursive: true });
    await atlas.toFile(atlasFilePath);
}

async function readFingerprints(): Promise<{[objectType: string]: string}>
{
    try
    {
        return JSON.parse(await fs.readFile(getWorkFilePath(FINGERPRINTS_FILE_NAME), "utf8"));
    }
    catch
    {
        await fs.mkdir(getWorkFilePath(""), { recursive: true });
        return {};
    }
}

async function fileExists(filePath: string): Promise<boolean>
{
    try
    {
        await fs.access(filePath);
        return true;
    }
    catch
    {
        return false;
    }
}

function getAtlasFilePath(objectType: string): string
{
    return path.join(process.env.PWD as string, ASSETS_ROOT_PATH, CompositionThumbnailUtil.getAtlasPath(objectType));
}

function getWorkFilePath(fileName: string): string
{
    return path.join(process.env.PWD as string, WORK_DIR, fileName);
}
