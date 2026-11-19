import FontMetrics from "../types/fontMetrics";

// Text measured from a font file's own tables rather than by the browser, whose measurements of the same font
// differ between engines and platforms. Reads a TrueType or OpenType file (not WOFF) whose character map has
// a format 4 subtable, as a font covering only the BMP does. Kerning is not read, so the font should have none.

// sfnt signatures: TrueType, Apple TrueType, and OpenType with CFF outlines.
const SFNT_SIGNATURES = [0x00010000, 0x74727565, 0x4F54544F];

const REPLACEMENT_CHAR = "�";

const FontMetricsUtil =
{
    parse: (bytes: ArrayBuffer): FontMetrics =>
    {
        const view = new DataView(bytes);
        if (!SFNT_SIGNATURES.includes(view.getUint32(0)))
            throw new Error("FontMetricsUtil :: Not a TrueType or OpenType font");
        const tableOffsets = readTableOffsets(view);
        const getTable = (tag: string) => {
            const offset = tableOffsets.get(tag);
            if (offset == undefined)
                throw new Error(`FontMetricsUtil :: The font has no '${tag}' table`);
            return offset;
        };
        const head = getTable("head");
        const hhea = getTable("hhea");
        const hmtx = getTable("hmtx");

        // Glyphs past the last full metric share its advance.
        const numHMetrics = view.getUint16(hhea + 34);
        const getAdvance = (glyphId: number) => view.getUint16(hmtx + 4 * Math.min(glyphId, numHMetrics - 1));

        const advanceByCodePoint = new Map<number, number>();
        readCharacterMap(view, getTable("cmap"), (codePoint, glyphId) =>
            advanceByCodePoint.set(codePoint, getAdvance(glyphId)));
        return {
            unitsPerEm: view.getUint16(head + 18),
            ascent: view.getInt16(hhea + 4),
            descent: -view.getInt16(hhea + 6),
            advanceByCodePoint,
            missingAdvance: getAdvance(0),
        };
    },
    // In ems. Summed in the font's units (integers) before dividing, so every engine gets the same result.
    measureWidth: (metrics: FontMetrics, str: string): number =>
    {
        let width = 0;
        for (const char of str)
            width += metrics.advanceByCodePoint.get(char.codePointAt(0)!) ?? metrics.missingAdvance;
        return width / metrics.unitsPerEm;
    },
    // The text as the font can draw it: composed first (e.g. "e" and a combining accent as "é"), then every
    // character it lacks as U+FFFD. Whitespace is kept, being for the layout to read.
    replaceMissingChars: (metrics: FontMetrics, text: string): string =>
    {
        return Array.from(text.normalize("NFC"), char =>
            (metrics.advanceByCodePoint.has(char.codePointAt(0)!) || /\s/.test(char)) ? char : REPLACEMENT_CHAR)
            .join("");
    },
}

function readTableOffsets(view: DataView): Map<string, number>
{
    const offsets = new Map<string, number>();
    const numTables = view.getUint16(4);
    for (let i = 0; i < numTables; ++i)
    {
        const record = 12 + 16 * i;
        const tag = String.fromCharCode(view.getUint8(record), view.getUint8(record + 1),
            view.getUint8(record + 2), view.getUint8(record + 3));
        offsets.set(tag, view.getUint32(record + 8));
    }
    return offsets;
}

// Every mapped code point in the Unicode BMP subtable, with its glyph (never .notdef).
function readCharacterMap(view: DataView, cmap: number, onMapping: (codePoint: number, glyphId: number) => void)
{
    const numSubtables = view.getUint16(cmap + 2);
    for (let i = 0; i < numSubtables; ++i)
    {
        const record = cmap + 4 + 8 * i;
        const platformId = view.getUint16(record);
        const encodingId = view.getUint16(record + 2);
        const subtable = cmap + view.getUint32(record + 4);
        const isUnicode = platformId == 0 || (platformId == 3 && encodingId == 1);
        if (isUnicode && view.getUint16(subtable) == 4)
        {
            readFormat4(view, subtable, onMapping);
            return;
        }
    }
    throw new Error("FontMetricsUtil :: The font has no Unicode BMP character map (format 4)");
}

// Segments of consecutive code points, each mapped by an offset or through a glyph array.
function readFormat4(view: DataView, subtable: number, onMapping: (codePoint: number, glyphId: number) => void)
{
    const numSegments = view.getUint16(subtable + 6) / 2;
    const endCodes = subtable + 14;
    const startCodes = endCodes + 2 * numSegments + 2; // past a reserved pad
    const idDeltas = startCodes + 2 * numSegments;
    const idRangeOffsets = idDeltas + 2 * numSegments;
    for (let i = 0; i < numSegments; ++i)
    {
        const start = view.getUint16(startCodes + 2 * i);
        const end = view.getUint16(endCodes + 2 * i);
        const idDelta = view.getUint16(idDeltas + 2 * i);
        // Relative to where the offset itself is stored.
        const idRangeOffsetPos = idRangeOffsets + 2 * i;
        const idRangeOffset = view.getUint16(idRangeOffsetPos);
        for (let codePoint = start; codePoint <= end && codePoint != 0xFFFF; ++codePoint)
        {
            let glyphId = codePoint;
            if (idRangeOffset != 0)
            {
                glyphId = view.getUint16(idRangeOffsetPos + idRangeOffset + 2 * (codePoint - start));
                if (glyphId == 0)
                    continue;
            }
            glyphId = (glyphId + idDelta) & 0xFFFF;
            if (glyphId != 0)
                onMapping(codePoint, glyphId);
        }
    }
}

export default FontMetricsUtil;
