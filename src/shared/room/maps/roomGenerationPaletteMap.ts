import RandomNumberGenerator from "../../math/types/randomNumberGenerator";
import RoomGenerationPalette from "../types/roomGeneration/roomGenerationPalette";

// The palettes a procedural generator finishes its regions in, keyed by the voxel texture pack
// they were picked against.
//
// A texture index is a cell position within a pack's atlas, not a material, and every pack puts
// something different at any given position — so a palette means nothing on its own, only
// alongside the pack it belongs to. That is why generation starts by drawing a pack and its
// palettes together, and why a pack with no entry here is one no generated room is ever built in.
// Shipping a new texture pack therefore means curating palettes for it as well; see
// @docs/geometry/room_generation.md .
//
// Each palette is a floor, a ceiling, a wall and an accent texture that read well together, so
// that a region comes out looking like a deliberately decorated space rather than a patchwork.
const palettesByTexturePackPath: {[texturePackPath: string]: RoomGenerationPalette[]} = {
    "default": [
        {floorTextureIndex: 14, ceilingTextureIndex: 47, wallTextureIndex: 45, propTextureIndex: 15}, // marble gallery
        {floorTextureIndex: 16, ceilingTextureIndex: 30, wallTextureIndex: 41, propTextureIndex: 22}, // oak hall
        {floorTextureIndex: 8, ceilingTextureIndex: 34, wallTextureIndex: 43, propTextureIndex: 37}, // stone court
        {floorTextureIndex: 31, ceilingTextureIndex: 47, wallTextureIndex: 40, propTextureIndex: 22}, // brick loft
        {floorTextureIndex: 11, ceilingTextureIndex: 50, wallTextureIndex: 53, propTextureIndex: 14}, // tiled atrium
        {floorTextureIndex: 52, ceilingTextureIndex: 47, wallTextureIndex: 13, propTextureIndex: 15}, // carpeted salon
        {floorTextureIndex: 6, ceilingTextureIndex: 51, wallTextureIndex: 42, propTextureIndex: 47}, // chequered foyer
        {floorTextureIndex: 9, ceilingTextureIndex: 45, wallTextureIndex: 54, propTextureIndex: 55}, // sandstone court
        {floorTextureIndex: 7, ceilingTextureIndex: 59, wallTextureIndex: 57, propTextureIndex: 45}, // walled garden
        {floorTextureIndex: 17, ceilingTextureIndex: 22, wallTextureIndex: 44, propTextureIndex: 15}, // amber study
    ],
    "country": [
        {floorTextureIndex: 24, ceilingTextureIndex: 41, wallTextureIndex: 58, propTextureIndex: 33}, // timbered hall
        {floorTextureIndex: 18, ceilingTextureIndex: 30, wallTextureIndex: 57, propTextureIndex: 16}, // barn
        {floorTextureIndex: 52, ceilingTextureIndex: 47, wallTextureIndex: 50, propTextureIndex: 25}, // stone cottage
        {floorTextureIndex: 26, ceilingTextureIndex: 39, wallTextureIndex: 56, propTextureIndex: 8}, // farmhouse kitchen
        {floorTextureIndex: 7, ceilingTextureIndex: 48, wallTextureIndex: 45, propTextureIndex: 63}, // greenhouse
        {floorTextureIndex: 28, ceilingTextureIndex: 32, wallTextureIndex: 54, propTextureIndex: 62}, // walled yard
        {floorTextureIndex: 29, ceilingTextureIndex: 31, wallTextureIndex: 44, propTextureIndex: 17}, // thatched parlour
        {floorTextureIndex: 53, ceilingTextureIndex: 34, wallTextureIndex: 37, propTextureIndex: 55}, // larder
        {floorTextureIndex: 42, ceilingTextureIndex: 24, wallTextureIndex: 59, propTextureIndex: 20}, // hunting lodge
        {floorTextureIndex: 6, ceilingTextureIndex: 41, wallTextureIndex: 49, propTextureIndex: 23}, // meadow porch
    ],
    "garden": [
        {floorTextureIndex: 61, ceilingTextureIndex: 59, wallTextureIndex: 40, propTextureIndex: 31}, // lawn court
        {floorTextureIndex: 51, ceilingTextureIndex: 18, wallTextureIndex: 2, propTextureIndex: 46}, // stone terrace
        {floorTextureIndex: 45, ceilingTextureIndex: 37, wallTextureIndex: 27, propTextureIndex: 29}, // rose walk
        {floorTextureIndex: 52, ceilingTextureIndex: 15, wallTextureIndex: 0, propTextureIndex: 20}, // cobbled yard
        {floorTextureIndex: 10, ceilingTextureIndex: 50, wallTextureIndex: 9, propTextureIndex: 25}, // conservatory
        {floorTextureIndex: 21, ceilingTextureIndex: 47, wallTextureIndex: 5, propTextureIndex: 26}, // sunflower plot
        {floorTextureIndex: 11, ceilingTextureIndex: 55, wallTextureIndex: 28, propTextureIndex: 14}, // mosaic patio
        {floorTextureIndex: 60, ceilingTextureIndex: 58, wallTextureIndex: 53, propTextureIndex: 35}, // mulch grove
        {floorTextureIndex: 63, ceilingTextureIndex: 38, wallTextureIndex: 48, propTextureIndex: 36}, // rockery
        {floorTextureIndex: 12, ceilingTextureIndex: 4, wallTextureIndex: 3, propTextureIndex: 24}, // wicker pavilion
    ],
    "aqua": [
        {floorTextureIndex: 24, ceilingTextureIndex: 39, wallTextureIndex: 16, propTextureIndex: 2}, // pool hall
        {floorTextureIndex: 8, ceilingTextureIndex: 61, wallTextureIndex: 34, propTextureIndex: 26}, // bath house
        {floorTextureIndex: 29, ceilingTextureIndex: 21, wallTextureIndex: 18, propTextureIndex: 43}, // grotto
        {floorTextureIndex: 3, ceilingTextureIndex: 57, wallTextureIndex: 11, propTextureIndex: 51}, // ice cavern
        {floorTextureIndex: 27, ceilingTextureIndex: 62, wallTextureIndex: 9, propTextureIndex: 5}, // mosaic spa
        {floorTextureIndex: 33, ceilingTextureIndex: 41, wallTextureIndex: 42, propTextureIndex: 40}, // crystal vault
        {floorTextureIndex: 45, ceilingTextureIndex: 56, wallTextureIndex: 17, propTextureIndex: 30}, // tidal court
        {floorTextureIndex: 32, ceilingTextureIndex: 44, wallTextureIndex: 35, propTextureIndex: 23}, // promenade deck
        {floorTextureIndex: 20, ceilingTextureIndex: 58, wallTextureIndex: 31, propTextureIndex: 47}, // reef floor
        {floorTextureIndex: 13, ceilingTextureIndex: 52, wallTextureIndex: 28, propTextureIndex: 49}, // glass house
    ],
    "inferno": [
        {floorTextureIndex: 59, ceilingTextureIndex: 35, wallTextureIndex: 3, propTextureIndex: 45}, // magma vault
        {floorTextureIndex: 0, ceilingTextureIndex: 22, wallTextureIndex: 49, propTextureIndex: 21}, // forge
        {floorTextureIndex: 9, ceilingTextureIndex: 2, wallTextureIndex: 36, propTextureIndex: 19}, // obsidian hall
        {floorTextureIndex: 23, ceilingTextureIndex: 8, wallTextureIndex: 17, propTextureIndex: 7}, // tomb
        {floorTextureIndex: 14, ceilingTextureIndex: 39, wallTextureIndex: 31, propTextureIndex: 33}, // rust works
        {floorTextureIndex: 28, ceilingTextureIndex: 20, wallTextureIndex: 5, propTextureIndex: 38}, // cinder court
        {floorTextureIndex: 56, ceilingTextureIndex: 12, wallTextureIndex: 48, propTextureIndex: 51}, // gilded chamber
        {floorTextureIndex: 42, ceilingTextureIndex: 41, wallTextureIndex: 29, propTextureIndex: 50}, // kiln
        {floorTextureIndex: 18, ceilingTextureIndex: 52, wallTextureIndex: 46, propTextureIndex: 4}, // ember mine
        {floorTextureIndex: 40, ceilingTextureIndex: 55, wallTextureIndex: 30, propTextureIndex: 1}, // ash lodge
    ],
    "prison": [
        {floorTextureIndex: 56, ceilingTextureIndex: 62, wallTextureIndex: 41, propTextureIndex: 11}, // cell block
        {floorTextureIndex: 13, ceilingTextureIndex: 46, wallTextureIndex: 16, propTextureIndex: 10}, // wash room
        {floorTextureIndex: 6, ceilingTextureIndex: 23, wallTextureIndex: 40, propTextureIndex: 24}, // exercise yard
        {floorTextureIndex: 32, ceilingTextureIndex: 44, wallTextureIndex: 49, propTextureIndex: 1}, // machine hall
        {floorTextureIndex: 36, ceilingTextureIndex: 53, wallTextureIndex: 18, propTextureIndex: 29}, // infirmary
        {floorTextureIndex: 33, ceilingTextureIndex: 9, wallTextureIndex: 58, propTextureIndex: 17}, // rusted wing
        {floorTextureIndex: 5, ceilingTextureIndex: 25, wallTextureIndex: 12, propTextureIndex: 26}, // green corridor
        {floorTextureIndex: 54, ceilingTextureIndex: 48, wallTextureIndex: 51, propTextureIndex: 30}, // warden's office
        {floorTextureIndex: 52, ceilingTextureIndex: 55, wallTextureIndex: 3, propTextureIndex: 61}, // quarry
        {floorTextureIndex: 8, ceilingTextureIndex: 63, wallTextureIndex: 15, propTextureIndex: 31}, // teal ward
    ],
};

const RoomGenerationPaletteMap =
{
    // The texture packs a room can be generated in — the ones palettes have been picked for.
    getTexturePackPaths: (): string[] =>
    {
        return Object.keys(palettesByTexturePackPath);
    },
    // The palettes belonging to one texture pack, empty for a pack nothing has been picked for.
    getPalettes: (texturePackPath: string): RoomGenerationPalette[] =>
    {
        return palettesByTexturePackPath[texturePackPath] ?? [];
    },
    // Draws the texture pack a room is to be built in, along with every palette belonging to it
    // in a seeded random order. The two come back together because neither is usable without the
    // other, and generators assign the palettes to their regions in the order given, so that
    // neighbouring regions are always finished differently while a given seed still rebuilds
    // exactly the same room.
    pickTexturePack: (rand: RandomNumberGenerator): {texturePackPath: string, palettes: RoomGenerationPalette[]} =>
    {
        const texturePackPath = rand.pick(Object.keys(palettesByTexturePackPath));
        return {texturePackPath,
            palettes: rand.shuffle(palettesByTexturePackPath[texturePackPath].slice())};
    },
}

export default RoomGenerationPaletteMap;
