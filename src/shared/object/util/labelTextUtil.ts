import ColorUtil from "../../math/util/colorUtil";
import NumUtil from "../../math/util/numUtil";
import StringUtil from "../../math/util/stringUtil";
import { LABEL_COLOR_PALETTE_NAME } from "../../system/sharedConstants";
import AddObjectSignal from "../types/addObjectSignal";
import { ObjectMetadataKeyEnumMap } from "../types/objectMetadataKey";
import ObjectTypeConfigMap from "../maps/objectTypeConfigMap";

// Font sizes are label atlas pixels, so one size looks the same on every label (see
// LABEL_PIXELS_PER_WORLD_UNIT).
const MIN_FONT_SIZE = 16;
const MAX_FONT_SIZE = 256;
const FONT_SIZE_STEP = 8;
const NUM_FONT_SIZE_STEPS = Math.round((MAX_FONT_SIZE - MIN_FONT_SIZE) / FONT_SIZE_STEP) + 1;
const DEFAULT_FONT_SIZE = 64;

// Character positions in the stored LabelFont string; never reorder.
const FLAGS_CHAR_INDEX = 0;
const FONT_SIZE_CHAR_INDEX = 1;

const AUTO_SIZE_FLAG = 1;

// What an object with LabelText shows, read from its metadata. The font is one stored string (flags, then
// a size step), and decoding is total: nothing stored means Auto Size, and a size out of range clamps.
const LabelTextUtil =
{
    minFontSize: MIN_FONT_SIZE,
    maxFontSize: MAX_FONT_SIZE,
    fontSizeStep: FONT_SIZE_STEP,

    getText: (obj: AddObjectSignal): string =>
    {
        return obj.metadata[ObjectMetadataKeyEnumMap.Label]?.str ?? "";
    },
    // The ink's palette index, defaulting to the nearest match for the type's default color (so the
    // picker opens on the color actually shown).
    getColorIndex: (obj: AddObjectSignal): number =>
    {
        const stored = obj.metadata[ObjectMetadataKeyEnumMap.LabelColor]?.str;
        if (stored != undefined && stored.length > 0)
        {
            const index = parseInt(stored);
            if (!isNaN(index))
                return index;
        }
        const configuredHex = ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex)
            .components.spawnedByAny?.labelText?.defaultFontColorHex;
        return ColorUtil.rgbToPaletteIndex(LABEL_COLOR_PALETTE_NAME,
            ColorUtil.hexToRGB(configuredHex ?? "#000000"));
    },
    getFont: (obj: AddObjectSignal): {autoSize: boolean, fontSize: number} =>
    {
        return decodeFont(obj.metadata[ObjectMetadataKeyEnumMap.LabelFont]?.str ?? "");
    },
    encodeFont,
    // Decode + encode round trip is the whole validation (see ObjectMetadataEntryMap).
    canonicalizeFont: (rawFont: string): string =>
    {
        const {autoSize, fontSize} = decodeFont(rawFont);
        return encodeFont(autoSize, fontSize);
    },
}

function encodeFont(autoSize: boolean, fontSize: number): string
{
    const chars: string[] = [];
    chars[FLAGS_CHAR_INDEX] = StringUtil.convertRawNumberToVisibleASCII(autoSize ? AUTO_SIZE_FLAG : 0);
    chars[FONT_SIZE_CHAR_INDEX] = StringUtil.convertRawNumberToVisibleASCII(toFontSizeStep(fontSize));
    return chars.join("");
}

function decodeFont(font: string): {autoSize: boolean, fontSize: number}
{
    const flags = StringUtil.convertVisibleASCIIToRawNumber(font, FLAGS_CHAR_INDEX, AUTO_SIZE_FLAG);
    const step = StringUtil.convertVisibleASCIIToRawNumber(font, FONT_SIZE_CHAR_INDEX,
        toFontSizeStep(DEFAULT_FONT_SIZE));
    return {
        autoSize: (flags & AUTO_SIZE_FLAG) != 0,
        fontSize: MIN_FONT_SIZE + NumUtil.clampInRange(step, 0, NUM_FONT_SIZE_STEPS - 1) * FONT_SIZE_STEP,
    };
}

// NaN becomes the smallest size (clamping alone keeps NaN).
function toFontSizeStep(fontSize: number): number
{
    const step = Math.round((fontSize - MIN_FONT_SIZE) / FONT_SIZE_STEP);
    return Number.isFinite(step) ? NumUtil.clampInRange(step, 0, NUM_FONT_SIZE_STEPS - 1) : 0;
}

export default LabelTextUtil;
