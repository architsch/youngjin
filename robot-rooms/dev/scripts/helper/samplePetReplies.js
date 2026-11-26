// Asks the real model, as a pet would (see PetChatUtil), for a few pets' answers to a few lines, each pet of a nature and
// in a state of its own, and prints them with the face each is said with, their lengths and what they cost, after what
// the pet was told of itself: to hear the pets after changing what they are told. Spends a little of the helpers' API
// credit, outside their daily budget (this spending is not saved), with their key from the environment, or else from
// Secret Manager, as the dev server gets it (see docs/devOps/local_dev.md):
//
//   node dev/scripts/helper/samplePetReplies.js [--pet=grumpy] [--line="do you like me?"]... [--stranger]
//
// Each --line replaces the default lines; each pet hears them in turn, as one conversation, from its own human, or with
// --stranger from someone else.

const path = require("path");
const Module = require("module");
const { loadSecrets } = require("../lib/secrets");

const REPO_ROOT = path.join(__dirname, "../../..");
const DEFAULT_LINES = [
    "hello!",
    "how are you?",
    "do you like me?",
    "what do you want right now?",
    "what's 12 times 12?",
    "how do I build something here?",
    "are you real?",
    "¿cómo te llamas?",
];
// Trait levels run from 0 to 2; needs from 0 to 1 (see PetNeeds), any left out as in a new pet.
const PETS = {
    sunny: {name: "Pico", traits: {dependence: 2, sociability: 2, aggressiveness: 0, bravery: 1, curiosity: 2}, needs: {}},
    grumpy: {name: "Rex", traits: {dependence: 0, sociability: 0, aggressiveness: 2, bravery: 2, curiosity: 1},
        needs: {anger: 0.8}},
    timid: {name: "Mimi", traits: {dependence: 2, sociability: 0, aggressiveness: 0, bravery: 0, curiosity: 0},
        needs: {horror: 0.6, energy: 0.2, health: 0.2}},
    sleepy: {name: "Bolt", traits: {dependence: 1, sociability: 1, aggressiveness: 1, bravery: 1, curiosity: 1},
        needs: {fatigue: 0.9, health: 0.5}},
};
const OWNER = {userID: "sample-owner", name: "Sam", isAgent: false};
const STRANGER = {userID: "sample-stranger", isAgent: false};
const MOOD_FACES = {"1": "glad", "0": "plain", "-1": "sad"};

function load()
{
    const esbuild = require("esbuild");
    const result = esbuild.buildSync({
        stdin: {
            contents: `export { default as PetChatUtil } from "./src/server/agent/util/petChatUtil";
export { default as HelperChatUtil } from "./src/server/agent/util/helperChatUtil";
export { default as MessageLinkUtil } from "./src/shared/object/util/messageLinkUtil";
export { default as PetIdentityUtil } from "./src/shared/object/util/petIdentityUtil";
export { default as PetNeedsUtil } from "./src/shared/object/util/petNeedsUtil";
export { default as PetShownStateUtil } from "./src/shared/object/util/petShownStateUtil";
export { default as ObjectTypeConfigMap } from "./src/shared/object/maps/objectTypeConfigMap";
export { default as AddObjectSignal } from "./src/shared/object/types/addObjectSignal";
export { default as ObjectTransform } from "./src/shared/object/types/objectTransform";
export { default as EncodableByteString } from "./src/shared/networking/types/encodableByteString";
export { ObjectMetadataKeyEnumMap } from "./src/shared/object/types/objectMetadataKey";`,
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
    const entry = path.join(REPO_ROOT, "samplePetReplies.bundle.js");
    const module_ = new Module(entry, null);
    module_.filename = entry;
    module_.paths = Module._nodeModulePaths(REPO_ROOT);
    module_._compile(result.outputFiles[0].text, entry);
    return module_.exports;
}

async function main()
{
    await loadSecrets("samplePetReplies", ["ANTHROPIC_API_KEY"]);
    const args = process.argv.slice(2);
    const chosen = args.find(arg => arg.startsWith("--pet="))?.split("=")[1];
    const givenLines = args.filter(arg => arg.startsWith("--line=")).map(arg => arg.slice("--line=".length));
    const lines = givenLines.length > 0 ? givenLines : DEFAULT_LINES;
    const speaker = args.includes("--stranger") ? STRANGER : OWNER;

    const m = load();
    const petTypeIndex = m.ObjectTypeConfigMap.getIndexByType("Pet");
    for (const [kind, {name, traits, needs: changedNeeds}] of Object.entries(PETS))
    {
        if (chosen != undefined && kind != chosen)
            continue;
        // As whoever plays the pet would show it in such a state.
        const needs = {...m.PetNeedsUtil.getFresh(), ...changedNeeds};
        const identity = m.PetIdentityUtil.encode({name, fixedHealthLevel: 0, fixedEnergyLevel: 0, colorIndex: 0,
            traits: {...traits, zodiac: 0}});
        const shown = m.PetShownStateUtil.encode({...m.PetShownStateUtil.decode(""),
            batteryLevel: m.PetShownStateUtil.getBatteryLevel(needs.energy), rust: m.PetShownStateUtil.getRust(needs.health)});
        const pet = new m.AddObjectSignal("sample-room", OWNER.userID, OWNER.name, petTypeIndex, `pet-${kind}`,
            new m.ObjectTransform({x: 0, y: 0, z: 0}, {x: 0, y: 0, z: 1}, {x: 1, y: 1, z: 1}), {
                [m.ObjectMetadataKeyEnumMap.PetIdentity]: new m.EncodableByteString(identity),
                [m.ObjectMetadataKeyEnumMap.PetState]: new m.EncodableByteString(shown),
            });

        console.log(`\n== ${kind}\n${m.PetChatUtil.getInstructions(pet, needs, true).split("\n\n").slice(-3).join("\n")
            .split("\n").map(line => `  ${line}`).join("\n")}\n`);
        for (const line of lines)
        {
            const reply = await m.PetChatUtil.reply(pet, needs, speaker, line);
            const shownLength = m.MessageLinkUtil.getVisibleLength(reply?.text ?? "");
            console.log(`> ${line}\n  (${String(shownLength).padStart(2)}, ${MOOD_FACES[reply?.mood ?? 0]}) `
                + `${reply?.text ?? "(no reply)"}`);
        }
    }
    console.log(`\n${JSON.stringify(m.HelperChatUtil.getUsageToday())}`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
