import fs from "fs";
import path from "path";
import sharp from "sharp";
import EntryStore from "./entryStore";
import SampleOrder from "../core/sampleOrder";
import SampleOrderUtil from "../core/sampleOrderUtil";
import SourceEntry from "../core/sourceEntry";
import SourceUrlUtil from "../core/sourceUrlUtil";

// Unsplash refuses downloads (429) after a run of them, so they are spaced out, and a refusal waited out a little
// longer each time.
const DOWNLOAD_INTERVAL_MS = 8000;
const RATE_LIMIT_WAIT_MS = 60000;
const MAX_DOWNLOAD_ATTEMPTS = 6;

const SURVEY_LONG_SIDE = 1600;
const SURVEY_STEPS = [0.002, 0.005, 0.01, 0.02, 0.05];

// The editor's commands for sampling many photos at once (see .claude/skills/image-map-sampling): photos added to
// the library by their addresses, drawn with a grid to plan samples by, and the planned samples saved as entries,
// each disabled until it is reviewed.
const BatchCommands =
{
    addSources: async (store: EntryStore, urls: string[]): Promise<void> =>
    {
        const failed: string[] = [];
        let downloaded = false;
        for (const url of urls)
        {
            const known = findSource(store.library.list(), url);
            if (known != undefined)
            {
                console.log(`${url}: already in the library (${known.sha1.slice(0, 8)})`);
                continue;
            }
            for (let attempt = 1; ; ++attempt)
            {
                if (downloaded)
                    await wait(DOWNLOAD_INTERVAL_MS);
                downloaded = true;
                try
                {
                    const added = await store.library.addFromUrl(url);
                    console.log(`${url}: added ${added.sha1.slice(0, 8)}, ${added.width}x${added.height}, `
                        + `by ${added.author ?? "(unknown)"}`);
                    break;
                }
                catch (err)
                {
                    const message = (err instanceof Error) ? err.message : String(err);
                    if (message.includes("(429)") && attempt < MAX_DOWNLOAD_ATTEMPTS)
                    {
                        console.log(`${url}: refused for now (429), trying again in ${attempt * RATE_LIMIT_WAIT_MS / 1000}s`);
                        await wait(attempt * RATE_LIMIT_WAIT_MS);
                        continue;
                    }
                    console.log(`${url}: FAILED, ${message}`);
                    failed.push(url);
                    break;
                }
            }
        }
        if (failed.length > 0)
            console.log(`${failed.length} not added:\n${failed.join("\n")}`);
    },

    // Each source named ("<source>", or "<source>:x,y,w,h" for a part of it, in fractions) drawn with a grid
    // labeled in fractions of the source, as recipes and sample orders place things; every source no entry is
    // sampled from yet, if none are named. Returns the files written.
    writeSurveys: async (store: EntryStore, names?: string[]): Promise<string[]> =>
    {
        const sources = store.library.list();
        const recipes = Object.values(store.readState().recipeFile.recipes);
        const requests = (names != undefined)
            ? names.map(name => {
                const [key, region] = splitRegion(name);
                const source = findSource(sources, key);
                if (source == undefined)
                    throw new Error(`"${key}" is not in the library`);
                return {source, region};
            })
            : sources.filter(source => !recipes.some(recipe => recipe.sourceSha1 == source.sha1))
                .map(source => ({source, region: [0, 0, 1, 1] as [number, number, number, number]}));

        const outDir = path.join(store.paths.workDir, "survey");
        fs.mkdirSync(outDir, {recursive: true});
        const written: string[] = [];
        for (const {source, region} of requests)
        {
            const image = await store.library.decode(source.sha1);
            const [rx, ry, rw, rh] = region;
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
            const svg = `<svg width="${outWidth}" height="${outHeight}" xmlns="http://www.w3.org/2000/svg">${lines}</svg>`;

            const partName = (rw < 1 || rh < 1) ? `_${region.map(value => value.toFixed(3)).join("_")}` : "";
            const outPath = path.join(outDir, `${getSourceName(source)}${partName}.jpg`);
            await sharp(Buffer.from(image.data.buffer, image.data.byteOffset, image.data.byteLength),
                {raw: {width: image.width, height: image.height, channels: 4}})
                .extract({left, top, width, height})
                .resize(outWidth, outHeight, {fit: "fill"})
                .flatten({background: "#808080"})
                .composite([{input: Buffer.from(svg)}])
                .jpeg({quality: 82})
                .toFile(outPath);
            console.log(`${path.relative(store.paths.repoRoot, outPath)}: ${source.width}x${source.height}, `
                + `by ${source.author ?? "(unknown)"}`);
            written.push(outPath);
        }
        return written;
    },

    // Every order of the plan (a JSON array of SampleOrder) saved as an entry, disabled, however it was saved
    // before. A new entry's path is written back into the plan as it is made. Returns the entries' paths.
    saveSamples: async (store: EntryStore, planPath: string): Promise<string[]> =>
    {
        const orders = JSON.parse(fs.readFileSync(planPath, "utf8")) as SampleOrder[];
        const saved: string[] = [];
        for (const order of orders)
        {
            const source = findSource(store.library.list(), order.source);
            if (source == undefined)
                throw new Error(`"${order.title}": ${order.source} is not in the library (add it with --add-sources)`);
            if (!source.url || !source.license)
                throw new Error(`"${order.title}": the library doesn't say where ${source.fileName} came from, or under what license`);
            if (order.cells != undefined && !order.keywords?.trim())
                throw new Error(`"${order.title}": an everyday object needs keywords, which a search finds it by`);

            const state = store.readState();
            const entryPath = await store.saveEntry({
                path: order.path,
                subfolder: order.subfolder,
                fields: {title: order.title, author: source.author ?? "", keywords: order.keywords, source: source.url,
                    license: source.license, disabled: true},
                recipe: SampleOrderUtil.toRecipe(order, source),
                baseHash: state.hash,
            });
            if (order.path != entryPath)
            {
                order.path = entryPath;
                fs.writeFileSync(planPath, JSON.stringify(orders, null, 2) + "\n");
            }
            const size = (order.cells != undefined) ? `${order.cells[0]}x${order.cells[1]} cells` : `long side ${order.longSide}`;
            console.log(`${entryPath} ${order.title} (${size}), disabled`);
            saved.push(entryPath);
        }
        return saved;
    },
}

