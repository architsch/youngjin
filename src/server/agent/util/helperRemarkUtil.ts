import pictureManifest from "../../../../public/app/assets/pictures/manifest.json";
import ColorUtil from "../../../shared/math/util/colorUtil";
import HelperRemarkSubject from "../../../shared/object/types/helperRemarkSubject";
import { NpcPersonality } from "../../../shared/object/types/npcPersonality";
import { CANVAS_IMAGE_SUBFOLDER } from "../../../shared/object/types/objectTypeConfig/canvasObjectTypeConfig";
import LabelTextUtil from "../../../shared/object/util/labelTextUtil";
import { LIGHT_COLOR_PALETTE_NAME } from "../../../shared/system/sharedConstants";
import { HELPER_REMARKS, PROPER_WORDS, REMARK_WORDS } from "../data/helperRemarks";
import { HELPER_INTERESTS, HELPER_TASTES } from "../data/helperTastes";
import { HelperInterest } from "../types/helperInterest";
import { HelperRemarkTaste } from "../types/helperRemarkTaste";
import HelperRemarkThing from "../types/helperRemarkThing";
import HelperRemarkVoice from "../types/helperRemarkVoice";

// The pictures canvases and props show, as the picture map's manifest has them (see image_map.md), bundled with the
// server: each one's title, who made it, and its own keywords. ThingsPool's own pictures are credited to OWN_AUTHOR.
const PICTURES = new Map((pictureManifest.images as {path: string, author: string, title: string, keywords?: string,
    disabled?: boolean}[]).filter(picture => !picture.disabled).map(picture => [picture.path, picture]));
const OWN_AUTHOR = "thingspool";
const PAINTERS = [...new Set([...PICTURES.values()]
    .filter(picture => picture.path.startsWith(`${CANVAS_IMAGE_SUBFOLDER}/`) && picture.author != OWN_AUTHOR)
    .map(picture => picture.author))].sort();
const INTEREST_BY_KEYWORD = new Map(Object.entries(HELPER_INTERESTS)
    .flatMap(([interest, {keywords}]) => keywords.map(keyword => [keyword, interest as HelperInterest])));
const COLOR_INTERESTS: HelperInterest[] = ["red", "orange", "yellow", "green", "blue", "purple", "pink", "brown",
    "black", "white", "gray"];
// A light's color by its hue, in degrees up to each bound; white when hardly colored, pale when only a little.
const HUE_COLORS: {upTo: number, interest: HelperInterest}[] = [{upTo: 15, interest: "red"},
    {upTo: 45, interest: "orange"}, {upTo: 70, interest: "yellow"}, {upTo: 165, interest: "green"},
    {upTo: 255, interest: "blue"}, {upTo: 285, interest: "purple"}, {upTo: 345, interest: "pink"},
    {upTo: 360, interest: "red"}];
const WHITE_SATURATION = 0.15;
const PALE_SATURATION = 0.45;
// How strongly a helper's feeling for a thing draws it to go and look at it.
const PULL: {[taste in HelperRemarkTaste]: number} = {love: 6, mixed: 3, like: 3, dislike: 2, meh: 1};
// How likely a helper is to like each interest one step more than its personality does, or one step less.
const OWN_LIKING_CHANCE = 0.08;
const OWN_DISLIKING_CHANCE = 0.05;
// How often it says a line for the kind of thing alone, where it has one that fits.
const KIND_LINE_CHANCE = 0.5;
// A remark longer than this is said only when no line comes out shorter.
const LONG_REMARK = 140;
// The words on a sign or a door's plate, said only when this short and plain.
const SAYABLE_TEXT_MAX_LENGTH = 24;
const PLAIN_TEXT = /^[\p{L}\p{N} ,.!?&-]+$/u;

