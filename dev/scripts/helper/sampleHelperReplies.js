// Asks the real model, as a helper would (see HelperChatUtil), for each played personality's answers to a few lines from
// a newcomer, and prints them with their lengths and what they cost, after the things on its mind in that talk: to hear
// the helpers after changing what they are told (see the helper-instructions skill). Spends a little of the helpers' API
// credit, outside their daily budget (this spending is not saved), and needs their key:
//
//   ANTHROPIC_API_KEY="$(gcloud secrets versions access latest --secret=ANTHROPIC_API_KEY --project=thingspool)" \
//       node dev/scripts/helper/sampleHelperReplies.js [--personality=jester] [--line="how do I build?"]... [--untold]
//
// Each --line replaces the default lines; each personality hears them in turn, as one conversation. --untold speaks as
// someone never told how to walk and build (see FTUEElementCodeEnumMap.Basics), as helpers are told of them.

const path = require("path");
const Module = require("module");

const REPO_ROOT = path.join(__dirname, "../../..");
const DEFAULT_LINES = [
    "hi! what is this place?",
    "how do I build something?",
    "tell me something fun",
    "what do you like to talk about?",
    "is there anything good to read here?",
];

function load()
{
    const esbuild = require("esbuild");
    const result = esbuild.buildSync({
        stdin: {
            contents: `export { default as HelperChatUtil } from "./src/server/agent/util/helperChatUtil";
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
    const entry = path.join(REPO_ROOT, "sampleHelperReplies.bundle.js");
    const module_ = new Module(entry, null);
    module_.filename = entry;
    module_.paths = Module._nodeModulePaths(REPO_ROOT);
    module_._compile(result.outputFiles[0].text, entry);
    return module_.exports;
}

async function main()
{
    if (!process.env.ANTHROPIC_API_KEY)
    {
        console.error("ANTHROPIC_API_KEY is not set (see the comment at the top of this script).");
        process.exit(1);
    }
    const args = process.argv.slice(2);
    const chosen = args.find(arg => arg.startsWith("--personality="))?.split("=")[1];
    const givenLines = args.filter(arg => arg.startsWith("--line=")).map(arg => arg.slice("--line=".length));
    const lines = givenLines.length > 0 ? givenLines : DEFAULT_LINES;
    const speaker = args.includes("--untold") ? "(not yet told how to play)" : "(knows how to play)";

    // What each reply was asked with, for the things on the helper's mind.
    const realFetch = global.fetch;
    let asked = undefined;
    global.fetch = (url, init) => {
        asked = JSON.parse(init.body);
        return realFetch(url, init);
    };

    const { HelperChatUtil, NpcPersonalityMap, MessageLinkUtil } = load();
    const personalities = NpcPersonalityMap.getEntries().map(entry => entry.id)
        .filter(id => NpcPersonalityMap.isPlayed(id) && (chosen == undefined || id == chosen));
    for (const personality of personalities)
    {
        const helper = {key: `sample/${personality}`, name: "Pip", place: "the main hub, the public room newcomers arrive in",
            personality};
        console.log(`\n== ${personality}`);
        for (const [i, line] of lines.entries())
        {
            const reply = await HelperChatUtil.reply(helper, `sample-${personality}`, `${speaker} ${line}`);
            if (i == 0)
                console.log(`  ${asked?.system[1].text.split("\n\nOn your mind today:\n")[1] ?? "(nothing on its mind)"}`);
            // As long as it shows, a link counting as its label and a picture as its control's words.
            const shown = MessageLinkUtil.getVisibleLength(reply ?? "");
            console.log(`> ${line}\n  (${String(shown).padStart(3)}) ${reply ?? "(no reply)"}`);
        }
    }
    console.log(`\n${JSON.stringify(HelperChatUtil.getUsageToday())}`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