// By its sha1, by its Unsplash id or page address, or by any other address it was added from.
function findSource(sources: SourceEntry[], key: string): SourceEntry | undefined
{
    if (/^[0-9a-f]{40}$/.test(key))
        return sources.find(source => source.sha1 == key);
    let unsplashId: string | undefined = key;
    try
    {
        unsplashId = SourceUrlUtil.getUnsplashId(key);
    }
    catch
    {
        // Not an address, so an Unsplash id.
    }
    return sources.find(source => source.url != undefined && (source.url == key
        || (unsplashId != undefined && SourceUrlUtil.getUnsplashId(source.url) == unsplashId)));
}

function splitRegion(name: string): [string, [number, number, number, number]]
{
    const match = /^(.*):(-?[\d.]+),(-?[\d.]+),([\d.]+),([\d.]+)$/.exec(name);
    if (match == null)
        return [name, [0, 0, 1, 1]];
    const region = match.slice(2).map(Number) as [number, number, number, number];
    if (region[0] < 0 || region[1] < 0 || region[2] <= 0 || region[3] <= 0
        || region[0] + region[2] > 1.0001 || region[1] + region[3] > 1.0001)
        throw new Error(`${name}: the part x,y,w,h must lie within the source, in fractions`);
    return [match[1], region];
}

function getSourceName(source: SourceEntry): string
{
    return (source.url != undefined ? SourceUrlUtil.getUnsplashId(source.url) : undefined) ?? source.sha1.slice(0, 12);
}

function wait(ms: number): Promise<void>
{
    return new Promise(resolve => setTimeout(resolve, ms));
}

export default BatchCommands;
