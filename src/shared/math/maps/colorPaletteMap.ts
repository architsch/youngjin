export type ColorPaletteName = string;

// Palettes. Colors are stored as palette positions (one visible-ASCII character, so at most 94 entries).
// - Entries are only ever appended: reordering or removing one repaints every stored appearance, unless
//   every stored position is migrated with it (see LightPaletteVersionMigration,
//   AtmospherePaletteVersionMigration).
// - Each palette suits what is painted with it (toys and doors barely share colors).

// Full-spectrum set; palettes copy it so additions to one never leak into another.
const FULL_SPECTRUM_COLORS: string[] = [
    // Neutrals and warm off-whites: only the few gray steps that read as distinct
    "#000000", "#2a2a2a", "#979797", "#ffffff", "#f5e69f", "#c6b492",
    // Earth tones
    "#877666", "#622001", "#754921", "#ac4e00", "#cc903e", "#879000",
    // Reds and pinks
    "#95002d", "#ce0048", "#ff0324", "#ff715b", "#fdc3c7", "#fc38ab",
    // Oranges and yellows
    "#d86100", "#ff9e00", "#dec900", "#f5ff05", "#9bfe00", "#86c53a",
    // Greens
    "#006903", "#00ac0b", "#0a8a49", "#00ec63", "#9ce9a1", "#00d5b9",
    // Teals and cyans
    "#165258", "#009d9f", "#00f9fd", "#00b8de", "#82ccfd", "#bfe6f4",
    // Blues
    "#070081", "#0905ff", "#008bfe", "#516e9b", "#96a3f1", "#dbaef2",
    // Purples and magentas
    "#5700a3", "#8600ff", "#b76bec", "#a1009c", "#ec00fc", "#fa75ff",
];

