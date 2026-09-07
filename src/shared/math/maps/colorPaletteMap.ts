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
    // Everything here keeps to the middle of the brightness range, which is a requirement of the
    // material it is seen through rather than a matter of taste: the moulded-timber material ages a
    // color before anything is lit — warming it and pulling its saturation back — and then the
    // figure and the carving each take more off it again. A finish that starts dark arrives as a
    // black rectangle with neither grain nor joinery visible in it, and one that starts at the top
    // of the range washes out and takes the mouldings' shading with it.
    // See @docs/geometry/door_design.md .
    //
    // What that requirement does *not* demand is muted color, which is where the first half of this
    // palette went too far: the material's own aging is what makes a finish look like paint on
    // timber, so a color chosen already muted arrives twice-muted and the whole set reads as one
    // brown door in thirty shades. The vibrant bands appended below are the correction. They start
    // well up the saturation range precisely because they are going to lose some of it on the way
    // through the material — they are painted joinery rather than bare wood, and a door somebody
    // painted is allowed to have been painted a color.
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
        // Everything below is appended, never rearranged — see this file's opening note.
        //
        // Painted joinery in earnest, at three strengths of the same twelve hues. The hues are the
        // ones something actually gets painted rather than an even wheel: the chartreuse and lime
        // region is skipped, since nothing is finished in it and offering it would spend three
        // choices on colors that only ever look like a mistake.
        //
        // Bright: a door painted a light, clear color
        "#de5454", "#de8d54", "#debc54", "#d3de54", "#82de54", "#54de99",
        "#54ded3", "#54b0de", "#5482de", "#6b54de", "#bc54de", "#de54b0",
        // Vivid: the same twelve at full strength, which is where most painted joinery sits
        "#ce1c1c", "#ce661c", "#cea21c", "#c0ce1c", "#58ce1c", "#1cce75",
        "#1ccec0", "#1c93ce", "#1c58ce", "#3a1cce", "#a21cce", "#ce1c93",
        // Deep: saturated but dark — kept above the point where the grain stops reading, which is
        // what the note above is about
        "#8b1818", "#8b4818", "#8b6e18", "#818b18", "#3f8b18", "#188b52",
        "#188b81", "#18658b", "#183f8b", "#2c188b", "#6e188b", "#8b1865",
        // Finishes with names, which fall between the steps of any wheel: the paints and metals a
        // real piece of joinery is actually specified in.
        "#c8102e", "#6b2233", "#c05621", "#d4a017", // pillar box, oxblood, burnt orange, mustard
        "#6b7f2e", "#1f4a2c", "#3f8f7a", "#1f7a7a", // olive, racing green, verdigris, teal
        "#1b4fa0", "#1c3b57", "#7a3b62", "#4a2545", // cobalt, prussian, plum, aubergine
    ],
    // Lettering: the color the text written on an object is drawn in (see the LabelText component).
    // The whole spectrum, because ink is not a finish — a plate can be painted any color a door is,
    // and what has to be picked here is whatever reads against the one it was given. It is its own
    // palette rather than a second use of the player's for the same reason the timber set exists:
    // what a set of colors is answerable to is what is painted in it.
    "LabelColor": [...FULL_SPECTRUM_COLORS],
    // Light: what a lamp, or the light filling a room, is the color of. Not a finish at all — this
    // is what falls on a finish, which is why it is nothing like the palettes above.
    //
    // **Index 0 is plain white, and that is load-bearing**: a room that has never been configured
    // stores no color at all and is read back at index 0, so white here is what makes an untouched
    // room look exactly as it did before rooms could be lit (see RoomPrefsUtil).
    //
    // **Nothing in it is a dimmed version of anything else.** Every entry sits at the top of the
    // brightness range — a hue and a strength of tint, never a degree of darkness — because what is
    // being picked here is what a light *is*, while how much of it there is is a dial standing
    // beside it in every one of the three places this set is read: a lamp's strength, a room's
    // ambient strength, and the head lamp's power. A darker entry is that dial spelled a second
    // time and spelled worse, since it cannot reach nothing the way the dial can, and a fitting
    // painted dark cannot be told from one somebody turned down. It is also not a thing a room can
    // honour: light is only ever added to what is already there, so the darkest entry such a set
    // could hold would still darken nothing (see LightBlockMap) — it would only be a lamp that
    // fails to light, which is what LampObjectUtil refuses to let one arrive as.
    //
    // This palette is far longer than the ones above, and deliberately holds colors that are hard
    // to tell apart in a swatch grid. That is the opposite of the rule everywhere else, and the
    // reason is what is being chosen: a finish is picked by looking at the swatch, so two similar
    // swatches are one wasted choice — while a light is judged by what a whole room looks like
    // under it, where the difference between two neighbouring temperatures is the difference
    // between afternoon and evening. Offering few is what would be wrong here.
    //
    // It runs in bands: the identity, the temperatures warm to cool, then the hue wheel at six
    // strengths of tint. The temperatures are barely tinted, because light of a temperature is not
    // seen as colored — a room lit warm reads as a warm room rather than an orange one — and they
    // are the sliver of the gamut around white that the wheel is far too coarse to resolve. The
    // hues are the opposite case: a colored lamp is meant to be seen as colored.
    //
    // Twelve hues is what the encoding leaves room for once the temperatures have their share,
    // since a palette holds at most 94 and every strength of tint costs a full turn of the wheel.
    // Offering more hues would mean offering fewer strengths, and that is the wrong way round: two
    // neighbouring hues at the same strength light a room almost identically, while the same hue at
    // two strengths does not.
    "Light": [
        // Plain white — the identity, and the default (see above)
        "#ffffff",
        // Temperatures, warm to cool, in one run: candle and firelight, tungsten, halogen,
        // daylight, overcast, blue hour. Half of the run is warm and only a third of it cool,
        // because a room lit by lamps is lit warm — the distance between a candle and a tungsten
        // bulb is a room's whole mood, where the cool end is one effect with a few steps in it.
        "#ff8220", "#ff8b2d", "#ff943a", "#ff9d46", "#ffa653", "#ffaf60",
        "#ffb46b", "#ffc78f", "#ffd5aa", "#ffe0c0", "#ffe9d3", "#fff2e5",
        "#fffaf5", "#f7f8ff", "#eaefff", "#dbe5ff", "#c8d8ff", "#b3caff",
        // Every hue at six strengths of tint, from a white with a suggestion of color in it to the
        // hue itself. Six rather than the four or five a palette of finishes would get, because the
        // middle of this run is where a colored light is actually usable: a faint one barely tints
        // the room and a pure one floods it, while the steps between are the ones a room gets lit
        // *by*. The steps widen as they climb, since a difference near white is a difference in
        // what the whole room looks like, while a difference near the pure hue is barely a
        // difference at all.
        //
        // Faint
        "#ffe6e6", "#fff2e6", "#ffffe6", "#f2ffe6", "#e6ffe6", "#e6fff2",
        "#e6ffff", "#e6f2ff", "#e6e6ff", "#f2e6ff", "#ffe6ff", "#ffe6f2",
        // Pale
        "#ffc2c2", "#ffe0c2", "#ffffc2", "#e0ffc2", "#c2ffc2", "#c2ffe0",
        "#c2ffff", "#c2e0ff", "#c2c2ff", "#e0c2ff", "#ffc2ff", "#ffc2e0",
        // Soft
        "#ff9999", "#ffcc99", "#ffff99", "#ccff99", "#99ff99", "#99ffcc",
        "#99ffff", "#99ccff", "#9999ff", "#cc99ff", "#ff99ff", "#ff99cc",
        // Colored
        "#ff6b6b", "#ffb56b", "#ffff6b", "#b5ff6b", "#6bff6b", "#6bffb5",
        "#6bffff", "#6bb5ff", "#6b6bff", "#b56bff", "#ff6bff", "#ff6bb5",
        // Strong
        "#ff3838", "#ff9c38", "#ffff38", "#9cff38", "#38ff38", "#38ff9c",
        "#38ffff", "#389cff", "#3838ff", "#9c38ff", "#ff38ff", "#ff389c",
        // Pure
        "#ff0000", "#ff8000", "#ffff00", "#80ff00", "#00ff00", "#00ff80",
        "#00ffff", "#0080ff", "#0000ff", "#8000ff", "#ff00ff", "#ff0080",
    ],
    // Fog: the color the air in a room is, which is also the color everything in it fades into with
    // distance and the color of the void past the far wall (see GraphicsManager).
    //
    // **Index 0 is black, and that is load-bearing** for the same reason white is above: it is what
    // an unconfigured room reads back, and black is what the emptiness beyond a room has always
    // been drawn in. It is long and finely graded for the same reason the light palette is.
    //
    // What is offered is dark before it is anything else. Fog is not a color laid over the room —
    // it is what the room's own colors are replaced by as they recede, so a pale fog is a room that
    // goes white a few paces off, which is a specific and rarely wanted effect rather than the
    // ordinary one. The pale bands are kept to the end for when it is wanted.
    "Fog": [
        // Black — the identity, and the default (see above)
        "#000000",
        // Neutrals, black through to a white-out
        "#0d0d0d", "#1a1a1a", "#292929", "#3b3b3b", "#4f4f4f", "#666666",
        "#808080", "#9e9e9e", "#c2c2c2",
        // Every hue at six strengths, packed toward the dark end rather than spread evenly —
        // which is where fog is actually set. The steps are close together through the near-blacks
        // and the low middle because that is the whole usable range for air somebody wants to see
        // *through*, and one step there changes a room far more than a step among the pale ones
        // does. Saturation falls as brightness rises, since a dark air needs a strong cast to read
        // as anything but black, while a pale one is already close to a white-out.
        //
        // Near-black: a cast on the dark, which is the ordinary case
        "#160808", "#160f08", "#161608", "#0f1608", "#081608", "#08160f",
        "#081616", "#080f16", "#080816", "#0f0816", "#160816", "#16080f",
        // Dark
        "#321515", "#322415", "#323215", "#243215", "#153215", "#153224",
        "#153232", "#152432", "#151532", "#241532", "#321532", "#321524",
        // Dusk
        "#502626", "#503b26", "#505026", "#3b5026", "#265026", "#26503b",
        "#265050", "#263b50", "#262650", "#3b2650", "#502650", "#50263b",
        // Gloom
        "#6f3939", "#6f5439", "#6f6f39", "#546f39", "#396f39", "#396f54",
        "#396f6f", "#39546f", "#39396f", "#54396f", "#6f396f", "#6f3954",
        // Haze
        "#925454", "#927354", "#929254", "#739254", "#549254", "#549273",
        "#549292", "#547392", "#545492", "#735492", "#925492", "#925473",
        // Mist, for when the room is meant to go pale rather than dark
        "#b38989", "#b39e89", "#b3b389", "#9eb389", "#89b389", "#89b39e",
        "#89b3b3", "#899eb3", "#8989b3", "#9e89b3", "#b389b3", "#b3899e",
    ],
    // Scenery: the clouds in the sky past a room, and the land below its horizon.
    //
    // **A separate palette from the fog's, because it is answerable to something else entirely.**
    // Fog is what a room's own colors are *replaced by* as they recede, so its set is dark before it
    // is anything else and gives up saturation as it brightens — a pale, vivid air is a room that
    // goes to a colored white-out a few paces off. Cloud and land are the opposite case: they are
    // masses seen *against* that air, at a distance, and what they need in order to read at all is to
    // differ from it. Drawn from the fog's set they could only ever be a paler or darker version of
    // the air itself, which is most of the way back to having no clouds and no ground.
    //
    // One palette for both, unlike everything else here, because for once the two really are the same
    // question: a distant mass seen against the air wants the same gamut whether it is vapour or
    // rock. What each does with it is where they differ — a room picks two entries for its land and
    // reads the country between them, and one for its weather.
    //
    // Saturation peaks in the middle of the brightness range rather than running flat, because that
    // is where color space has room for it: a near-black and a near-white cannot carry much whatever
    // they are given, and pretending otherwise only produces two bands nobody can tell apart.
    "Scenery": [
        // Neutrals, black through to white in even steps. White is here and is load-bearing — it is
        // the ordinary color of both a cloud and a snowline, and the fog's set never reaches it.
        "#000000", "#1a1a1a", "#333333", "#4d4d4d", "#666666", "#808080",
        "#999999", "#b3b3b3", "#cccccc", "#e6e6e6", "#ffffff",
        // Deep: night cloud, and the dark of a wooded or a drowned country
        "#5f1c1c", "#5f3d1c", "#5f5f1c", "#3d5f1c", "#1c5f1c", "#1c5f3d",
        "#1c5f5f", "#1c3d5f", "#1c1c5f", "#3d1c5f", "#5f1c5f", "#5f1c3d",
        // Shade
        "#a52727", "#a56627", "#a5a527", "#66a527", "#27a527", "#27a566",
        "#27a5a5", "#2766a5", "#2727a5", "#6627a5", "#a527a5", "#a52766",
        // Mid: where a green country and an open water sit
        "#d84141", "#d88c41", "#d8d841", "#8cd841", "#41d841", "#41d88c",
        "#41d8d8", "#418cd8", "#4141d8", "#8c41d8", "#d841d8", "#d8418c",
        // Light
        "#e08585", "#e0b285", "#e0e085", "#b3e085", "#85e085", "#85e0b3",
        "#85e0e0", "#85b2e0", "#8585e0", "#b285e0", "#e085e0", "#e085b3",
        // Pale: the colors weather takes at either end of a day
        "#eac3c3", "#ead6c3", "#eaeac3", "#d6eac3", "#c3eac3", "#c3ead6",
        "#c3eaea", "#c3d6ea", "#c3c3ea", "#d6c3ea", "#eac3ea", "#eac3d6",
    ],
}
