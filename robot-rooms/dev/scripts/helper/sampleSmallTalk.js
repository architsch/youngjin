// Prints chats two helpers might have with each other (see HelperSmallTalkUtil), from their fixed words, each line with
// how long it shows: to read the small talk after changing it (see the helper-instructions skill). No model is asked, so
// it costs nothing:
//
//   node dev/scripts/helper/sampleSmallTalk.js [--pair=jester,sage] [--count=2]
//
// By default, a chat for every pair of played personalities (a personality with itself included); --pair hears one pair,
// and --count gives each pair that many chats.

const path = require("path");
const Module = require("module");

const REPO_ROOT = path.join(__dirname, "../../..");
// A line longer than this, as a bubble shows it, takes long to read: flagged.
const LONG_LINE = 140;

function load()
{
    const esbuild = require("esbuild");
    const result = esbuild.buildSync({
        stdin: {
            contents: `export { default as HelperSmallTalkUtil } from "./src/server/agent/util/helperSmallTalkUtil";
export { default as NpcPersonalityMap } from "./src/shared/object/maps/npcPersonalityMap";
export { default as MessageLinkUtil } from "./src/shared/object/util/messageLinkUtil";`,
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
    const entry = path.join(REPO_ROOT, "sampleSmallTalk.bundle.js");
    const module_ = new Module(entry, null);
    module_.filename = entry;
    module_.paths = Module._nodeModulePaths(REPO_ROOT);
    module_._compile(result.outputFiles[0].text, entry);
    return module_.exports;
}

function main()
{
    const args = process.argv.slice(2);
    const pair = args.find(arg => arg.startsWith("--pair="))?.split("=")[1]?.split(",");
    const count = Number(args.find(arg => arg.startsWith("--count="))?.split("=")[1] ?? 1);

    const { HelperSmallTalkUtil, NpcPersonalityMap, MessageLinkUtil } = load();
    const played = NpcPersonalityMap.getEntries().map(entry => entry.id).filter(id => NpcPersonalityMap.isPlayed(id));
    const pairs = (pair != undefined) ? [pair]
        : played.flatMap((a, i) => played.slice(i).map(b => [a, b]));
    let long = 0;
    for (const [a, b] of pairs)
    {
        for (let i = 0; i < count; ++i)
        {
            const helpers = [{name: "Mira", personality: a}, {name: "Bo", personality: b}];
            console.log(`\n== Mira (${a}) and Bo (${b})`);
            for (const line of HelperSmallTalkUtil.compose(helpers))
            {
                const shown = MessageLinkUtil.getVisibleLength(line.text);
                long += (shown > LONG_LINE) ? 1 : 0;
                console.log(`  (${String(shown).padStart(3)}${shown > LONG_LINE ? " LONG" : ""}) `
                    + `${helpers[line.by].name}: ${line.text}`);
            }
        }
    }
    console.log(`\n${long} line(s) over ${LONG_LINE} characters as shown.`);
}

main();
