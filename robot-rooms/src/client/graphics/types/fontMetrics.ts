// What FontMetricsUtil reads from a font file, in the font's own units.
export default interface FontMetrics
{
    unitsPerEm: number;
    ascent: number; // Above the baseline
    descent: number; // Below the baseline, positive
    advanceByCodePoint: Map<number, number>;
    missingAdvance: number; // A character the font lacks is measured as its .notdef glyph
}
