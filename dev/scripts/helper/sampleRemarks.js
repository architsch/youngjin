// Prints what helpers might say of the things they go and look at (see HelperRemarkUtil), from their fixed words and
// tastes, each remark with its length: to read the remarks after changing them, or the tastes and keywords behind them
// (see the helper-instructions skill). No model is asked, so it costs nothing:
//
//   node dev/scripts/helper/sampleRemarks.js [--personality=curator] [--npcs=2] [--count=6] [--thing=2/169]
//
// By default, every played personality, two helpers of each (with tastes of their own), and six remarks from each on
// things picked at random from every picture, lamp color and kind of thing there is; --thing hears them all on one
// picture (by its path), or "lamp", "fan", "door", "mirror" or "sign".

const path = require("path");
const Module = require("module");

const REPO_ROOT = path.join(__dirname, "../../..");
// A remark longer than this, as a bubble shows it, takes long to read: flagged.
const LONG_REMARK = 140;
const LIGHT_COLORS = 24;

function load()
{
    const esbuild = require("esbuild");
    const result = esbuild.buildSync({
        stdin: {
            contents: `export { default as HelperRemarkUtil } from "./src/server/agent/util/helperRemarkUtil";
export { default as NpcPersonalityMap } from "./src/shared/object/maps/npcPersonalityMap";
export { HELPER_INTERESTS } from "./src/server/agent/data/helperTastes";`,
            resolveDir: REPO_ROOT,
            loader: "ts",
        },
        bundle: true,
        write: false,
        platform: "node",
        format: "cjs",
        target: "node20",
        packages: "external",
        logLevel: "silent",
    });
    const entry = path.join(REPO_ROOT, "sampleRemarks.bundle.js");
    const module_ = new Module(entry, null);
    module_.filename = entry;
    module_.paths = Module._nodeModulePaths(REPO_ROOT);
    module_._compile(result.outputFiles[0].text, entry);
    return module_.exports;
}

// Every thing a helper could look at: each picture on what shows it, a lamp of each color, and the rest.
function allThings()
{
    const manifest = require(path.join(REPO_ROOT, "public/app/assets/pictures/manifest.json"));
    const pictures = manifest.images.filter(image => !image.disabled)
        .map(image => ({objectType: image.path.startsWith("1/") ? "Canvas" : "Prop", picture: image.path}));
    const lamps = Array.from({length: LIGHT_COLORS}, (_, color) => ({objectType: "Lamp", color}));
    return [...pictures, ...lamps, {objectType: "Fan"}, {objectType: "Door", text: "Gallery"}, {objectType: "Door"},
        {objectType: "Mirror"}, {objectType: "Label", text: "Information Desk"}, {objectType: "Label"}];
}

function main()
{
    const args = process.argv.slice(2);
    const option = (name) => args.find(arg => arg.startsWith(`--${name}=`))?.split("=")[1];
    const count = Number(option("count") ?? 6);
    const npcs = Number(option("npcs") ?? 2);
    const wanted = option("thing");

    const { HelperRemarkUtil, NpcPersonalityMap, HELPER_INTERESTS } = load();
    const played = NpcPersonalityMap.getEntries().map(entry => entry.id).filter(id => NpcPersonalityMap.isPlayed(id));
    const personalities = (option("personality") != undefined) ? [option("personality")] : played;
    const everything = allThings();
    const things = (wanted == undefined) ? everything : everything.filter(thing => thing.picture == wanted
        || ({lamp: "Lamp", fan: "Fan", door: "Door", mirror: "Mirror", sign: "Label"})[wanted] == thing.objectType);
    if (things.length == 0)
    {
        console.log(`No thing "${wanted}".`);
        return;
    }
    let long = 0;
    for (const personality of personalities)
    {
        for (let n = 0; n < npcs; ++n)
        {
            const objectId = `sample-${personality}-${n + 1}`;
            const {levels, painter} = HelperRemarkUtil.getTastes(objectId, personality);
            const named = (level) => [...levels].filter(([, l]) => l == level).map(([i]) => HELPER_INTERESTS[i].phrase);
            console.log(`\n== ${personality} #${n + 1}`);
            console.log(`   loves: ${[...named(2), `${painter}'s work`].join(", ")}`);
            console.log(`   dislikes: ${named(-1).join(", ") || "nothing"}`);
            const heard = (wanted == undefined) ? Array.from({length: count},
                () => things[Math.floor(Math.random() * things.length)]) : things.slice(0, count);
            for (const thing of heard)
            {
                const remark = HelperRemarkUtil.pick({objectId, personality}, [thing]);
                const text = remark?.text ?? "(nothing to say)";
                long += (text.length > LONG_REMARK) ? 1 : 0;
                console.log(`  (${String(text.length).padStart(3)}${text.length > LONG_REMARK ? " LONG" : ""}) `
                    + `[${thing.picture ?? thing.objectType}] ${text}`);
            }
        }
    }
    console.log(`\n${long} remark(s) over ${LONG_REMARK} characters.`);
}

main();
