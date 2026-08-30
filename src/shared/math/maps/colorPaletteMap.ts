export type ColorPaletteName = string;

// The sets of colors anything in the game may be finished in. A color is never stored as a color:
// it is stored as a position in one of these, which is what lets a whole appearance travel in a
// handful of characters (see the composition codecs). Two consequences follow, and both matter:
//
//   - **A palette's contents and their order are what every appearance already stored means.**
//     Reordering one, or dropping an entry out of the middle of it, repaints everything saved
//     against it. Entries are therefore appended, never rearranged.
//   - **A palette is answerable to what is finished in it.** One palette for the whole game sounds
//     tidy and is not: the colors a toy is painted in and the colors a door is finished in barely
//     overlap, so a shared palette is one where most of what is offered is unusable whichever of
//     the two is being painted.
//
// A position is encoded as one visible-ASCII character, so no palette may hold more than 94 entries.

// The full-range set: every hue, at the strength a child's toy is painted in. Two palettes below are
// stocked from it, because two unrelated things happen to want the whole spectrum — and each keeps
// its own copy, so that a color added for one of them is never quietly added to the other.
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
    // The player's. A character is a tin toy, lithographed in the colors a child's toy is painted
    // in, so this runs to pure and vivid hues — and it is the general-purpose set besides, being
    // the only one the game had before it had another.
    "Player": [...FULL_SPECTRUM_COLORS],
    // Joinery: what a door, a fence or a piece of furniture is actually finished in. Bare timber,
    // the paints that were mixed to go on timber, and the metal and bone tones a knob, a plate or a
    // hinge takes.
    //
    // Everything here keeps to the middle of the brightness range and well back from full
    // saturation, which is a requirement of the material it is seen through rather than a matter of
    // taste: the moulded-timber material ages a color before anything is lit — warming it and
    // pulling its saturation back — and then the figure and the carving each take more off it
    // again. A finish that starts dark arrives as a black rectangle with neither grain nor joinery
    // visible in it, and one that starts at the top of the range washes out and takes the
    // mouldings' shading with it. See @docs/geometry/door_design.md .
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
    ],
    // Lettering: the color the text written on an object is drawn in (see the LabelText component).
    // The whole spectrum, because ink is not a finish — a plate can be painted any color a door is,
    // and what has to be picked here is whatever reads against the one it was given. It is its own
    // palette rather than a second use of the player's for the same reason the timber set exists:
    // what a set of colors is answerable to is what is painted in it.
    "LabelColor": [...FULL_SPECTRUM_COLORS],
}
