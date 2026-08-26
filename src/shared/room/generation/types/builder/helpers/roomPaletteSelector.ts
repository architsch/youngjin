import RandomNumberGenerator from "../../../../../math/types/randomNumberGenerator";
import RoomPaletteMap from "../../../maps/roomPaletteMap";
import RoomPaletteSelectionParams from "../../params/roomPaletteSelectionParams";
import RoomPalette from "../../roomPalette";

//------------------------------------------------------------------------
// Decides what a procedurally generated room is finished in: the texture
// pack it is built out of, and which palette each of its areas wears.
//
// A voxel texture index is a position within one specific pack's atlas
// rather than a material, so the pack has to be settled alongside the
// palettes picked against it - a palette means nothing without its pack.
// Everything else in generation asks for whole palettes and never for
// individual textures, which is what makes each area read as a
// deliberately decorated space rather than a patchwork.
//
// What the room may draw from is not decided here: it is declared, as a
// room-level parameter like any other. So the same selection covers a
// room decorated pack by pack and a room finished plainly throughout -
// the second is only the first with one candidate of each to draw from,
// and nothing downstream can tell the two apart.
//------------------------------------------------------------------------

export default class RoomPaletteSelector
{
    private palettes: RoomPalette[] = [];
    private nextIndex = 0;

    // Settles the pack this room is built in, together with the palettes to be worn against it, and
    // hands back the pack for the caller to write onto the room.
    init(rand: RandomNumberGenerator, params: RoomPaletteSelectionParams): string
    {
        const texturePackPath = rand.pick(params.texturePackPaths);
        const candidates = params.palettes.length > 0
            ? params.palettes : RoomPaletteMap.getPalettes(texturePackPath);

        // Shuffled rather than drawn from one at a time, so that handing them out in turn below
        // still comes out in a different order for every room. The copy is what keeps the shuffle
        // off the declared parameters, which every room of this kind is built from.
        this.palettes = rand.shuffle(candidates.slice());
        this.nextIndex = 0;
        return texturePackPath;
    }

    // The palettes are handed out in turn rather than drawn, so that neighbouring areas come out
    // finished differently from each other for as long as there are palettes left to give.
    next(): RoomPalette
    {
        const palette = this.palettes[this.nextIndex % this.palettes.length];
        ++this.nextIndex;
        return palette;
    }
}
