import ColorUtil from "../../math/util/colorUtil";
import NumUtil from "../../math/util/numUtil";
import StringUtil from "../../math/util/stringUtil";
import HTMLUtil from "../../math/util/htmlUtil";
import HTMLTag from "../../math/types/htmlTag";
import { LABEL_COLOR_PALETTE_NAME } from "../../system/sharedConstants";
import AddObjectSignal from "../types/addObjectSignal";
import LabelTextSpan from "../types/labelTextSpan";
import LabelTextStyle from "../types/labelTextStyle";
import { ObjectMetadataKeyEnumMap } from "../types/objectMetadataKey";
import ObjectTypeConfigMap from "../maps/objectTypeConfigMap";

// The font sizes on offer, in label atlas pixels, so one size looks the same on every label (see
// LABEL_PIXELS_PER_WORLD_UNIT). Spaced by ratio, as sizes are told apart. Stored by position, so changing
// the list takes an ObjectGroup migration.
const FONT_SIZES: readonly number[] = [16, 20, 24, 28, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 256];
const DEFAULT_FONT_SIZE_INDEX = FONT_SIZES.indexOf(64);

// Character positions in the stored LabelFont string; never reorder.
const FLAGS_CHAR_INDEX = 0;
const FONT_SIZE_CHAR_INDEX = 1;

const AUTO_SIZE_FLAG = 1;

// The tags a label's text may be styled with, and the attributes each one reads (see HTMLUtil.parse).
const MARKUP_ATTRIBUTES_BY_TAG = {b: [], i: [], u: [], s: [], font: ["size", "face"]};

// <font size> levels 1-7, 3 being the text's own size, scaled as browsers draw them.
const FONT_SIZE_LEVEL_SCALES = [0.625, 0.8125, 1, 1.125, 1.5, 2, 3];
const DEFAULT_FONT_SIZE_LEVEL = 3;

const FONT_FACES: readonly LabelTextStyle["fontFace"][] = ["serif", "sans-serif", "monospace"];

const PLAIN_STYLE: LabelTextStyle = {bold: false, italic: false, underline: false, strikethrough: false,
    scale: 1, fontFace: "serif"};

// What an object with LabelText shows, read from its metadata. The font is one stored string (flags, then
// a size's position in FONT_SIZES), and decoding is total: nothing stored means Auto Size, and a position
// out of range clamps.
const LabelTextUtil =
{
    fontSizes: FONT_SIZES,

    getText: (obj: AddObjectSignal): string =>
    {
        return obj.metadata[ObjectMetadataKeyEnumMap.Label]?.str ?? "";
    },
    // The text as drawn: its markup read into styled runs, in order.
    parseText: (text: string): LabelTextSpan[] =>
    {
        return HTMLUtil.parse(text, MARKUP_ATTRIBUTES_BY_TAG).map(run =>
            ({text: run.text, style: run.tags.reduce(applyTag, PLAIN_STYLE)}));
    },
    // The text as read, which is what a door is looked up by: no markup, and any run of whitespace (a line
    // break included) one space.
    toName: (text: string): string =>
    {
        return HTMLUtil.parse(text, MARKUP_ATTRIBUTES_BY_TAG).map(run => run.text).join("")
            .replace(/\s+/g, " ").trim();
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
    // Any size is stored as the nearest one on offer.
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
    chars[FONT_SIZE_CHAR_INDEX] = StringUtil.convertRawNumberToVisibleASCII(toFontSizeIndex(fontSize));
    return chars.join("");
}

function decodeFont(font: string): {autoSize: boolean, fontSize: number}
{
    const flags = StringUtil.convertVisibleASCIIToRawNumber(font, FLAGS_CHAR_INDEX, AUTO_SIZE_FLAG);
    const index = StringUtil.convertVisibleASCIIToRawNumber(font, FONT_SIZE_CHAR_INDEX,
        DEFAULT_FONT_SIZE_INDEX);
    return {
        autoSize: (flags & AUTO_SIZE_FLAG) != 0,
        fontSize: FONT_SIZES[NumUtil.clampInRange(index, 0, FONT_SIZES.length - 1)],
    };
}

// The nearest size on offer by ratio. NaN becomes the smallest (clamping alone keeps NaN).
function toFontSizeIndex(fontSize: number): number
{
    if (Number.isNaN(fontSize))
        return 0;
    const size = NumUtil.clampInRange(fontSize, FONT_SIZES[0], FONT_SIZES[FONT_SIZES.length - 1]);
    let nearest = 0;
    for (let i = 1; i < FONT_SIZES.length; ++i)
    {
        if (Math.abs(Math.log(size / FONT_SIZES[i])) < Math.abs(Math.log(size / FONT_SIZES[nearest])))
            nearest = i;
    }
    return nearest;
}

function applyTag(style: LabelTextStyle, tag: HTMLTag): LabelTextStyle
{
    switch (tag.name)
    {
        case "b": return {...style, bold: true};
        case "i": return {...style, italic: true};
        case "u": return {...style, underline: true};
        case "s": return {...style, strikethrough: true};
        case "font":
        {
            const level = parseFontSizeLevel(tag.attributes.size);
            const face = tag.attributes.face?.trim().toLowerCase();
            return {
                ...style,
                scale: (level != undefined) ? FONT_SIZE_LEVEL_SCALES[level - 1] : style.scale,
                fontFace: FONT_FACES.find(fontFace => fontFace === face) ?? style.fontFace,
            };
        }
        default: return style;
    }
}

// As browsers read <font size>: a level, or one relative to the default with a sign, clamped to the levels.
function parseFontSizeLevel(size: string | undefined): number | undefined
{
    const match = /^\s*([+-]?)(\d+)/.exec(size ?? "");
    if (match == null)
        return undefined;
    const n = parseInt(match[2]);
    const level = (match[1] == "+") ? DEFAULT_FONT_SIZE_LEVEL + n
        : (match[1] == "-") ? DEFAULT_FONT_SIZE_LEVEL - n
        : n;
    return NumUtil.clampInRange(level, 1, FONT_SIZE_LEVEL_SCALES.length);
}

export default LabelTextUtil;