// What a helper says of a thing it goes to look at (see HelperBehaviorUtil.startSight), in fixed words: each helper has
// tastes of its own (see getTastes), which draw it to the things it feels most for, and its remark on one says what it
// thinks of it and why, in its personality's voice (see helperRemarks.ts). No model is asked, so remarks cost nothing.
const HelperRemarkUtil =
{
    // Of the things it could go and look at, the one it does, by its place among them, and what it says of it; none
    // when it can say nothing of any of them (a picture the manifest doesn't have, a personality that isn't played).
    pick: (npc: {objectId: string, personality: NpcPersonality}, subjects: HelperRemarkSubject[]):
        {index: number, text: string} | undefined =>
    {
        const voice = HELPER_REMARKS[npc.personality as Exclude<NpcPersonality, "idle">];
        if (voice == undefined)
            return undefined;
        const tastes = HelperRemarkUtil.getTastes(npc.objectId, npc.personality);
        const options = subjects.flatMap((subject, index) => {
            const thing = HelperRemarkUtil.describe(subject);
            return (thing == undefined) ? [] : [{index, thing, feeling: feel(thing, tastes)}];
        });
        let roll = Math.random() * options.reduce((sum, {feeling}) => sum + PULL[feeling.taste], 0);
        const chosen = options.find(({feeling}) => (roll -= PULL[feeling.taste]) < 0) ?? options[options.length - 1];
        return (chosen == undefined) ? undefined : {index: chosen.index, text: compose(voice, chosen.thing, chosen.feeling)};
    },
    // A helper's tastes, the same every time for one NPC (by its id): its personality's, each a step more or less now and
    // then, a favorite color, and a favorite painter, whose work it loves. -1 dislikes, 0 neither, 1 likes, 2 loves.
    getTastes: (objectId: string, personality: NpcPersonality):
        {levels: Map<HelperInterest, number>, painter: string | undefined} =>
    {
        const base = HELPER_TASTES[personality as Exclude<NpcPersonality, "idle">];
        const levels = new Map<HelperInterest, number>();
        for (const interest of Object.keys(HELPER_INTERESTS) as HelperInterest[])
        {
            const level = (base == undefined) ? 0 : base.loves.includes(interest) ? 2 : base.likes.includes(interest) ? 1
                : base.dislikes.includes(interest) ? -1 : 0;
            const chance = hashToUnit(`${objectId} ${interest}`);
            levels.set(interest, (chance < OWN_LIKING_CHANCE) ? Math.min(2, level + 1)
                : (chance >= 1 - OWN_DISLIKING_CHANCE) ? Math.max(-1, level - 1) : level);
        }
        levels.set(favoriteOf(objectId, COLOR_INTERESTS)!, 2);
        return {levels, painter: favoriteOf(objectId, PAINTERS)};
    },
    // What a remark says of a thing, if it can say anything: a picture the manifest has, a lamp, a fan, a door, a mirror
    // or a sign.
    describe: (subject: HelperRemarkSubject): HelperRemarkThing | undefined =>
    {
        const picture = (subject.picture == undefined) ? undefined : PICTURES.get(subject.picture);
        const interests = (picture?.keywords ?? "").split(",").map(keyword => INTEREST_BY_KEYWORD.get(keyword.trim()))
            .filter((interest): interest is HelperInterest => interest != undefined);
        if (subject.objectType == "Canvas" && picture != undefined)
        {
            return (picture.author == OWN_AUTHOR)
                ? {kind: "photo", name: `the photo '${picture.title}'`, plural: false, interests: ["photos", ...interests],
                    title: picture.title}
                : {kind: "art", name: `'${picture.title}' by ${picture.author}`, plural: false,
                    interests: ["art", ...interests], title: picture.title, painter: picture.author};
        }
        if (subject.objectType == "Prop" && picture != undefined)
        {
            const title = withoutHalf(picture.title);
            return {kind: "object", name: `the ${toMidSentence(title)}`, plural: isPlural(title), interests};
        }
        if (subject.objectType == "Lamp")
        {
            const {name, interest} = nameLightColor(subject.color ?? 0);
            return {kind: "lamp", name: `the ${name} lamp`, plural: false, interests: ["lamps", interest], color: name};
        }
        // A sign by its words, and a door by those on its plate, when they are short and plain enough to say.
        const text = LabelTextUtil.toName(subject.text ?? "");
        const words = (text.length > 0 && text.length <= SAYABLE_TEXT_MAX_LENGTH && PLAIN_TEXT.test(text))
            ? `'${text}' ` : "";
        if (subject.objectType == "Label")
            return {kind: "sign", name: `the ${words}sign`, plural: false, interests: ["signs"]};
        if (subject.objectType == "Door")
            return {kind: "door", name: `the ${words}door`, plural: false, interests: ["doors"]};
        if (subject.objectType == "Fan")
            return {kind: "fan", name: "the fan", plural: false, interests: ["fans"]};
        return (subject.objectType == "Mirror")
            ? {kind: "mirror", name: "the mirror", plural: false, interests: ["mirrors"]} : undefined;
    },
}

