import fs from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import Upscaler from "./upscaler";
import Segmenter from "./segmenter";
import RgbaImage from "../../imageMapEditor/core/rgbaImage";
import ImageProcessingUtil from "../../imageMapEditor/core/imageProcessingUtil";
import { MAX_SOURCE_SIDE } from "../../imageMapEditor/core/sampleRenderUtil";
import PrepOrder from "../core/prepOrder";
import PrepCutOut from "../core/prepCutOut";
import PrepRenderUtil, { MAX_RESULT_SIDE } from "../core/prepRenderUtil";
import CutoutUtil from "../core/cutoutUtil";
import MaskUtil from "../core/maskUtil";
import MaskFinder from "../core/maskFinder";
import { PICTURE_ATLAS_CELL_SIZE, PICTURE_ATLAS_MAX_REGION_CELLS } from "../../../../src/shared/system/sharedConstants";

const SURVEY_LONG_SIDE = 1600;
const SURVEY_STEPS = [0.002, 0.005, 0.01, 0.02, 0.05];
// Behind a survey's see-through parts, so they are told from the object's white or black ones.
const SURVEY_BACKDROP = "#c040c0";
// On a cut-out's survey: how far what was cut away is tinted toward the backdrop, the room shown around the cut-out
// and its marks (a share of the picture), and the marks' colors for a part kept and one dropped.
const CUT_AWAY_TINT = 0.6;
const CUT_OUT_SURVEY_MARGIN = 0.03;
const KEPT_MARK = "#40ff70";
const DROPPED_MARK = "#ff5040";

// Contact sheet layout, in pixels: each picture is fitted into the largest image a prop shows, then drawn at twice
// that, pixel for pixel, so what the game would show of it can be judged.
const SHEET_FIT = PICTURE_ATLAS_MAX_REGION_CELLS * PICTURE_ATLAS_CELL_SIZE;
const SHEET_ZOOM = 2;
const SHEET_CELL = SHEET_FIT * SHEET_ZOOM + 16;
const SHEET_ORDERS_PER_ROW = 2;
const SHEET_LABEL_HEIGHT = 36;
const SHEET_HEADER_HEIGHT = 40;
const SHEET_CHECKER = 12;

// The cells a picture's brightness is read out in, across and down.
const SHADE_COLUMNS = 16;
const SHADE_ROWS = 12;

// In the work directory: each result's file name with the hash of what was last written under it (see run).
const LEDGER_FILE = "written.json";
// Once a result is fitted to its size, a cut-out's colors are carried this far under its transparency, in pixels
// (past what the next thing to sample it takes in around a pixel), from every pixel at least this opaque: a fainter
// one comes out of the resize with a color that is mostly noise.
const FIT_CARRY_REACH = 4;
const FIT_SOLID_ALPHA = 16;

