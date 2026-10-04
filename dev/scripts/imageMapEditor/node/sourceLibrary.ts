import fs from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import EditorPaths from "./editorPaths";
import RequestError from "./requestError";
import RgbaImage from "../core/rgbaImage";
import SourceEntry from "../core/sourceEntry";
import SourceUrlUtil from "../core/sourceUrlUtil";
import { MAX_SOURCE_SIDE } from "../core/sampleRenderUtil";

const INDEX_FILE_NAME = "index.json";
const THUMBNAIL_SIZE = 256;
// Sources kept decoded, the one being edited first; a save renders from it (see EntryStore.saveEntry).
const MAX_DECODED = 2;
const UNSPLASH_LICENSE = "Unsplash License";
// What follows a source's name in the file name of one of its surveys: nothing for the whole of it, or the part's
// x, y, width and height (see getSurveyPath).
const SURVEY_SUFFIX_PATTERN = /^((_\d+\.\d{3}){4})?\.jpg$/;

// The photos entries are sampled from, each stored by the hash of its bytes (which recipes name it by) and listed
// in an index with where it came from. The photos are gitignored and the index is not, so a photo missing on
// another machine can be downloaded again from its address.
export default class SourceLibrary
{
    private readonly paths: EditorPaths;
    private readonly decoded = new Map<string, Promise<RgbaImage>>();

    constructor(paths: EditorPaths)
    {
        this.paths = paths;
    }