export const ColorPaletteMap: {[colorPaletteName: ColorPaletteName]: string[]} =
{
    // Tin-toy colors: a character's, and a fan's.
    "Player": [...FULL_SPECTRUM_COLORS],
    // Joinery (doors, canvas frames, furniture): timber, joinery paints, metal and bone. Mostly mid-brightness because the
    // moulded-timber material ages colors (see @docs/geometry/door_design.md). The vivid bands appended
    // later compensate for that aging, which would otherwise make muted colors read as uniform brown.
    "Timber": [
        // Bare and stained timber, light to dark
        "#e0cbab", "#d8b98b", "#c8a271", "#b98b56", "#a87545",
        "#96603a", "#845433", "#71452b", "#5e3a26", "#4d2f21",
        // Painted joinery: creams, putties and greys
        "#e6dcc8", "#d5cdb6", "#bdb59d", "#a29b86", "#87816f", "#6b6659",
        // Painted joinery: the muted greens and blues a door was put in
        "#8f9a80", "#74856b", "#5c6f57", "#7d8f9c", "#647684", "#4e5d69",
        // Painted joinery: the muted reds and ochres
        "#9c7f74", "#8a5f56", "#6f4642", "#a89263", "#8a7548", "#6d5b36",
        // Metal and bone: knobs, plates, escutcheons
        "#c9a227", "#a98a3f", "#8a7346", "#9a9a97", "#7a7a78", "#5c5c5a",
        "#f0e7d2", "#ded2b8",
        //
        // Appended entries below (never rearrange).
        //
        // Painted joinery: twelve commonly painted hues (chartreuse/lime skipped) at three strengths.
        //
        // Bright: a door painted a light, clear color
        "#de5454", "#de8d54", "#debc54", "#d3de54", "#82de54", "#54de99",
        "#54ded3", "#54b0de", "#5482de", "#6b54de", "#bc54de", "#de54b0",
        // Vivid: the same twelve at full strength, which is where most painted joinery sits
        "#ce1c1c", "#ce661c", "#cea21c", "#c0ce1c", "#58ce1c", "#1cce75",
        "#1ccec0", "#1c93ce", "#1c58ce", "#3a1cce", "#a21cce", "#ce1c93",
        // Deep: saturated but dark, still above where the grain stops reading
        "#8b1818", "#8b4818", "#8b6e18", "#818b18", "#3f8b18", "#188b52",
        "#188b81", "#18658b", "#183f8b", "#2c188b", "#6e188b", "#8b1865",
        // Named real-world paint and metal finishes.
        "#c8102e", "#6b2233", "#c05621", "#d4a017", // pillar box, oxblood, burnt orange, mustard
        "#6b7f2e", "#1f4a2c", "#3f8f7a", "#1f7a7a", // olive, racing green, verdigris, teal
        "#1b4fa0", "#1c3b57", "#7a3b62", "#4a2545", // cobalt, prussian, plum, aubergine
        // Neutrals, black to white, around the metal greys above.
        "#000000", "#1a1a1a", "#333333", "#4d4d4d", "#b3b3b3", "#cccccc", "#e6e6e6", "#ffffff",
    ],
    // Label ink (see LabelText): the full spectrum, so it can contrast with any plate color.
    "LabelColor": [...FULL_SPECTRUM_COLORS],
    // Light colors (lamps, ambient, head light). Index 0 is white, which unconfigured rooms read back.
    // All entries are full brightness (hue and tint only), since strength is a separate setting and
    // light can only add. Few and far apart, roughly palest to most saturated.
    "Light": [
        "#ffffff", "#ffd5aa", "#fff2e5", "#ff93ff",
        "#ffffc2", "#c2ffc2", "#c2ffff", "#c2e0ff",
        "#c2c2ff", "#ffc2ff", "#ffb56b", "#6b6bff",
        "#b56bff", "#ff8000", "#ffff00", "#ccff7b",
        "#00ff00", "#74c9ff", "#00ffff", "#0080ff",
        "#0000ff", "#8000ff", "#ff00ff", "#ff0080",
    ],
    // A room's atmosphere: its fog (also the void past the walls), sky, clouds and ground. Tin's colors, then the
    // light colors unlike any of tin's, so the air can take a light's hue. Index 0 is black, which unconfigured
    // rooms' fog reads back.
    "Atmosphere": [
        // Tin's (see "Player")
        "#000000", "#2a2a2a", "#979797", "#ffffff", "#f5e69f", "#c6b492",
        "#877666", "#622001", "#754921", "#ac4e00", "#cc903e", "#879000",
        "#95002d", "#ce0048", "#ff0324", "#ff715b", "#fdc3c7", "#fc38ab",
        "#d86100", "#ff9e00", "#dec900", "#f5ff05", "#9bfe00", "#86c53a",
        "#006903", "#00ac0b", "#0a8a49", "#00ec63", "#9ce9a1", "#00d5b9",
        "#165258", "#009d9f", "#00f9fd", "#00b8de", "#82ccfd", "#bfe6f4",
        "#070081", "#0905ff", "#008bfe", "#516e9b", "#96a3f1", "#dbaef2",
        "#5700a3", "#8600ff", "#b76bec", "#a1009c", "#ec00fc", "#fa75ff",
        // The light colors (see "Light") but its white and those a tin color looks the same as at a glance
        "#ffd5aa", "#fff2e5", "#ff93ff",
        "#ffffc2", "#c2ffc2", "#c2ffff", "#c2e0ff",
        "#c2c2ff", "#ffc2ff", "#ffb56b", "#6b6bff",
        "#ff8000", "#ccff7b", "#00ff00", "#ff0080",
    ],
    // Instance-colored parts' colors (see COMPOSITION_PALETTE_NAME_BY_MATERIAL_ID). Full range; saturation peaks
    // mid-brightness.
    "Scenery": [
        // Neutrals, black to white
        "#000000", "#1a1a1a", "#333333", "#4d4d4d", "#666666", "#808080",
        "#999999", "#b3b3b3", "#cccccc", "#e6e6e6", "#ffffff",
        // Deep
        "#5f1c1c", "#5f3d1c", "#5f5f1c", "#3d5f1c", "#1c5f1c", "#1c5f3d",
        "#1c5f5f", "#1c3d5f", "#1c1c5f", "#3d1c5f", "#5f1c5f", "#5f1c3d",
        // Shade
        "#a52727", "#a56627", "#a5a527", "#66a527", "#27a527", "#27a566",
        "#27a5a5", "#2766a5", "#2727a5", "#6627a5", "#a527a5", "#a52766",
        // Mid
        "#d84141", "#d88c41", "#d8d841", "#8cd841", "#41d841", "#41d88c",
        "#41d8d8", "#418cd8", "#4141d8", "#8c41d8", "#d841d8", "#d8418c",
        // Light
        "#e08585", "#e0b285", "#e0e085", "#b3e085", "#85e085", "#85e0b3",
        "#85e0e0", "#85b2e0", "#8585e0", "#b285e0", "#e085e0", "#e085b3",
        // Pale
        "#eac3c3", "#ead6c3", "#eaeac3", "#d6eac3", "#c3eac3", "#c3ead6",
        "#c3eaea", "#c3d6ea", "#c3c3ea", "#d6c3ea", "#eac3ea", "#eac3d6",
    ],
}