// The commands that prepare pictures for use as flat ones (see .claude/skills/image-upscale-remap): any picture
// drawn with a grid to plan by or read out in numbers, and a plan of orders carried out. Everything written goes
// under the work directory.
const PrepCommands =
{
    // Each picture named (or part of it, as writeSurveys takes them) read out as a table of how bright each cell of
    // a grid over it is, from 0 to 255: what a survey can't show of a pale or even surface, such as how far a soft
    // shadow reaches or how two stretches differ. A cell wholly see-through reads "-". Returns the lines printed.
    printShades: async (repoRoot: string, names: string[]): Promise<string[]> =>
    {
        const lines: string[] = [];
        for (const name of names)
        {
            const [file, [rx, ry, rw, rh]] = splitRegion(name);
            const filePath = path.resolve(repoRoot, file);
            if (!fs.existsSync(filePath))
                throw new Error(`${file} is not a file`);
            const image = await readPicture(filePath);
            const columnAt = (i: number) => rx + rw * (i + 0.5) / SHADE_COLUMNS;
            lines.push(`${file}: ${image.width}x${image.height}, brightness of ${SHADE_COLUMNS} x ${SHADE_ROWS} cells`,
                "      x " + Array.from({length: SHADE_COLUMNS}, (_, i) => columnAt(i).toFixed(3).padStart(6)).join(""));
            for (let row = 0; row < SHADE_ROWS; ++row)
            {
                const top = Math.floor((ry + rh * row / SHADE_ROWS) * image.height);
                const bottom = Math.max(top + 1, Math.floor((ry + rh * (row + 1) / SHADE_ROWS) * image.height));
                let line = `y ${(ry + rh * (row + 0.5) / SHADE_ROWS).toFixed(3)} `;
                for (let column = 0; column < SHADE_COLUMNS; ++column)
                {
                    const left = Math.floor((rx + rw * column / SHADE_COLUMNS) * image.width);
                    const right = Math.max(left + 1, Math.floor((rx + rw * (column + 1) / SHADE_COLUMNS) * image.width));
                    let sum = 0, weight = 0;
                    for (let y = top; y < Math.min(bottom, image.height); ++y)
                    {
                        for (let x = left; x < Math.min(right, image.width); ++x)
                        {
                            const index = (y * image.width + x) * 4;
                            const [r, g, b, alpha] = image.data.subarray(index, index + 4);
                            sum += alpha * (0.299 * r + 0.587 * g + 0.114 * b);
                            weight += alpha;
                        }
                    }
                    line += ((weight > 0) ? (sum / weight).toFixed(0) : "-").padStart(6);
                }
                lines.push(line);
            }
        }
        console.log(lines.join("\n"));
        return lines;
    },

    // Each picture named ("<file>", or "<file>:x,y,w,h" for a part of it, in fractions) drawn with a grid labeled in
    // fractions of the whole picture, as orders place things (and as BatchCommands.writeSurveys draws a source).
    // Returns the files written.
    writeSurveys: async (repoRoot: string, workDir: string, names: string[]): Promise<string[]> =>
    {
        const written: string[] = [];
        for (const name of names)
        {
            const [file, [rx, ry, rw, rh]] = splitRegion(name);
            const filePath = path.resolve(repoRoot, file);
            if (!fs.existsSync(filePath))
                throw new Error(`${file} is not a file`);
            const image = await readPicture(filePath);
            const partName = (rw < 1 || rh < 1) ? `_${[rx, ry, rw, rh].map(value => value.toFixed(3)).join("_")}` : "";
            const outPath = path.join(workDir, "survey", `${getSurveyName(repoRoot, filePath)}${partName}.jpg`);
            await drawSurvey(image, [rx, ry, rw, rh], outPath);
            console.log(`${path.relative(repoRoot, outPath)}: ${image.width}x${image.height}`);
            written.push(outPath);
        }
        return written;
    },

    // Every order of the plan (a JSON array of PrepOrder) carried out: the result fitted within its largest size and
    // written as <name>.png, what was found on the way printed, a cut-out drawn over its source as a survey, and all
    // of them drawn beside their sources on a contact sheet. Refused, before anything is written, if a result would
    // replace a file this tool didn't write, or one changed since. findMask stands in for the model that cuts things
    // out (see Segmenter). Returns the results' files.
    run: async (repoRoot: string, workDir: string, planPath: string, findMask?: MaskFinder): Promise<string[]> =>
    {
        const orders = JSON.parse(fs.readFileSync(planPath, "utf8")) as PrepOrder[];
        if (!Array.isArray(orders))
            throw new Error(`${planPath} is not a list of orders`);
        const names = orders.map(order => order.name
            ?? path.basename(String(order.source ?? ""), path.extname(String(order.source ?? ""))));
        orders.forEach((order, i) => check(names[i], () => PrepRenderUtil.validate(order)));
        const repeated = names.find((name, i) => names.indexOf(name) != i);
        if (repeated != undefined)
            throw new Error(`Two orders would both be written as "${repeated}": give one a name of its own`);

        const upscaler = new Upscaler(workDir);
        const segmenter = new Segmenter(workDir);
        const outDir = path.join(workDir, "out");
        fs.mkdirSync(outDir, {recursive: true});
        // Finished pictures are kept in the results' folder by hand as well, so a file there is only replaced if it
        // is still the result this tool last wrote under that name.
        const ledgerPath = path.join(workDir, LEDGER_FILE);
        const ledger: {[fileName: string]: string} = fs.existsSync(ledgerPath)
            ? JSON.parse(fs.readFileSync(ledgerPath, "utf8")) : {};
        for (const name of names)
        {
            const outPath = path.join(outDir, `${name}.png`);
            if (fs.existsSync(outPath) && ledger[`${name}.png`] != getHash(fs.readFileSync(outPath)))
            {
                throw new Error(`"${name}": ${path.relative(repoRoot, outPath)} is there already, and not as this tool `
                    + "wrote it: give the order another name");
            }
        }
        const written: string[] = [];
        const pairs: {name: string, before: RgbaImage, after: RgbaImage}[] = [];
        try
        {
            for (let i = 0; i < orders.length; ++i)
            {
                const order = orders[i];
                const sourcePath = path.resolve(repoRoot, order.source);
                if (!fs.existsSync(sourcePath))
                    throw new Error(`"${names[i]}": ${order.source} is not a file`);
                const before = await readPicture(sourcePath);
                const lines = [`${names[i]}: ${order.source}, ${before.width}x${before.height}`];

                let picture = before;
                if (order.cutOut != undefined)
                {
                    const cut = await MaskUtil.cutOut(picture, order.cutOut, findMask ?? segmenter.findMask)
                        .catch(err => check(names[i], () => { throw err; }));
                    picture = cut.image;
                    const [surveyPath, wholePath] = await writeCutOutSurvey(workDir, names[i], before, picture, order.cutOut);
                    lines.push(...cut.notes.map(note => `  ${note}`),
                        `  cut out: drawn over its source in ${path.relative(repoRoot, surveyPath)}`
                        + ` (to survey up close: ${path.relative(repoRoot, wholePath)})`);
                }
                if (order.tidy)
                {
                    picture = ImageProcessingUtil.copyImage(picture);
                    lines.push(`  tidied: ${CutoutUtil.dropStrays(picture)} stray pixels dropped`);
                }
                if (order.cutOut != undefined)
                {
                    const {x: left, y: top, width, height} = CutoutUtil.getBounds(picture)!;
                    picture = await decode(encode(picture).extract({left, top, width, height}));
                    lines.push(`  trimmed: ${width}x${height}`);
                }
                if (order.upscale)
                {
                    picture = await upscaler.upscale(picture);
                    lines.push(`  upscaled: ${picture.width}x${picture.height}`);
                }
                const {image: rendered, notes} = check(names[i], () => PrepRenderUtil.render(picture, order));
                lines.push(...notes.map(note => `  ${note}`));
                const maxSide = order.maxSide ?? MAX_RESULT_SIDE;
                const after = await fitWithin(rendered, maxSide);
                if (after != rendered)
                    lines.push(`  fitted: ${rendered.width}x${rendered.height} within ${maxSide} px`);

                const outPath = path.join(outDir, `${names[i]}.png`);
                // Row filtering makes a photo's PNG about a quarter smaller.
                const bytes = await encode(after).png({adaptiveFiltering: true}).toBuffer();
                fs.writeFileSync(outPath, bytes);
                ledger[`${names[i]}.png`] = getHash(bytes);
                fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + "\n");
                lines.push(`  -> ${path.relative(repoRoot, outPath)}, ${after.width}x${after.height}`);
                console.log(lines.join("\n"));
                written.push(outPath);
                pairs.push({name: names[i], before, after});
            }
        }
        finally
        {
            await segmenter.release();
        }
        const sheetPath = await writeContactSheet(workDir, pairs);
        console.log(`Contact sheet: ${path.relative(repoRoot, sheetPath)}`);
        return written;
    },
}

