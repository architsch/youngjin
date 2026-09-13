import RoomPalette from "../roomPalette";

// Candidate packs and palettes for a room. More candidates give more varied decoration; one of each
// gives a plain room (the same mechanism, so downstream code doesn't distinguish).
type RoomPaletteSelectionParams = {
    // The packs the room may be built in. One of them is drawn, and the room is finished in it.
    texturePackPaths: string[],

    // Handed out in random order. Empty means the pack's curated palettes, the only way to allow a
    // random pack, since palettes are positions within a specific atlas.
    palettes: RoomPalette[],
}

export default RoomPaletteSelectionParams;