    list(): SourceEntry[]
    {
        const indexPath = this.getIndexPath();
        return fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, "utf8")).sources : [];
    }

    // Kept once, however often it is added; what is known of it is filled in from what is given.
    async add(bytes: Buffer, fileName: string,
        known: Pick<SourceEntry, "url" | "author" | "license" | "preparedFrom"> = {}): Promise<SourceEntry>
    {
        const sha1 = crypto.createHash("sha1").update(bytes).digest("hex");
        const metadata = await sharp(bytes).metadata().catch(() => undefined);
        if (metadata?.width == undefined || metadata.height == undefined)
            throw new RequestError(`${fileName} is not an image`);
        const sideways = (metadata.orientation ?? 1) >= 5;

        const filePath = path.join(this.paths.sourcesDir, `${sha1}${path.extname(fileName).toLowerCase() || ".jpg"}`);
        if (this.findFile(sha1) == undefined)
        {
            fs.mkdirSync(this.paths.sourcesDir, {recursive: true});
            fs.writeFileSync(filePath, bytes);
        }
        const sources = this.list();
        const existing = sources.find(source => source.sha1 == sha1);
        const entry: SourceEntry = {
            sha1,
            fileName: existing?.fileName ?? fileName,
            width: sideways ? metadata.height : metadata.width,
            height: sideways ? metadata.width : metadata.height,
            url: existing?.url ?? known.url,
            author: existing?.author || known.author,
            license: existing?.license || known.license,
            addedAt: existing?.addedAt ?? new Date().toISOString(),
            preparedFrom: existing?.preparedFrom ?? known.preparedFrom,
        };
        this.writeIndex([...sources.filter(source => source.sha1 != sha1), entry]);
        return entry;
    }

    // From a photo's page on Unsplash (its author suggested by the file it sends, and its license known), or from
    // an image's own address.
    async addFromUrl(url: string): Promise<SourceEntry>
    {
        let parsed: URL;
        try
        {
            parsed = new URL(url);
        }
        catch
        {
            throw new RequestError(`"${url}" is not an address`);
        }
        if (parsed.protocol != "https:" && parsed.protocol != "http:")
            throw new RequestError(`"${url}" is not a web address`);

        const unsplashId = SourceUrlUtil.getUnsplashId(url);
        const response = await fetch(SourceUrlUtil.getDownloadUrl(url), {redirect: "follow"});
        if (!response.ok)
        {
            throw new RequestError(`Downloading ${url} failed (${response.status})`
                + ((response.status == 403 && unsplashId) ? ", as it does for an Unsplash+ photo" : ""));
        }
        const fileName = (unsplashId != undefined) ? `${unsplashId}.jpg` : (path.basename(parsed.pathname) || "source.jpg");
        return this.add(Buffer.from(await response.arrayBuffer()), fileName, (unsplashId == undefined) ? {url} : {
            url,
            author: SourceUrlUtil.getSuggestedAuthor(response.url, unsplashId),
            license: UNSPLASH_LICENSE,
        });
    }

    // Undefined if it isn't on this machine.
    findFile(sha1: string): string | undefined
    {
        if (!/^[0-9a-f]{40}$/.test(sha1))
            return undefined;
        for (const dir of [this.paths.sourcesDir, this.paths.fallbackSourcesDir])
        {
            if (dir == undefined || !fs.existsSync(dir))
                continue;
            const fileName = fs.readdirSync(dir).find(name => name.startsWith(sha1));
            if (fileName != undefined)
                return path.join(dir, fileName);
        }
        return undefined;
    }

    async getThumbnail(sha1: string): Promise<Buffer | undefined>
    {
        const filePath = this.findFile(sha1);
        if (filePath == undefined)
            return undefined;
        const thumbnailPath = path.join(this.paths.workDir, "source_thumbnails", `${sha1}.webp`);
        if (!fs.existsSync(thumbnailPath))
        {
            fs.mkdirSync(path.dirname(thumbnailPath), {recursive: true});
            await sharp(filePath).rotate().resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {fit: "inside"})
                .webp({quality: 80}).toFile(thumbnailPath);
        }
        return fs.readFileSync(thumbnailPath);
    }

    // Where a survey of it, or of a part of it (in fractions), is drawn (see BatchCommands.writeSurveys): named by its
    // Unsplash id, or else the start of its sha1 (as one preprocessed from a photo is, which has that photo's id).
    getSurveyPath(source: SourceEntry, region: [number, number, number, number]): string
    {
        const name = ((source.url != undefined && source.preparedFrom == undefined)
            ? SourceUrlUtil.getUnsplashId(source.url) : undefined) ?? source.sha1.slice(0, 12);
        const partName = (region[2] < 1 || region[3] < 1) ? `_${region.map(value => value.toFixed(3)).join("_")}` : "";
        return path.join(this.paths.workDir, "survey", `${name}${partName}.jpg`);
    }

    // Refused while an entry is sampled from it. Its thumbnail and surveys go with it, and its decoded copy, which a
    // save would otherwise still render from.
    delete(sha1: string, usedBy: string[]): void
    {
        if (usedBy.length > 0)
            throw new RequestError(`It is the source of ${usedBy.join(", ")}`);
        const source = this.list().find(other => other.sha1 == sha1);
        const filePath = this.findFile(sha1);
        if (filePath != undefined && path.dirname(filePath) == this.paths.sourcesDir)
            fs.rmSync(filePath);
        this.decoded.delete(sha1);
        fs.rmSync(path.join(this.paths.workDir, "source_thumbnails", `${sha1}.webp`), {force: true});
        if (source != undefined)
            this.deleteSurveys(source);
        this.writeIndex(this.list().filter(other => other.sha1 != sha1));
    }

    // Upright (as its EXIF says), at no more than the working size; the last few are kept decoded.
    decode(sha1: string): Promise<RgbaImage>
    {
        let decoding = this.decoded.get(sha1);
        if (decoding == undefined)
        {
            const filePath = this.findFile(sha1);
            if (filePath == undefined)
                return Promise.reject(new RequestError(`The source ${sha1} isn't on this machine`));
            decoding = decodeFile(filePath);
            decoding.catch(() => this.decoded.delete(sha1));
        }
        this.decoded.delete(sha1);
        this.decoded.set(sha1, decoding);
        while (this.decoded.size > MAX_DECODED)
            this.decoded.delete(this.decoded.keys().next().value!);
        return decoding;
    }

    getIndexPath(): string
    {
        return path.join(this.paths.sourcesDir, INDEX_FILE_NAME);
    }

    private deleteSurveys(source: SourceEntry): void
    {
        const whole = this.getSurveyPath(source, [0, 0, 1, 1]);
        const surveyDir = path.dirname(whole);
        const name = path.basename(whole, ".jpg");
        if (!fs.existsSync(surveyDir))
            return;
        for (const fileName of fs.readdirSync(surveyDir))
        {
            if (fileName.startsWith(name) && SURVEY_SUFFIX_PATTERN.test(fileName.substring(name.length)))
                fs.rmSync(path.join(surveyDir, fileName));
        }
    }

    // One source per line, by file name, so adding one is one line of the diff.
    private writeIndex(sources: SourceEntry[]): void
    {
        const sorted = [...sources].sort((a, b) => a.fileName.localeCompare(b.fileName) || a.sha1.localeCompare(b.sha1));
        const lines = sorted.map(source => `        ${JSON.stringify(source)}`);
        fs.mkdirSync(this.paths.sourcesDir, {recursive: true});
        fs.writeFileSync(this.getIndexPath(), `{\n    "sources": [\n${lines.join(",\n")}\n    ]\n}\n`);
    }
}

async function decodeFile(filePath: string): Promise<RgbaImage>
{
    const {data, info} = await sharp(filePath).rotate()
        .resize(MAX_SOURCE_SIDE, MAX_SOURCE_SIDE, {fit: "inside", withoutEnlargement: true})
        .ensureAlpha().raw().toBuffer({resolveWithObject: true});
    return {width: info.width, height: info.height,
        data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length)};
}