// The part of the picture (x, y, width and height, in fractions of it) drawn at a size to plan by under a grid
// labeled in fractions of the whole picture, with the marks given (as SVG, placed by the picture's fractions) over it.
async function drawSurvey(image: RgbaImage, [rx, ry, rw, rh]: number[], outPath: string,
    getMarks: (place: (x: number, y: number) => [number, number]) => string = () => ""): Promise<void>
{
    const left = Math.round(rx * image.width), top = Math.round(ry * image.height);
    const width = Math.max(1, Math.min(image.width - left, Math.round(rw * image.width)));
    const height = Math.max(1, Math.min(image.height - top, Math.round(rh * image.height)));
    const scale = SURVEY_LONG_SIDE / Math.max(width, height);
    const outWidth = Math.round(width * scale), outHeight = Math.round(height * scale);

    // A line every step (about a tenth of the part shown), labeled every other one.
    const step = SURVEY_STEPS.find(candidate => candidate >= Math.max(rw, rh) / 20) ?? SURVEY_STEPS.at(-1)!;
    const decimals = Math.max(1, Math.ceil(-Math.log10(2 * step) - 1e-9));
    let lines = "";
    const drawLines = (from: number, extent: number, pixels: number, vertical: boolean) => {
        for (let i = Math.ceil(from / step + 1e-9); i * step < from + extent - 1e-9; ++i)
        {
            const at = (i * step - from) / extent * pixels;
            const major = i % 2 == 0;
            const stroke = major ? "rgba(255,255,0,0.75)" : "rgba(0,255,255,0.45)";
            lines += vertical
                ? `<line x1="${at}" y1="0" x2="${at}" y2="${outHeight}" stroke="${stroke}" stroke-width="${major ? 1.5 : 1}"/>`
                : `<line x1="0" y1="${at}" x2="${outWidth}" y2="${at}" stroke="${stroke}" stroke-width="${major ? 1.5 : 1}"/>`;
            if (major)
            {
                const label = (i * step).toFixed(decimals);
                lines += `<text x="${vertical ? at + 3 : 3}" y="${vertical ? 16 : at - 4}" font-size="15" `
                    + `font-family="sans-serif" fill="#ff0" stroke="#000" stroke-width="3" paint-order="stroke">${label}</text>`;
            }
        }
    };
    drawLines(rx, rw, outWidth, true);
    drawLines(ry, rh, outHeight, false);
    const marks = getMarks((x, y) => [(x - rx) / rw * outWidth, (y - ry) / rh * outHeight]);
    const svg = `<svg width="${outWidth}" height="${outHeight}" xmlns="http://www.w3.org/2000/svg">${lines}${marks}</svg>`;

    fs.mkdirSync(path.dirname(outPath), {recursive: true});
    await encode(image)
        .extract({left, top, width, height})
        .resize(outWidth, outHeight, {fit: "fill"})
        .flatten({background: SURVEY_BACKDROP})
        .composite([{input: Buffer.from(svg)}])
        .jpeg({quality: 82})
        .toFile(outPath);
}

