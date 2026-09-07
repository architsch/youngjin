import ColorUtil from "../../math/util/colorUtil";
import NumUtil from "../../math/util/numUtil";
import StringUtil from "../../math/util/stringUtil";
import { MAX_LAMP_INTENSITY, MAX_LAMP_RANGE, MIN_LAMP_INTENSITY,
    MIN_LAMP_RANGE } from "../../graphics/light/util/lampLightUtil";
import { LIGHT_COLOR_PALETTE_NAME } from "../../system/sharedConstants";
import AddObjectSignal from "../types/addObjectSignal";
import { ObjectMetadataKeyEnumMap } from "../types/objectMetadataKey";

// Where each of the lamp's settings sits in its stored string. Fixed positions, never reordered: a
// character's position is its whole meaning, so moving one re-lights every lamp already installed.
const COLOR_CHAR_INDEX = 0;
const INTENSITY_CHAR_INDEX = 1;
const RANGE_CHAR_INDEX = 2;

// A lamp with nothing said about it burns plain white, at about a quarter of the strength it can be
// given and over most of a room. Chosen so that a lamp is always *something* — a lamp that arrived
// dark would read as broken rather than as unconfigured, and there is nothing on screen to tell the
// two apart by — and so that it arrives as an ordinary room light rather than at the top of a range
// that exists for dramatic effect (see LampLightUtil).
const DEFAULT_COLOR_INDEX = 0;
const DEFAULT_INTENSITY = 3;
const DEFAULT_RANGE = 10;

// What a lamp gives off, to and from the three characters it stores.
//
// The two light settings are stored as the quantities themselves rather than as positions on a
// scale (see LampLightUtil), which is what lets the same number be shown to whoever is adjusting
// the lamp. They still fit in one character each, since everything stored on an object is quantized
// the same way (see StringUtil) and both ranges are far inside what one character carries.
//
// Reading is total: any string at all decodes to a lamp, including the empty one a lamp arrives
// with before anybody has adjusted it, one from a version that stored fewer settings than this one
// does — a character past the end of the string reads back as that setting's default — and one
// carrying a number outside the range its setting allows, which is clamped into it.
const LampObjectUtil =
{
    getColorIndex: (obj: AddObjectSignal): number =>
    {
        return readColorIndex(getLightProperties(obj));
    },
    getIntensity: (obj: AddObjectSignal): number =>
    {
        return readIntensity(getLightProperties(obj));
    },
    getRange: (obj: AddObjectSignal): number =>
    {
        return readRange(getLightProperties(obj));
    },
    // The same string written back out after being read, which is how a value arriving from
    // anywhere but this file is made safe to store (see ObjectMetadataEntryMap). Reading is total
    // and writing clamps, so the round trip is the whole of the validation.
    canonicalize: (rawLightProperties: string): string =>
    {
        return LampObjectUtil.encodeLightProperties(
            readColorIndex(rawLightProperties),
            readIntensity(rawLightProperties),
            readRange(rawLightProperties));
    },
    encodeLightProperties: (colorIndex: number, intensity: number, range: number): string =>
    {
        const chars: string[] = [];
        chars[COLOR_CHAR_INDEX] = StringUtil.convertRawNumberToVisibleASCII(
            clampToWholeValue(colorIndex, 0, ColorUtil.getPaletteSize(LIGHT_COLOR_PALETTE_NAME) - 1));
        chars[INTENSITY_CHAR_INDEX] = StringUtil.convertRawNumberToVisibleASCII(
            clampToWholeValue(intensity, MIN_LAMP_INTENSITY, MAX_LAMP_INTENSITY));
        chars[RANGE_CHAR_INDEX] = StringUtil.convertRawNumberToVisibleASCII(
            clampToWholeValue(range, MIN_LAMP_RANGE, MAX_LAMP_RANGE));
        return chars.join("");
    },
    getDefaultLightProperties: (): string =>
    {
        return LampObjectUtil.encodeLightProperties(DEFAULT_COLOR_INDEX, DEFAULT_INTENSITY,
            DEFAULT_RANGE);
    },
}

function getLightProperties(obj: AddObjectSignal): string
{
    return obj.metadata[ObjectMetadataKeyEnumMap.LightProperties]?.str ?? "";
}

function readColorIndex(lightProperties: string): number
{
    return readValue(lightProperties, COLOR_CHAR_INDEX, DEFAULT_COLOR_INDEX,
        0, ColorUtil.getPaletteSize(LIGHT_COLOR_PALETTE_NAME) - 1);
}

function readIntensity(lightProperties: string): number
{
    return readValue(lightProperties, INTENSITY_CHAR_INDEX, DEFAULT_INTENSITY,
        MIN_LAMP_INTENSITY, MAX_LAMP_INTENSITY);
}

function readRange(lightProperties: string): number
{
    return readValue(lightProperties, RANGE_CHAR_INDEX, DEFAULT_RANGE,
        MIN_LAMP_RANGE, MAX_LAMP_RANGE);
}

// A stored character addresses far more numbers than any of these settings allows, so what comes
// back is clamped to the setting's own range rather than to the encoding's — a lamp naming a range
// no lamp has is asking for something that does not exist, exactly as one naming a palette entry
// past the end of the palette is.
function readValue(lightProperties: string, charIndex: number, fallback: number, min: number,
    max: number): number
{
    const raw = StringUtil.convertVisibleASCIIToRawNumber(lightProperties, charIndex, fallback);
    return NumUtil.clampInRange(raw, min, max);
}

// Clamping alone leaves NaN as NaN, and the character that comes of that is not one this encoding
// can read back — so anything that is not a number at all is treated as the bottom of the range.
function clampToWholeValue(n: number, min: number, max: number): number
{
    if (!Number.isFinite(n))
        return min;
    return Math.round(NumUtil.clampInRange(n, min, max));
}

export default LampObjectUtil;
