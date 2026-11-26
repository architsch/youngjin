export type EmissiveEyeStyle = number;

// How a face's eyes are drawn (see EmissiveGlyph), as the shader reads them, so never renumbered.
export const EmissiveEyeStyleEnumMap: Record<string, EmissiveEyeStyle> =
{
    Round: 0,
    // Cut aslant from above, each lower toward the other: a scowl.
    Slanted: 1,
    // An "X" each.
    Crossed: 2,
}