// How much a helper likes a thing, and why: what it likes or dislikes most in it, the most telling of equals (and its
// favorite painter's work above all).
function feel(thing: HelperRemarkThing, tastes: {levels: Map<HelperInterest, number>, painter: string | undefined}):
    {taste: HelperRemarkTaste, reason?: string, other?: string}
{
    const felt = thing.interests.map(interest => ({phrase: HELPER_INTERESTS[interest].phrase,
        level: tastes.levels.get(interest) ?? 0}));
    if (thing.painter != undefined && thing.painter == tastes.painter)
        felt.unshift({phrase: `${thing.painter}'s work`, level: 2});
    const best = felt.reduce<typeof felt[number] | undefined>((most, f) => (most == undefined || f.level > most.level) ? f
        : most, undefined);
    const worst = felt.reduce<typeof felt[number] | undefined>((least, f) => (least == undefined || f.level < least.level)
        ? f : least, undefined);
    if (best == undefined || worst == undefined)
        return {taste: "meh"};
    if (best.level > 0 && worst.level < 0)
        return {taste: "mixed", reason: best.phrase, other: worst.phrase};
    if (best.level > 0)
        return {taste: (best.level >= 2) ? "love" : "like", reason: best.phrase};
    return (worst.level < 0) ? {taste: "dislike", reason: worst.phrase} : {taste: "meh", reason: felt[0].phrase};
}

// A line in the voice for how much it likes the thing, one for that kind of thing alone half the time it has one that
// fits, with its gaps filled; one short enough, if any is.
function compose(voice: HelperRemarkVoice, thing: HelperRemarkThing,
    feeling: {taste: HelperRemarkTaste, reason?: string, other?: string}): string
{
    const values: {[gap: string]: string | undefined} = {thing: thing.name, reason: feeling.reason,
        other: feeling.other, title: thing.title, painter: thing.painter, color: thing.color};
    const kinds = voice.kinds[thing.kind];
    const kindLines = (feeling.taste == "love" || feeling.taste == "like") ? kinds?.liked
        : (feeling.taste == "dislike") ? kinds?.disliked : undefined;
    const fitting = (lines: string[] | undefined) => (lines ?? []).filter(line => canFill(voice, line, values));
    const [ownFits, fits] = [fitting(kindLines), fitting(voice[feeling.taste])];
    const lines = (ownFits.length > 0 && (fits.length == 0 || Math.random() < KIND_LINE_CHANCE)) ? ownFits : fits;
    const said = shuffle(lines).map(line => fill(voice, line, values, thing.plural));
    return said.find(text => text.length <= LONG_REMARK) ?? said.sort((a, b) => a.length - b.length)[0] ?? "";
}