// A cut-out drawn over its source, to place the next try's rects and points by: the source with what was cut away
// tinted the backdrop's color, whole (a picture to survey parts of up close) and as a survey of what was kept, with
// each part's marks numbered (its rect dashed, a dot for a point on the thing, a cross for one off it). Returns the
// two files written, the survey first.
async function writeCutOutSurvey(workDir: string, name: string, source: RgbaImage, cutOut: RgbaImage,
    parts: PrepCutOut[]): Promise<[string, string]>
{
    const kept = CutoutUtil.getBounds(cutOut)!;
    const across = [kept.x / source.width, (kept.x + kept.width) / source.width];
    const down = [kept.y / source.height, (kept.y + kept.height) / source.height];
    for (const part of parts)
    {
        const corners: [number, number][] = (part.rect == undefined) ? []
            : [[part.rect[0], part.rect[1]], [part.rect[0] + part.rect[2], part.rect[1] + part.rect[3]]];
        for (const [x, y] of [...(part.on ?? []), ...(part.off ?? []), ...corners])
        {
            across.push(x);
            down.push(y);
        }
    }
    const x0 = Math.max(0, Math.min(...across) - CUT_OUT_SURVEY_MARGIN), x1 = Math.min(1, Math.max(...across) + CUT_OUT_SURVEY_MARGIN);
    const y0 = Math.max(0, Math.min(...down) - CUT_OUT_SURVEY_MARGIN), y1 = Math.min(1, Math.max(...down) + CUT_OUT_SURVEY_MARGIN);

    const backdrop = [1, 3, 5].map(at => parseInt(SURVEY_BACKDROP.slice(at, at + 2), 16));
    const tinted = ImageProcessingUtil.copyImage(source);
    for (let p = 0; p < source.width * source.height; ++p)
    {
        const tint = CUT_AWAY_TINT * (1 - cutOut.data[p * 4 + 3] / Math.max(1, source.data[p * 4 + 3]));
        for (let channel = 0; channel < 3; ++channel)
            tinted.data[p * 4 + channel] += (backdrop[channel] - tinted.data[p * 4 + channel]) * tint;
    }

    const wholePath = path.join(workDir, "cut_out", `${name}.jpg`);
    fs.mkdirSync(path.dirname(wholePath), {recursive: true});
    await encode(tinted).flatten({background: SURVEY_BACKDROP}).jpeg({quality: 85}).toFile(wholePath);

    const outPath = path.join(workDir, "survey", `${name}_cut_out.jpg`);
    await drawSurvey(tinted, [x0, y0, x1 - x0, y1 - y0], outPath, place => parts.map((part, i) => {
        const color = part.drop ? DROPPED_MARK : KEPT_MARK;
        const label = ([x, y]: [number, number]) => `<text x="${x + 9}" y="${y - 7}" font-size="15" `
            + `font-family="sans-serif" fill="${color}" stroke="#000" stroke-width="3" paint-order="stroke">${i + 1}</text>`;
        let marks = "";
        if (part.rect != undefined)
        {
            const [x, y] = place(part.rect[0], part.rect[1]);
            const [right, bottom] = place(part.rect[0] + part.rect[2], part.rect[1] + part.rect[3]);
            marks += `<rect x="${x}" y="${y}" width="${right - x}" height="${bottom - y}" fill="none" stroke="${color}" `
                + `stroke-width="2" stroke-dasharray="9 6"/>${label([x - 6, y + 4])}`;
        }
        for (const point of part.on ?? [])
        {
            const [x, y] = place(point[0], point[1]);
            marks += `<circle cx="${x}" cy="${y}" r="6" fill="${color}" stroke="#000" stroke-width="2"/>${label([x, y])}`;
        }
        for (const point of part.off ?? [])
        {
            const [x, y] = place(point[0], point[1]);
            const cross = `d="M${x - 6} ${y - 6}L${x + 6} ${y + 6}M${x - 6} ${y + 6}L${x + 6} ${y - 6}" stroke-linecap="round"`;
            marks += `<path ${cross} stroke="#000" stroke-width="6"/><path ${cross} stroke="${color}" stroke-width="3"/>`
                + label([x, y]);
        }
        return marks;
    }).join(""));
    return [outPath, wholePath];
}

