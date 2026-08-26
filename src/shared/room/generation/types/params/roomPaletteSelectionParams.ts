import RoomPalette from "../roomPalette";

// What a procedurally generated room is allowed to be finished in. A room does not choose its own
// look: it is handed the candidates it may draw from, and how much decoration it ends up wearing
// falls out of how many it was given. A room offered every pack the game ships comes out decorated
// differently from every other; a room offered one pack and one palette comes out the same way
// every time, plain throughout.
//
// That is the whole of the mechanism - there is no separate way of finishing a room plainly, only a
// shorter list to finish it from - which is what keeps everything downstream from having to know
// which kind of room it is working on.
type RoomPaletteSelectionParams = {
    // The packs the room may be built in. One of them is drawn, and the room is finished in it.
    texturePackPaths: string[],

    // The palettes its areas may wear, handed out in a random order so that neighbours come out
    // finished differently from one another for as long as the list holds out.
    //
    // Leaving this empty asks for whichever palettes were hand-picked for the pack that was drawn.
    // That is the only way to ask for a pack at random: a palette is a set of positions within one
    // specific atlas, so a list written out here means nothing except alongside a known pack.
    palettes: RoomPalette[],
}

export default RoomPaletteSelectionParams;
