import path from "path";
import sharp from "sharp";
import SourceLibrary from "./sourceLibrary";
import RequestError from "./requestError";
import MissingToolsError from "./missingToolsError";
import RgbaImage from "../core/rgbaImage";
import SourceEntry from "../core/sourceEntry";
import SourcePrep from "../core/sourcePrep";
import PrepPreview from "../core/prepPreview";
import ImageProcessingUtil from "../core/imageProcessingUtil";
import Segmenter from "../../imagePrep/node/segmenter";
import MaskFinder from "../../imagePrep/core/maskFinder";
import MaskUtil from "../../imagePrep/core/maskUtil";
import CutoutUtil from "../../imagePrep/core/cutoutUtil";
import PrepRenderUtil from "../../imagePrep/core/prepRenderUtil";

// The picture preparation tool's work directory (see imagePrep/node/main.ts), from the repository's root: its model
// and the masks it found are shared with it.
const PREP_WORK_DIR = "temp/image_prep";
// A preview's images are no longer than this, in pixels.
const PREVIEW_SIDE = 1024;
// Over the source, what a cut-out takes away is tinted this color, this strongly (as the previews tint what a sample
// has removed).
const CUT_AWAY_TINT = [255, 0, 90];
const CUT_AWAY_WEIGHT = 0.55;
// The model and the last result are let go once nothing has been asked for this long.
const IDLE_RELEASE_MS = 5 * 60 * 1000;

type Point = [number, number];
// A result, with the source as the cut-out left it (in the source's own frame) where one was made.
type Prepared = {image: RgbaImage, kept?: RgbaImage, notes: string[]};

// Preprocesses a source of the library into another (see SourcePrep), which is added beside it: the source itself
// stays as it is, since recipes name it by its bytes. One at a time, as each takes the model and seconds of work.
export default class SourcePreprocessor
{
    private readonly library: SourceLibrary;
    private readonly segmenter: Segmenter;
    private readonly standIn?: MaskFinder;
    // The last result, by what was asked: a preview is mostly followed by the same thing added.
    private last?: {key: string, prepared: Prepared};
    private queue: Promise<unknown> = Promise.resolve();
    private idleTimer?: NodeJS.Timeout;

    // findMask stands in for the model that cuts things out (see Segmenter).
    constructor(library: SourceLibrary, repoRoot: string, findMask?: MaskFinder)
    {
        this.library = library;
        this.segmenter = new Segmenter(path.join(repoRoot, PREP_WORK_DIR));
        this.standIn = findMask;
    }

    // Nothing is added to the library. Refused (MissingToolsError) while cutting out would first fetch its model,
    // unless fetchTools allows that.
    async preview(sha1: string, prep: SourcePrep, fetchTools: boolean = false): Promise<PrepPreview>
    {
        const {image, kept, notes} = await this.prepare(sha1, prep, fetchTools);
        const cutAway = (kept != undefined) ? tintCutAway(await this.library.decode(sha1), kept) : undefined;
        return {
            width: image.width,
            height: image.height,
            image: await toDataUrl(image),
            ...((cutAway != undefined) ? {cutAway: await toDataUrl(cutAway)} : {}),
            notes,
        };
    }

    // The result added to the library as a source of its own, named after the one it was made from and what was
    // done, with that one's address, author and license. Refused as preview is.
    async add(sha1: string, prep: SourcePrep, fetchTools: boolean = false): Promise<SourceEntry>
    {
        const {image} = await this.prepare(sha1, prep, fetchTools);
        const source = this.getSource(sha1);
        // Row filtering makes a photo's PNG about a quarter smaller.
        const bytes = await encode(image).png({adaptiveFiltering: true}).toBuffer();
        const steps = [prep.cutOut ? "cut_out" : "", prep.square ? "squared" : "", prep.round ? "rounded" : ""]
            .filter(step => step.length > 0);
        const baseName = `${path.parse(source.fileName).name}_${steps.join("_") || "tidied"}`;
        const taken = this.library.list().map(other => other.fileName);
        let fileName = `${baseName}.png`;
        for (let number = 2; taken.includes(fileName); ++number)
            fileName = `${baseName}_${number}.png`;
        return this.library.add(bytes, fileName,
            {url: source.url, author: source.author, license: source.license, preparedFrom: {sha1, prep}});
    }

    // Lets the model and the last result go (see Segmenter.release).
    async release(): Promise<void>
    {
        clearTimeout(this.idleTimer);
        this.last = undefined;
        await this.segmenter.release();
    }

    private getSource(sha1: string): SourceEntry
    {
        const source = this.library.list().find(other => other.sha1 == sha1);
        if (source == undefined)
            throw new RequestError(`The source ${sha1} is not in the library`);
        return source;
    }

    private prepare(sha1: string, prep: SourcePrep, fetchTools: boolean): Promise<Prepared>
    {
        const run = this.queue.then(() => this.prepareNow(sha1, prep, fetchTools));
        this.queue = run.catch(() => undefined);
        return run;
    }

