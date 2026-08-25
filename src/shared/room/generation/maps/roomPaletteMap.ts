import RandomNumberGenerator from "../../../math/types/randomNumberGenerator";
import RoomPalette from "../types/roomPalette";

const palettesByTexturePackPath: {[texturePackPath: string]: RoomPalette[]} = {
    "default": [
        new RoomPalette(14, 47, 45, 15), // marble gallery
        new RoomPalette(16, 30, 41, 22), // oak hall
        new RoomPalette(8, 34, 43, 37), // stone court
        new RoomPalette(31, 47, 40, 22), // brick loft
        new RoomPalette(11, 50, 53, 14), // tiled atrium
        new RoomPalette(52, 47, 13, 15), // carpeted salon
        new RoomPalette(6, 51, 42, 47), // chequered foyer
        new RoomPalette(9, 45, 54, 55), // sandstone court
        new RoomPalette(7, 59, 57, 45), // walled garden
        new RoomPalette(17, 22, 44, 15), // amber study
    ],
    "country": [
        new RoomPalette(24, 41, 58, 33), // timbered hall
        new RoomPalette(18, 30, 57, 16), // barn
        new RoomPalette(52, 47, 50, 25), // stone cottage
        new RoomPalette(26, 39, 56, 8), // farmhouse kitchen
        new RoomPalette(7, 48, 45, 63), // greenhouse
        new RoomPalette(28, 32, 54, 62), // walled yard
        new RoomPalette(29, 31, 44, 17), // thatched parlour
        new RoomPalette(53, 34, 37, 55), // larder
        new RoomPalette(42, 24, 59, 20), // hunting lodge
        new RoomPalette(6, 41, 49, 23), // meadow porch
    ],
    "garden": [
        new RoomPalette(61, 59, 40, 31), // lawn court
        new RoomPalette(51, 18, 2, 46), // stone terrace
        new RoomPalette(45, 37, 27, 29), // rose walk
        new RoomPalette(52, 15, 0, 20), // cobbled yard
        new RoomPalette(10, 50, 9, 25), // conservatory
        new RoomPalette(21, 47, 5, 26), // sunflower plot
        new RoomPalette(11, 55, 28, 14), // mosaic patio
        new RoomPalette(60, 58, 53, 35), // mulch grove
        new RoomPalette(63, 38, 48, 36), // rockery
        new RoomPalette(12, 4, 3, 24), // wicker pavilion
    ],
    "aqua": [
        new RoomPalette(24, 39, 16, 2), // pool hall
        new RoomPalette(8, 61, 34, 26), // bath house
        new RoomPalette(29, 21, 18, 43), // grotto
        new RoomPalette(3, 57, 11, 51), // ice cavern
        new RoomPalette(27, 62, 9, 5), // mosaic spa
        new RoomPalette(33, 41, 42, 40), // crystal vault
        new RoomPalette(45, 56, 17, 30), // tidal court
        new RoomPalette(32, 44, 35, 23), // promenade deck
        new RoomPalette(20, 58, 31, 47), // reef floor
        new RoomPalette(13, 52, 28, 49), // glass house
    ],
    "inferno": [
        new RoomPalette(59, 35, 3, 45), // magma vault
        new RoomPalette(0, 22, 49, 21), // forge
        new RoomPalette(9, 2, 36, 19), // obsidian hall
        new RoomPalette(23, 8, 17, 7), // tomb
        new RoomPalette(14, 39, 31, 33), // rust works
        new RoomPalette(28, 20, 5, 38), // cinder court
        new RoomPalette(56, 12, 48, 51), // gilded chamber
        new RoomPalette(42, 41, 29, 50), // kiln
        new RoomPalette(18, 52, 46, 4), // ember mine
        new RoomPalette(40, 55, 30, 1), // ash lodge
    ],
    "prison": [
        new RoomPalette(56, 62, 41, 11), // cell block
        new RoomPalette(13, 46, 16, 10), // wash room
        new RoomPalette(6, 23, 40, 24), // exercise yard
        new RoomPalette(32, 44, 49, 1), // machine hall
        new RoomPalette(36, 53, 18, 29), // infirmary
        new RoomPalette(33, 9, 58, 17), // rusted wing
        new RoomPalette(5, 25, 12, 26), // green corridor
        new RoomPalette(54, 48, 51, 30), // warden's office
        new RoomPalette(52, 55, 3, 61), // quarry
        new RoomPalette(8, 63, 15, 31), // teal ward
    ],
};

const RoomPaletteMap =
{
    getTexturePackPaths: (): string[] =>
    {
        return Object.keys(palettesByTexturePackPath);
    },
    getPalettes: (texturePackPath: string): RoomPalette[] =>
    {
        return palettesByTexturePackPath[texturePackPath] ?? [];
    },
    pickRandomTexturePack: (rand: RandomNumberGenerator): {texturePackPath: string, palettes: RoomPalette[]} =>
    {
        const texturePackPath = rand.pick(Object.keys(palettesByTexturePackPath));
        return {texturePackPath,
            palettes: rand.shuffle(palettesByTexturePackPath[texturePackPath].slice())};
    },
}

export default RoomPaletteMap;
