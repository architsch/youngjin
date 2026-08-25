import RandomNumberGenerator from "../../../../../math/types/randomNumberGenerator";
import RoomPaletteMap from "../../../maps/roomPaletteMap";
import RoomPalette from "../../roomPalette";

//------------------------------------------------------------------------
// Decides what a procedurally generated room is finished in: the texture
// pack it is built out of, and which of that pack's palettes each of its
// areas wears.
//
// A voxel texture index is a position within one specific pack's atlas
// rather than a material, so the pack has to be drawn alongside the
// palettes picked against it - a palette means nothing without its pack.
// Everything else in generation asks for whole palettes and never for
// individual textures, which is what makes each area read as a
// deliberately decorated space rather than a patchwork.
//------------------------------------------------------------------------

export default class RoomPaletteSelector
{
    private palettes: RoomPalette[] = [];
    private nextIndex = 0;

    // Draws the pack this room is built in, together with the palettes hand-picked against it, and
    // hands back the pack for the caller to write onto the room.
    pickTexturePack(rand: RandomNumberGenerator): string
    {
        const {texturePackPath, palettes} = RoomPaletteMap.pickRandomTexturePack(rand);
        this.palettes = palettes;
        this.nextIndex = 0;
        return texturePackPath;
    }

    // The palettes are handed out in turn rather than drawn, so that neighbouring areas come out
    // finished differently from each other for as long as the pack has palettes left to give.
    next(): RoomPalette
    {
        const palette = this.palettes[this.nextIndex % this.palettes.length];
        ++this.nextIndex;
        return palette;
    }
}