// Whether every gap in a line has something to fill it: the thing, or words to pick from.
function canFill(voice: HelperRemarkVoice, line: string, values: {[gap: string]: string | undefined}): boolean
{
    return [...line.matchAll(/\{(\w+)\}/g)].every(([, gap]) => {
        const name = toLowerFirst(gap);
        return values[name] != undefined || (voice.words?.[name] ?? REMARK_WORDS[name]) != undefined;
    });
}

// A line with its gaps filled, a capitalized gap starting a sentence, and [a|b] as said of one thing or of several.
function fill(voice: HelperRemarkVoice, line: string, values: {[gap: string]: string | undefined},
    plural: boolean): string
{
    const agree = (text: string) => text.replace(/\[([^[\]|]*)\|([^[\]|]*)\]/g, (_, one, several) => plural ? several : one);
    return agree(line.replace(/\{(\w+)\}/g, (_, gap: string) => {
        const name = toLowerFirst(gap);
        const options = voice.words?.[name] ?? REMARK_WORDS[name];
        const word = agree(values[name] ?? options[Math.floor(Math.random() * options.length)]);
        return (gap == name) ? word : word.charAt(0).toUpperCase() + word.slice(1);
    }));
}

// A picture's title as said in the middle of a sentence: in lower case, but for names (see PROPER_WORDS) and words
// written in capitals (TV).
function toMidSentence(title: string): string
{
    return title.replace(/[A-Za-z][A-Za-z']*/g, word =>
        (PROPER_WORDS.includes(word) || !/^[A-Z][a-z']*$/.test(word)) ? word : word.toLowerCase());
}

// A title without the half of a thing it shows, one picture of two ("Wide TV First Half").
function withoutHalf(title: string): string
{
    return title.replace(/,?\s+(upper|lower|first|second|left|right)\s+half$/i, "");
}

// Whether a title names several things: things listed, or a plural before any "with" or "on".
function isPlural(title: string): boolean
{
    const head = title.split(/\s+(?:with|on|of|in|onto|from|for|by)\s+/i)[0];
    const last = head.split(/[\s-]+/).pop() ?? "";
    return /,|\sand\s/i.test(head) || (/s$/i.test(last) && !/(ss|us|is)$/i.test(last));
}

// A light's color, as said ("pale blue") and as the interest it is ("blue"), by its hue (see HUE_COLORS).
function nameLightColor(index: number): {name: string, interest: HelperInterest}
{
    const {x: r, y: g, z: b} = ColorUtil.paletteIndexToRGB(LIGHT_COLOR_PALETTE_NAME, index);
    const max = Math.max(r, g, b);
    const range = max - Math.min(r, g, b);
    const saturation = (max == 0) ? 0 : range / max;
    if (saturation < WHITE_SATURATION)
        return {name: "white", interest: "white"};
    const sector = (max == r) ? ((g - b) / range + 6) % 6 : (max == g) ? (b - r) / range + 2 : (r - g) / range + 4;
    const interest = HUE_COLORS.find(({upTo}) => 60 * sector < upTo)!.interest;
    return {name: (saturation < PALE_SATURATION) ? `pale ${interest}` : interest, interest};
}

// The one a helper favors of some options, the same every time for one NPC, and the same though others are added
// (unless one of those it favors more).
function favoriteOf<T extends string>(objectId: string, options: T[]): T | undefined
{
    return options.reduce<T | undefined>((best, option) => (best == undefined
        || hashToUnit(`${objectId} favorite ${option}`) > hashToUnit(`${objectId} favorite ${best}`)) ? option : best,
        undefined);
}

// A number from 0 to 1, the same every time for the same text (FNV-1a).
function hashToUnit(text: string): number
{
    let hash = 2166136261;
    for (let i = 0; i < text.length; ++i)
        hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
    return (hash >>> 0) / 4294967296;
}

function toLowerFirst(text: string): string
{
    return text.charAt(0).toLowerCase() + text.slice(1);
}

function shuffle<T>(items: T[]): T[]
{
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; --i)
    {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

export default HelperRemarkUtil;
