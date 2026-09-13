import RandomNumberGenerator from "../../../../../math/types/randomNumberGenerator";
import RoomPaletteMap from "../../../maps/roomPaletteMap";
import RoomPaletteSelectionParams from "../../params/roomPaletteSelectionParams";
import RoomPalette from "../../roomPalette";

// Chooses the texture pack and hands out whole palettes to areas. A texture index only means something
// within its pack, so pack and palettes are chosen together. The candidates come from the room's
// RoomPaletteSelectionParams; a plain room is just a single-candidate selection.

export default class RoomPaletteSelector
{
    private palettes: RoomPalette[] = [];
    private nextIndex = 0;

    // Chooses the pack (returned for the room) and prepares its palettes.
    init(rand: RandomNumberGenerator, params: RoomPaletteSelectionParams): string
    {
        const texturePackPath = rand.pick(params.texturePackPaths);
        const candidates = params.palettes.length > 0
            ? params.palettes : RoomPaletteMap.getPalettes(texturePackPath);

        // Shuffled copy, so each room gets a different order without mutating the declared params.
        this.palettes = rand.shuffle(candidates.slice());
        this.nextIndex = 0;
        return texturePackPath;
    }

    // Round-robin, so neighbouring areas differ while palettes last.
    next(): RoomPalette
    {
        const palette = this.palettes[this.nextIndex % this.palettes.length];
        ++this.nextIndex;
        return palette;
    }
}