// Each order's source and result side by side on a checkerboard, so what is see-through shows.
async function writeContactSheet(workDir: string,
    pairs: {name: string, before: RgbaImage, after: RgbaImage}[]): Promise<string>
{
    const columns = 2 * SHEET_ORDERS_PER_ROW;
    const rows = Math.max(1, Math.ceil(pairs.length / SHEET_ORDERS_PER_ROW));
    const sheetWidth = columns * SHEET_CELL;
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

    const header = `<svg width="${sheetWidth}" height="${SHEET_HEADER_HEIGHT}"><rect width="100%" height="100%" fill="#222"/>`
        + `<text x="8" y="25" font-family="sans-serif" font-size="14" fill="#fff">Each source, then its result: fitted into `
        + `${SHEET_FIT} px (a prop's largest image) and drawn ${SHEET_ZOOM}x, pixel for pixel</text></svg>`;
    const composites: sharp.OverlayOptions[] = [{input: Buffer.from(header), left: 0, top: 0}];
    const cells = pairs.flatMap(pair => [
        {image: pair.before, label: `${pair.name}: source, ${pair.before.width}x${pair.before.height}`},
        {image: pair.after, label: `${pair.name}: result, ${pair.after.width}x${pair.after.height}`},
    ]);
    for (let i = 0; i < cells.length; ++i)
    {
        const left = (i % columns) * SHEET_CELL;
        const top = SHEET_HEADER_HEIGHT + Math.floor(i / columns) * (SHEET_CELL + SHEET_LABEL_HEIGHT);
        const fitted = await encode(cells[i].image)
            .resize(SHEET_FIT, SHEET_FIT, {fit: "inside", withoutEnlargement: true, kernel: "lanczos3"}).png().toBuffer();
        const {width, height} = await sharp(fitted).metadata();
        const drawnWidth = width! * SHEET_ZOOM, drawnHeight = height! * SHEET_ZOOM;
        const drawn = await sharp(fitted).resize(drawnWidth, drawnHeight, {kernel: "nearest"}).png().toBuffer();
        composites.push({input: drawn, left: left + Math.floor((SHEET_CELL - drawnWidth) / 2),
            top: top + Math.floor((SHEET_CELL - drawnHeight) / 2)});
        const label = `<svg width="${SHEET_CELL}" height="${SHEET_LABEL_HEIGHT}"><rect width="100%" height="100%" fill="#222"/>`
            + `<text x="6" y="23" font-family="sans-serif" font-size="14" fill="#fff">${escapeXml(cells[i].label)}</text></svg>`;
        composites.push({input: Buffer.from(label), left, top: top + SHEET_CELL});
    }

    const sheetPath = path.join(workDir, "contact_sheet.png");
    fs.mkdirSync(workDir, {recursive: true});
    await sharp(checker, {raw: {width: sheetWidth, height: sheetHeight, channels: 3}})
        .composite(composites).png().toFile(sheetPath);
    return sheetPath;
}

