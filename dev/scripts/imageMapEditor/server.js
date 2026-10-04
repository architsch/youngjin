// Local tool for the picture map (the images canvases and props show): a page that takes samples of any image on
// this machine (straightened,
// retouched, cut out of their background) and makes them the map's entries, writing their game images,
// full-resolution samples, manifest entries, recipes and notices rows, and rebuilding the map (see node/ and
// app/). A source can first be preprocessed into another there, with the picture preparation tool's steps (see
// ../imagePrep): a cut-out uses that tool's model, fetched into temp/image_prep/tools on first use, once allowed.
// This file only bundles node/main.ts, so the tool is written in TypeScript and shares the game's code.
//
// Usage: npm run imageMapEditor [-- --port <port>] [-- --workspace <dir>]
//        npm run imageMapEditor -- --render-samples [<path> ...]      samples made again from their recipes
//        npm run imageMapEditor -- --render-game-images               game images made again from their samples
//        npm run imageMapEditor -- --contact-sheet [<subfolder or path> ...]  entries on one sheet, for review
//        npm run imageMapEditor -- --add-sources <url or file> ...    photos added to the source library; a file as
//            one's own by --author <name>, or with the --url, --author and --license of the photo it was made from
//        npm run imageMapEditor -- --survey [<source>[:x,y,w,h] ...]  photos (or parts) drawn with a grid to plan by
//        npm run imageMapEditor -- --save-samples <plan.json>         planned samples saved as disabled entries
// (The last three serve the image-map-sampling skill; see .claude/skills/image-map-sampling.)
// A workspace is a scratch directory holding pictures/, samples/, recipes.json and THIRD-PARTY-NOTICES.md,
// edited in place of the repository's (the generated map is then left alone).

const path = require("path");

const REPO_ROOT = path.join(__dirname, "../../..");
const OUTFILE = path.join(REPO_ROOT, "temp/image_map_editor/editorMain.cjs");

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

async function main()
{
    let esbuild;
    try
    {
        esbuild = require("esbuild");
    }
    catch
    {
        console.error("esbuild was not found. It comes with the dev dependencies (through vitest): run `npm install`.");
        process.exit(1);
    }

    await esbuild.build({
        entryPoints: [path.join(__dirname, "node/main.ts")],
        outfile: OUTFILE,
        bundle: true,
        platform: "node",
        format: "cjs",
        target: "node18",
        external: ["sharp", "esbuild"],
        logLevel: "warning",
    });
    process.env.IMAGE_MAP_EDITOR_ROOT = REPO_ROOT;
    require(OUTFILE);
}
