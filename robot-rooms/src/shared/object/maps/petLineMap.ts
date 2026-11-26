import { OBJECT_MESSAGE_MAX_LENGTH } from "../../system/sharedConstants";
import { PetCue } from "../types/petCue";
import { PetEditKind } from "../types/petEditKind";
import PetLine from "../types/petLine";
import PetLineData from "../types/petLineData";
import MessageLinkUtil from "../util/messageLinkUtil";

const happy = (text: string): PetLine => ({text, mood: 1});
const plain = (text: string): PetLine => ({text, mood: 0});
const sorry = (text: string): PetLine => ({text, mood: -1});

// Where what pets chat in is written, under the game's assets, for browsers to fetch (see PetLineLoadUtil).
export const PET_LINES_ASSET_PATH = "pets/lines.json";
// Where a line addressed to someone takes their name, which is kept to this many characters there.
export const PET_NAME_SLOT = "{name}";
const MAX_NAME_LENGTH = 20;

// How often a chat, a word to someone or a word on a thing is one about a writing (see PetLineData).
const READING_TALK_CHANCE = 0.15;
const READING_REMARK_CHANCE = 0.12;
// How often an interjection comes before a line, by the line's mood, and a cheer after a glad one (see vary). None
// comes before a line that already begins with one, nor after one that ends with one or asks something. Never a robot's
// sound: its voice makes those as it speaks (see PetVoiceUtil).
const OPENER_CHANCE = 0.3;
const CLOSER_CHANCE = 0.2;
const OPENERS: {[mood: number]: string[]} = {
    [1]: ["Ooh! ", "Yay! ", "Whee! ", "Oh! ", "Wow! "],
    [0]: ["Hmm. ", "Oh. ", "Mm. ", "Huh. "],
    [-1]: ["Oh no. ", "Eep! ", "Uh-oh. ", "Ugh. ", "Hmm... "],
};
const CLOSERS: {[mood: number]: string[]} = {
    [1]: [" Whee!", " Yay!", " Hee hee!"],
    [0]: [],
    [-1]: [],
};
const STARTS_WITH_INTERJECTION = /^(ooh|oh|eep|eek|grr|aaah|huh|hmm|mm|ugh|yay|whee|wow|whoa|uh-oh|abort|bonk)\b/i;
const ENDS_WITH_INTERJECTION = /\b(whee|yay|hee hee)[.!?]*$/i;
// A line said lately is said again only once this many others from its pool have been (fewer, of a short pool).
const LINES_BETWEEN_REPEATS = 3;

// What a pet says as something happens to it, or to show it heard: few, and part of every build, so a pet reacts in
// words from the first.
const CUE_LINES: {[cue in PetCue]: PetLine[]} = {
    hug: [happy("Stay a while."), happy("Hug mode: on."), happy("I like you."), happy("You're warm."),
        happy("Don't go anywhere."), happy("Best spot in the room.")],
    attack: [sorry("Grr!"), sorry("You again!"), sorry("Take this!"), sorry("Back off!"), sorry("My turf!"),
        sorry("Go away!")],
    attacked: [sorry("Help!"), sorry("Ouch! Stop it!"), sorry("Hey! Rude!"), sorry("Leave me alone!"), sorry("Ow! Ow!")],
    panic: [sorry("Aaah!"), sorry("Danger! Danger!"), sorry("Too loud!"), sorry("Eek! Run!"), sorry("Abort! Abort!"),
        sorry("Not again!")],
    woken: [plain("Huh? What?"), plain("I was not sleeping."), plain("Five more minutes..."), plain("Who's there?"),
        plain("I'm up! I'm up!")],
    charged: [happy("Fully charged!"), happy("Ooh! Much better."), happy("Power! So much power!"),
        happy("Ahh, fresh volts."), happy("Every cell lit! Thank you!"), happy("Ready to roll!")],
    repaired: [happy("Good as new!"), happy("Thank you! I feel shiny."), happy("Less rust, more me!"),
        happy("Ooh, smooth joints."), happy("No more squeaks! Thank you!")],
    follow: [plain("Wait for me!"), plain("Coming!"), plain("Hey, wait up!"), plain("Don't leave me behind!"),
        plain("Right behind you!")],
    called: [happy("Coming!"), happy("You called?"), happy("Yes? Yes?"), happy("On my way!"), happy("Here I come!"),
        happy("That's me!")],
    wordless: [plain("Hmm?"), plain("Huh?"), happy("Hee hee!"), plain("..."), plain("Mm?"), plain("Oh?")],
};

// What a pet says to be looked after: each shows the button that does it (see ScreenControlMap).
const DYING_LINE = sorry(`I'm dying. Give me <control name="wrench"/> \u{1F622}`);
const POWERLESS_LINE = sorry(`I'm out of battery. Give me <control name="battery"/>`);

// What pets chat in, once given (see use).
let lines: PetLineData | undefined = undefined;
// What of each pool was said lately, the latest last, by the pool.
const recentPicks = new Map<string, number[]>();