// Upright (as its EXIF says), at no more than the size the image map editor works a source at.
async function readPicture(filePath: string): Promise<RgbaImage>
{
    return decode(sharp(filePath).rotate()
        .resize(MAX_SOURCE_SIDE, MAX_SOURCE_SIDE, {fit: "inside", withoutEnlargement: true}));
}

// The image with no side longer than maxSide, its shape kept. The resize weighs colors by opacity and leaves
// nothing under a cut-out's transparency, so the object's colors are carried there again (see
// CutoutUtil.carryColors).
async function fitWithin(image: RgbaImage, maxSide: number): Promise<RgbaImage>
{
    if (Math.max(image.width, image.height) <= maxSide)
        return image;
    const fitted = await decode(encode(image).resize(maxSide, maxSide, {fit: "inside", kernel: "lanczos3"}));
    CutoutUtil.carryColors(fitted, FIT_CARRY_REACH, FIT_SOLID_ALPHA);
    return fitted;
}

async function decode(picture: sharp.Sharp): Promise<RgbaImage>
{
    const {data, info} = await picture.ensureAlpha().raw().toBuffer({resolveWithObject: true});
    return {width: info.width, height: info.height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length)};
}

function encode(image: RgbaImage): sharp.Sharp
{
    return sharp(Buffer.from(image.data.buffer, image.data.byteOffset, image.data.length),
        {raw: {width: image.width, height: image.height, channels: 4}});
}

function getHash(bytes: Buffer): string
{
    return crypto.createHash("sha1").update(bytes).digest("hex");
}

// What went wrong, with the order it went wrong in.
function check<T>(name: string, action: () => T): T
{
    try
    {
        return action();
    }
    catch (err)
    {
        throw new Error(`"${name}": ${(err instanceof Error) ? err.message : err}`);
    }
}

// A survey is named by its picture's path, so a result's doesn't replace its source's.
function getSurveyName(repoRoot: string, filePath: string): string
{
    const relative = path.relative(repoRoot, filePath);
    return relative.slice(0, relative.length - path.extname(relative).length).replace(/[^\w.-]+/g, "_").replace(/^_+/, "");
}

function splitRegion(name: string): [string, [number, number, number, number]]
{
    const match = /^(.*):(-?[\d.]+),(-?[\d.]+),([\d.]+),([\d.]+)$/.exec(name);
    if (match == null)
        return [name, [0, 0, 1, 1]];
    const region = match.slice(2).map(Number) as [number, number, number, number];
    if (region[0] < 0 || region[1] < 0 || region[2] <= 0 || region[3] <= 0
        || region[0] + region[2] > 1.0001 || region[1] + region[3] > 1.0001)
        throw new Error(`${name}: the part x,y,w,h must lie within the picture, in fractions`);
    return [match[1], region];
}

function escapeXml(text: string): string
{
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default PrepCommands;
