import ColorUtil from "../../math/util/colorUtil";
import NumUtil from "../../math/util/numUtil";
import StringUtil from "../../math/util/stringUtil";
import { MAX_ROOM_PREFS_STEP } from "../../room/util/roomPrefsUtil";
import { LIGHT_COLOR_PALETTE_NAME } from "../../system/sharedConstants";
import AddObjectSignal from "../types/addObjectSignal";
import { ObjectMetadataKeyEnumMap } from "../types/objectMetadataKey";

// Where each of the lamp's settings sits in its stored string. Fixed positions, never reordered: a
// character's position is its whole meaning, so moving one re-lights every lamp already installed.
const COLOR_CHAR_INDEX = 0;
const INTENSITY_CHAR_INDEX = 1;
const SPREAD_CHAR_INDEX = 2;

// A lamp with nothing said about it burns plain white, at about a quarter of the strength it can be
// given and over most of a room. Chosen so that a lamp is always *something* — a lamp that arrived
// dark would read as broken rather than as unconfigured, and there is nothing on screen to tell the
// two apart by — and so that it arrives as an ordinary room light rather than at the top of a range
// that exists for dramatic effect (see LampLightUtil).
const DEFAULT_COLOR_INDEX = 0;
const DEFAULT_INTENSITY_STEP = 62;
const DEFAULT_SPREAD_STEP = 62;

// What a lamp gives off, to and from the three characters it stores.
//
// Every part is quantized exactly as everything else stored on an object is (see StringUtil), and
// reading is total: any string at all decodes to a lamp, including the empty one a lamp arrives
// with before anybody has adjusted it, and one from a version that stored fewer settings than this
// one does — a character past the end of the string reads back as that setting's default.
const LampObjectUtil =
{
    getColorIndex: (obj: AddObjectSignal): number =>
    {
        return readColorIndex(getLightProperties(obj));
    },
    getIntensityStep: (obj: AddObjectSignal): number =>
    {
        return readStep(getLightProperties(obj), INTENSITY_CHAR_INDEX, DEFAULT_INTENSITY_STEP);
    },
    getSpreadStep: (obj: AddObjectSignal): number =>
    {
        return readStep(getLightProperties(obj), SPREAD_CHAR_INDEX, DEFAULT_SPREAD_STEP);
    },
    // The same string written back out after being read, which is how a value arriving from
    // anywhere but this file is made safe to store (see ObjectMetadataEntryMap). Reading is total
    // and writing clamps, so the round trip is the whole of the validation.
    canonicalize: (rawLightProperties: string): string =>
    {
        return LampObjectUtil.encodeLightProperties(
            readColorIndex(rawLightProperties),
            readStep(rawLightProperties, INTENSITY_CHAR_INDEX, DEFAULT_INTENSITY_STEP),
            readStep(rawLightProperties, SPREAD_CHAR_INDEX, DEFAULT_SPREAD_STEP));
    },
    encodeLightProperties: (colorIndex: number, intensityStep: number,
        spreadStep: number): string =>
    {
        const chars: string[] = [];
        chars[COLOR_CHAR_INDEX] = StringUtil.convertRawNumberToVisibleASCII(
            clampToWholeStep(colorIndex, ColorUtil.getPaletteSize(LIGHT_COLOR_PALETTE_NAME) - 1));
        chars[INTENSITY_CHAR_INDEX] = StringUtil.convertRawNumberToVisibleASCII(
            clampToWholeStep(intensityStep, MAX_ROOM_PREFS_STEP));
        chars[SPREAD_CHAR_INDEX] = StringUtil.convertRawNumberToVisibleASCII(
            clampToWholeStep(spreadStep, MAX_ROOM_PREFS_STEP));
        return chars.join("");
    },
    getDefaultLightProperties: (): string =>
    {
        return LampObjectUtil.encodeLightProperties(DEFAULT_COLOR_INDEX, DEFAULT_INTENSITY_STEP,
            DEFAULT_SPREAD_STEP);
    },
}

function getLightProperties(obj: AddObjectSignal): string
{
    return obj.metadata[ObjectMetadataKeyEnumMap.LightProperties]?.str ?? "";
}

function readColorIndex(lightProperties: string): number
{
    const raw = StringUtil.convertVisibleASCIIToRawNumber(lightProperties, COLOR_CHAR_INDEX,
        DEFAULT_COLOR_INDEX);
    return NumUtil.clampInRange(raw, 0, ColorUtil.getPaletteSize(LIGHT_COLOR_PALETTE_NAME) - 1);
}

function readStep(lightProperties: string, charIndex: number, fallbackStep: number): number
{
    return StringUtil.convertVisibleASCIIToRawNumber(lightProperties, charIndex, fallbackStep);
}

// Clamping alone leaves NaN as NaN, and the character that comes of that is not one this encoding
// can read back — so anything that is not a number at all is treated as the bottom of the range.
function clampToWholeStep(n: number, max: number): number
{
    if (!Number.isFinite(n))
        return 0;
    return Math.round(NumUtil.clampInRange(n, 0, max));
}

export default LampObjectUtil;