// The fixed words pets say (see PetBehaviorUtil), the same wherever one is played. No model writes any of them: what a
// pet answers someone who speaks to it is Claude's (see PetChatUtil). A line is picked from its pool, not one said
// lately, and given an interjection now and then (see vary), so a pet seldom says the same thing twice alike. Until it
// is given what pets chat in, a pet only reacts: it has no chat, no remark and no word on an edit to say.
const PetLineMap =
{
    use: (data: PetLineData): void =>
    {
        lines = data;
        recentPicks.clear();
    },
    getNumSmallTalks: (): number =>
    {
        return (lines == undefined) ? 0 : lines.talks.length + lines.readingTalks.length;
    },
    // A chat to begin, by its place among the chats: now and then one about a writing. Undefined with none to begin.
    pickSmallTalk: (): number | undefined =>
    {
        if (lines == undefined || lines.talks.length == 0)
            return undefined;
        const reading = lines.readingTalks.length > 0 && Math.random() < READING_TALK_CHANCE;
        return reading ? lines.talks.length + pickFresh("readingTalks", lines.readingTalks.length)
            : pickFresh("talks", lines.talks.length);
    },
    // A chat's lines, by its place among the chats; none for a place there is no chat at here.
    getSmallTalk: (topic: number): PetLine[] =>
    {
        if (lines == undefined)
            return [];
        return lines.talks[topic] ?? lines.readingTalks[topic - lines.talks.length] ?? [];
    },
    // Undefined for a type pets have nothing to say of.
    pickObjectRemark: (objectType: string): PetLine | undefined =>
    {
        const pool = lines?.objectRemarks[objectType];
        if (pool == undefined || pool.length == 0)
            return undefined;
        const readings = lines?.readingObjectRemarks[objectType];
        if (readings != undefined && readings.length > 0 && Math.random() < READING_REMARK_CHANCE)
            return readings[pickFresh(`reading:${objectType}`, readings.length)];
        return PetLineMap.vary(pool[pickFresh(`object:${objectType}`, pool.length)]);
    },
    hasObjectRemark: (objectType: string): boolean =>
    {
        return (lines?.objectRemarks[objectType]?.length ?? 0) > 0;
    },
    pickEditRemark: (kind: PetEditKind): PetLine | undefined =>
    {
        const pool = lines?.editRemarks[kind];
        return (pool == undefined || pool.length == 0) ? undefined
            : PetLineMap.vary(pool[pickFresh(`edit:${kind}`, pool.length)]);
    },
    // A word to someone by name: its owner, or anyone else; now and then one, nameless, about a writing.
    pickPersonRemark: (toOwner: boolean, name: string): PetLine | undefined =>
    {
        if (lines == undefined)
            return undefined;
        const readings = lines.readingPersonRemarks;
        if (readings.length > 0 && Math.random() < READING_REMARK_CHANCE)
            return readings[pickFresh("readingRemarks", readings.length)];
        const pool = toOwner ? lines.ownerRemarks : lines.strangerRemarks;
        if (pool.length == 0)
            return undefined;
        const line = pool[pickFresh(toOwner ? "owner" : "stranger", pool.length)];
        return PetLineMap.vary({text: line.text.replace(PET_NAME_SLOT,
            Array.from(name).slice(0, MAX_NAME_LENGTH).join("")), mood: line.mood});
    },
    pickCueLine: (cue: PetCue): PetLine =>
    {
        const pool = CUE_LINES[cue];
        const line = pool[pickFresh(`cue:${cue}`, pool.length)];
        // (Those are no more than an interjection already.)
        return (cue == "wordless") ? line : PetLineMap.vary(line);
    },
    getDyingLine: (): PetLine =>
    {
        return DYING_LINE;
    },
    getPowerlessLine: (): PetLine =>
    {
        return POWERLESS_LINE;
    },
    // A line as one pet says it this time: now and then with an interjection before it, by its mood, and a cheer after a
    // glad one, where the line has none there already and still fits a bubble with it. A line with a link is said as
    // it is.
    vary: (line: PetLine): PetLine =>
    {
        if (line.text.includes("<link"))
            return line;
        const mood = Math.sign(line.mood);
        let text = line.text;
        if (Math.random() < OPENER_CHANCE && !STARTS_WITH_INTERJECTION.test(text))
            text = fitOrKeep(text, pickOne(OPENERS[mood]) + text);
        if (Math.random() < CLOSER_CHANCE && CLOSERS[mood].length > 0 && !ENDS_WITH_INTERJECTION.test(text)
            && !text.endsWith("?"))
        {
            text = fitOrKeep(text, text + pickOne(CLOSERS[mood]));
        }
        return {text, mood: line.mood};
    },
    // Every line there is, as written, for what checks them all, those said to someone with the longest name they
    // take.
    getAllLines: (): PetLine[] =>
    {
        const chat = (lines == undefined) ? [] : [...lines.talks.flat(), ...lines.readingTalks.flat(),
            ...Object.values(lines.objectRemarks).flat(), ...Object.values(lines.readingObjectRemarks).flat(),
            ...Object.values(lines.editRemarks).flat(), ...lines.readingPersonRemarks,
            ...[...lines.ownerRemarks, ...lines.strangerRemarks].map(line =>
                ({text: line.text.replace(PET_NAME_SLOT, "W".repeat(MAX_NAME_LENGTH)), mood: line.mood}))];
        return [...chat, ...Object.values(CUE_LINES).flat(), DYING_LINE, POWERLESS_LINE];
    },
}

// The place of one of a pool's lines, at random, but for those said lately.
function pickFresh(pool: string, count: number): number
{
    const recent = recentPicks.get(pool) ?? [];
    const kept = Math.min(LINES_BETWEEN_REPEATS, count - 1);
    const lately = recent.slice(Math.max(0, recent.length - kept));
    const fresh = Array.from({length: count}, (_, i) => i).filter(i => !lately.includes(i));
    const picked = fresh[Math.floor(Math.random() * fresh.length)] ?? 0;
    recent.push(picked);
    recentPicks.set(pool, recent.slice(-LINES_BETWEEN_REPEATS));
    return picked;
}

function fitOrKeep(text: string, varied: string): string
{
    return (MessageLinkUtil.getVisibleLength(varied) <= OBJECT_MESSAGE_MAX_LENGTH) ? varied : text;
}

function pickOne<T>(items: T[]): T
{
    return items[Math.floor(Math.random() * items.length)];
}

export default PetLineMap;