    private async prepareNow(sha1: string, prep: SourcePrep, fetchTools: boolean): Promise<Prepared>
    {
        const source = this.getSource(sha1);
        if (prep.cutOut == undefined && !prep.tidy && prep.square == undefined && prep.round == undefined)
            throw new RequestError("Nothing is asked of it yet: cut a thing out of it, or reshape it");
        refuseWith(source.fileName, () => PrepRenderUtil.validate({source: source.fileName, ...prep}));
        if (prep.cutOut != undefined && this.standIn == undefined && !fetchTools && !this.segmenter.isInstalled())
            throw new MissingToolsError();

        const key = JSON.stringify([sha1, prep]);
        if (this.last?.key == key)
            return this.last.prepared;
        clearTimeout(this.idleTimer);
        try
        {
            const picture = await this.library.decode(sha1);
            const prepared = await this.render(picture, source.fileName, prep)
                .catch(err => refuseWith(source.fileName, () => { throw err; }));
            this.last = {key, prepared};
            return prepared;
        }
        finally
        {
            // Through the queue, so never while the model is at work.
            this.idleTimer = setTimeout(() => this.queue = this.queue.then(() => this.release()).catch(() => undefined),
                IDLE_RELEASE_MS);
            this.idleTimer.unref();
        }
    }

    // The tool's own steps, in its order (see PrepCommands.run): cut out, tidied, trimmed to what is kept, re-mapped.
    private async render(picture: RgbaImage, fileName: string, prep: SourcePrep): Promise<Prepared>
    {
        const notes: string[] = [];
        let image = picture;
        let kept: RgbaImage | undefined;
        if (prep.cutOut != undefined)
        {
            const cut = await MaskUtil.cutOut(picture, prep.cutOut, this.standIn ?? this.segmenter.findMask);
            image = cut.image;
            notes.push(...cut.notes);
        }
        if (prep.tidy)
        {
            image = ImageProcessingUtil.copyImage(image);
            notes.push(`tidied: ${CutoutUtil.dropStrays(image)} stray pixels dropped`);
        }
        if (prep.cutOut != undefined)
            kept = image;

        // Re-mapping takes its positions on the picture as trimmed, so those given on the source are moved there.
        let frame = {x: 0, y: 0, width: picture.width, height: picture.height};
        if (ImageProcessingUtil.hasTransparency(image))
        {
            const bounds = CutoutUtil.getBounds(image);
            if (bounds == undefined)
                throw new Error("nothing of it is kept");
            frame = bounds;
            image = trim(image, bounds, notes);
        }
        const place = ([x, y]: Point): Point =>
            [(x * picture.width - frame.x) / frame.width, (y * picture.height - frame.y) / frame.height];
        const rendered = PrepRenderUtil.render(image, {
            source: fileName,
            square: prep.square && {...prep.square, corners: prep.square.corners?.map(place),
                circle: prep.square.circle?.map(place)},
            round: prep.round && {...prep.round, outline: prep.round.outline.map(place)},
        });
        notes.push(...rendered.notes);
        image = rendered.image;

        // What re-mapping left see-through around it goes too.
        const bounds = ImageProcessingUtil.hasTransparency(image) ? CutoutUtil.getBounds(image) : undefined;
        return {image: (bounds != undefined) ? trim(image, bounds, notes) : image, kept, notes};
    }
}

// What the tool finds wrong with an order is said to whoever asked, with the source it is wrong for.
function refuseWith<T>(fileName: string, action: () => T): T
{
    try
    {
        return action();
    }
    catch (err)
    {
        throw (err instanceof RequestError) ? err : new RequestError(`${fileName}: ${(err instanceof Error) ? err.message : err}`);
    }
}

// The image cut to the bounds of what it keeps, where those are smaller than it.
function trim(image: RgbaImage, bounds: {x: number, y: number, width: number, height: number}, notes: string[]): RgbaImage
{
    if (bounds.width == image.width && bounds.height == image.height)
        return image;
    notes.push(`trimmed: ${bounds.width}x${bounds.height}`);
    return ImageProcessingUtil.crop(image, bounds.x, bounds.y, bounds.width, bounds.height);
}

// See-through where the cut-out keeps the source, and the tint's color where it takes it away.
function tintCutAway(source: RgbaImage, kept: RgbaImage): RgbaImage
{
    const tint = ImageProcessingUtil.createImage(source.width, source.height);
    for (let index = 0; index < tint.data.length; index += 4)
    {
        tint.data[index] = CUT_AWAY_TINT[0];
        tint.data[index + 1] = CUT_AWAY_TINT[1];
        tint.data[index + 2] = CUT_AWAY_TINT[2];
        tint.data[index + 3] = 255 * CUT_AWAY_WEIGHT * (1 - kept.data[index + 3] / Math.max(1, source.data[index + 3]));
    }
    return tint;
}

async function toDataUrl(image: RgbaImage): Promise<string>
{
    const bytes = await encode(image).resize(PREVIEW_SIDE, PREVIEW_SIDE, {fit: "inside", withoutEnlargement: true})
        .webp({quality: 85, alphaQuality: 100}).toBuffer();
    return `data:image/webp;base64,${bytes.toString("base64")}`;
}

function encode(image: RgbaImage): sharp.Sharp
{
    return sharp(Buffer.from(image.data.buffer, image.data.byteOffset, image.data.length),
        {raw: {width: image.width, height: image.height, channels: 4}});
}
