import path from "path";
import EditorPaths from "./editorPaths";
import EntryStore from "./entryStore";
import MapRebuilder from "./mapRebuilder";
import RenderCommands from "./renderCommands";
import BatchCommands from "./batchCommands";
import serveEditor from "./editorServer";

const DEFAULT_PORT = 3200;
const REPO_SOURCES_DIR = "dev/assets/picture_sources";

// Serves the editor, or, given a command, runs it and exits (see server.js for the usage).
async function main(): Promise<void>
{
    const args = process.argv.slice(2);
    // Set by server.js, since this runs from a bundle elsewhere.
    const repoRoot = process.env.IMAGE_MAP_EDITOR_ROOT ?? process.cwd();
    const workspace = readValue(args, "--workspace");
    const paths: EditorPaths = (workspace == undefined)
        ? {
            repoRoot,
            imagesDir: path.join(repoRoot, "public/app/assets/pictures"),
            samplesDir: path.join(repoRoot, "dev/assets/pictures"),
            disabledImagesDir: path.join(repoRoot, "dev/assets/disabled_pictures"),
            recipesPath: path.join(repoRoot, "dev/scripts/imageMapEditor/recipes/pictures.json"),
            noticesPath: path.join(repoRoot, "THIRD-PARTY-NOTICES.md"),
            sourcesDir: path.join(repoRoot, REPO_SOURCES_DIR),
            workDir: path.join(repoRoot, "temp/image_map_editor"),
            rebuildsMap: true,
        }
        : {
            repoRoot,
            imagesDir: path.resolve(workspace, "pictures"),
            samplesDir: path.resolve(workspace, "samples"),
            disabledImagesDir: path.resolve(workspace, "disabled_images"),
            recipesPath: path.resolve(workspace, "recipes.json"),
            noticesPath: path.resolve(workspace, "THIRD-PARTY-NOTICES.md"),
            // Its own library, reading the repository's photos (stored by content, so the same file either way).
            sourcesDir: path.resolve(workspace, "sources"),
            fallbackSourcesDir: path.join(repoRoot, REPO_SOURCES_DIR),
            workDir: path.resolve(workspace, "work"),
            rebuildsMap: false,
        };
    const store = new EntryStore(paths);
    for (const entryPath of await store.adoptUnsampledEntries())
        console.log(`${entryPath}: taken in as its own source and sample`);

    if (args.includes("--add-sources"))
    {
        const urls = readList(args, "--add-sources");
        if (urls == undefined)
            throw new Error("--add-sources needs the addresses of the photos to add");
        await BatchCommands.addSources(store, urls);
        return;
    }
    if (args.includes("--survey"))
    {
        const written = await BatchCommands.writeSurveys(store, readList(args, "--survey"));
        if (written.length == 0)
            console.log("Every source in the library is sampled already; name the ones to survey.");
        return;
    }

    const saveSamples = readValue(args, "--save-samples");
    const renderSamples = args.includes("--render-samples");
    const renderGameImages = args.includes("--render-game-images");
    const contactSheet = args.includes("--contact-sheet");
    if (saveSamples == undefined && !renderSamples && !renderGameImages && !contactSheet)
    {
        const port = Number(readValue(args, "--port") ?? DEFAULT_PORT);
        if (!Number.isInteger(port) || port <= 0 || port > 65535)
            throw new Error(`Invalid --port value: ${readValue(args, "--port")}`);
        await serveEditor(store, port);
        return;
    }

    const saved = (saveSamples != undefined) ? await BatchCommands.saveSamples(store, saveSamples) : undefined;
    if (renderSamples || renderGameImages)
        store.rewriteFiles();
    if (renderSamples)
        await RenderCommands.renderSamples(store, readList(args, "--render-samples"));
    if (renderGameImages)
        await RenderCommands.renderGameImages(store);
    if (saved != undefined || renderSamples || renderGameImages)
    {
        let rebuildError: string | undefined;
        const mapRebuilder = new MapRebuilder(paths, (error) => rebuildError = error);
        mapRebuilder.request();
        await mapRebuilder.whenIdle();
        if (rebuildError)
            throw new Error(`Rebuilding the map failed:\n${rebuildError}`);
    }
    // A batch just saved is what wants reviewing.
    const sheetPath = await RenderCommands.writeContactSheet(store,
        contactSheet ? readList(args, "--contact-sheet") : saved);
    console.log(`Contact sheet: ${path.relative(repoRoot, sheetPath)}`);
}

function readValue(args: string[], flag: string): string | undefined
{
    const index = args.indexOf(flag);
    return (index < 0) ? undefined : args[index + 1];
}

// The values after a flag up to the next flag; undefined when there are none (meaning all).
function readList(args: string[], flag: string): string[] | undefined
{
    const index = args.indexOf(flag);
    const values: string[] = [];
    for (let i = index + 1; i < args.length && !args[i].startsWith("--"); ++i)
        values.push(args[i]);
    return (values.length > 0) ? values : undefined;
}

main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
});
