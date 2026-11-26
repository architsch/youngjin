import NumUtil from "../../math/util/numUtil";
import StringUtil from "../../math/util/stringUtil";
import AddObjectSignal from "../types/addObjectSignal";
import { ObjectMetadataKeyEnumMap } from "../types/objectMetadataKey";
import { PetActionEnumMap } from "../types/petAction";
import { PetExpressionEnumMap } from "../types/petExpression";
import PetShownState from "../types/petShownState";
import { PetSpeechToneEnumMap } from "../types/petSpeechTone";

// The cells of a pet's battery indicator, each a third of a charge.
export const PET_BATTERY_LEVELS = 3;
// The steps of rust a pet shows, from none: one for each equal share of its health it has lost in full.
export const PET_RUST_LEVELS = 10;

// Character positions in the stored string, one base-94 character each (see StringUtil), ahead of the target's id, which
// is the rest. Never reorder: a setting added later goes into the head's spare characters.
const ACTION_CHAR_INDEX = 0;
const EXPRESSION_CHAR_INDEX = 1;
const FLAGS_CHAR_INDEX = 2;
const BATTERY_CHAR_INDEX = 3;
const RUST_CHAR_INDEX = 4;
const HITS_CHAR_INDEX = 5;
const TOPIC_CHAR_INDEX = 6;
const TURN_CHAR_INDEX = 7;
const FACING_CHAR_INDEX = 8;
// A chat's place past what one character holds, its place being told in two (see PetShownState.topic).
const TOPIC_HIGH_CHAR_INDEX = 9;
// (10 and 11 are spare.)
const HEAD_LENGTH = 12;
const SPARE_CHAR = StringUtil.convertRawNumberToVisibleASCII(0);
const MAX_RAW = 93;
const SLEEPY_FLAG = 1;
const POWERLESS_FLAG = 2;
const EXCITED_FLAG = 4;
const TONE_SHIFT = 3;
// A facing is kept to this many degrees, in one character, which holds 0 for none.
const FACING_STEP = 4;
const MAX_TARGET_ID_LENGTH = 32;

const actions = Object.values(PetActionEnumMap);
const expressions = Object.values(PetExpressionEnumMap);
const tones = Object.values(PetSpeechToneEnumMap);

// Encodes and decodes what a pet shows of itself (see PetShownState). Decoding is total, so any string is a value: by
// default a pet standing idle, its face level, charged and without rust. Only whoever plays the pet writes it.
const PetShownStateUtil =
{
    decode: (str: string): PetShownState =>
    {
        const read = (charIndex: number, fallback: number = 0) =>
            StringUtil.convertVisibleASCIIToRawNumber(str, charIndex, fallback);
        const action = read(ACTION_CHAR_INDEX);
        const expression = read(EXPRESSION_CHAR_INDEX);
        const flags = read(FLAGS_CHAR_INDEX);
        const tone = flags >> TONE_SHIFT;
        const facing = read(FACING_CHAR_INDEX);
        return {
            action: actions.includes(action) ? action : PetActionEnumMap.Idle,
            expression: expressions.includes(expression) ? expression : PetExpressionEnumMap.Neutral,
            sleepy: (flags & SLEEPY_FLAG) != 0,
            powerless: (flags & POWERLESS_FLAG) != 0,
            excited: (flags & EXCITED_FLAG) != 0,
            tone: tones.includes(tone) ? tone : PetSpeechToneEnumMap.Normal,
            batteryLevel: Math.min(PET_BATTERY_LEVELS, read(BATTERY_CHAR_INDEX, PET_BATTERY_LEVELS)),
            rust: Math.min(PET_RUST_LEVELS - 1, read(RUST_CHAR_INDEX)),
            hits: read(HITS_CHAR_INDEX),
            topic: read(TOPIC_CHAR_INDEX) + (MAX_RAW + 1) * read(TOPIC_HIGH_CHAR_INDEX),
            turn: read(TURN_CHAR_INDEX),
            facing: (facing == 0) ? undefined : (facing - 1) * FACING_STEP,
            targetId: str.slice(HEAD_LENGTH, HEAD_LENGTH + MAX_TARGET_ID_LENGTH),
        };
    },
    encode: (state: PetShownState): string =>
    {
        const write = (value: number, most: number = MAX_RAW) => StringUtil.convertRawNumberToVisibleASCII(
            Number.isFinite(value) ? Math.round(NumUtil.clampInRange(value, 0, most)) : 0);
        const chars: string[] = new Array(HEAD_LENGTH).fill(SPARE_CHAR);
        chars[ACTION_CHAR_INDEX] = write(actions.includes(state.action) ? state.action : PetActionEnumMap.Idle);
        chars[EXPRESSION_CHAR_INDEX] = write(expressions.includes(state.expression) ? state.expression
            : PetExpressionEnumMap.Neutral);
        chars[FLAGS_CHAR_INDEX] = write((state.sleepy ? SLEEPY_FLAG : 0) | (state.powerless ? POWERLESS_FLAG : 0)
            | (state.excited ? EXCITED_FLAG : 0)
            | ((tones.includes(state.tone) ? state.tone : PetSpeechToneEnumMap.Normal) << TONE_SHIFT));
        chars[BATTERY_CHAR_INDEX] = write(state.batteryLevel, PET_BATTERY_LEVELS);
        chars[RUST_CHAR_INDEX] = write(state.rust, PET_RUST_LEVELS - 1);
        chars[HITS_CHAR_INDEX] = write(state.hits % (MAX_RAW + 1));
        const topic = Number.isFinite(state.topic) ? Math.max(0, Math.round(state.topic)) : 0;
        chars[TOPIC_CHAR_INDEX] = write(topic % (MAX_RAW + 1));
        chars[TOPIC_HIGH_CHAR_INDEX] = write(Math.floor(topic / (MAX_RAW + 1)));
        chars[TURN_CHAR_INDEX] = write(state.turn);
        chars[FACING_CHAR_INDEX] = write((state.facing == undefined || !Number.isFinite(state.facing)) ? 0
            : 1 + Math.round((((state.facing % 360) + 360) % 360) / FACING_STEP) % (360 / FACING_STEP));
        return chars.join("") + state.targetId.slice(0, MAX_TARGET_ID_LENGTH);
    },
    canonicalize: (str: string): string =>
    {
        return PetShownStateUtil.encode(PetShownStateUtil.decode(str));
    },
    getObjectState: (obj: AddObjectSignal): PetShownState =>
    {
        return PetShownStateUtil.decode(obj.metadata[ObjectMetadataKeyEnumMap.PetState]?.str ?? "");
    },
    // The next count of strikes, as it shows.
    countHit: (hits: number): number =>
    {
        return (hits + 1) % (MAX_RAW + 1);
    },
    // The cells a charge lights: none once it is spent, else one for each third it reaches into.
    getBatteryLevel: (energy: number): number =>
    {
        return (energy <= 0) ? 0 : Math.min(PET_BATTERY_LEVELS, Math.floor(energy * PET_BATTERY_LEVELS) + 1);
    },
    // How rusty a pet in such health looks: none while it is in its first share, and the most a living pet shows in its
    // last.
    getRust: (health: number): number =>
    {
        const sharesLeft = Math.ceil(NumUtil.clampInRange(health, 0, 1) * PET_RUST_LEVELS);
        return PET_RUST_LEVELS - Math.max(1, sharesLeft);
    },
}

export default PetShownStateUtil;
