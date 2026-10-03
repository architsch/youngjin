// Local tool that prepares pictures for use as flat ones (what a prop or a canvas shows): cuts a thing out of its
// background with Segment Anything 2, enlarges one too small with Real-ESRGAN, squares up a face seen at an angle
// to its true shape, makes something round seen at an angle round again, paints a part over with surface from
// elsewhere in the picture, and keeps one part of the result (see core/prepOrder.ts for what an order may ask), which
// is fitted within the largest size a result may have. It writes only under temp/image_prep, and nothing into the
// picture map: a result goes there afterwards through the image map editor. This file only bundles node/main.ts, so
// the tool is written in TypeScript and shares the editor's code.
//
// Usage: npm run imagePrep -- --survey <file>[:x,y,w,h] ...   pictures (or parts) drawn with a grid to plan by
//        npm run imagePrep -- --shades <file>[:x,y,w,h] ...   their brightness read out, cell by cell
//        npm run imagePrep -- --run <plan.json>                orders carried out, with a contact sheet of the results
// (All serve the image-upscale-remap skill; see .claude/skills/image-upscale-remap.)
// Into temp/image_prep/tools, the first time: an order that upscales fetches Real-ESRGAN (BSD-3-Clause, about 50 MB,
// macOS), and one that cuts out fetches ONNX Runtime (MIT, about 115 MB) and Segment Anything 2 (Apache-2.0, about
// 910 MB).

const path = require("path");

const REPO_ROOT = path.join(__dirname, "../../..");
const OUTFILE = path.join(REPO_ROOT, "temp/image_prep/prepMain.cjs");

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
    process.env.IMAGE_PREP_ROOT = REPO_ROOT;
    require(OUTFILE);
}
