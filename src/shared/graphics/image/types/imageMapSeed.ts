export default interface ImageMapSeed
{
    rootDirName: string;
    mapName: string;
    hasGrid: boolean;
    gridCellSize?: number; // in pixels (undefined if hasGrid == false)
    maxCols?: number; // maximum number of columns in the image map grid (undefined if hasGrid == false, or if the map is atlas-based)

    // Name of a pre-composed atlas image file (without extension) located right under the root directory.
    // If defined, the map's images are the atlas's grid cells (each image's "path" is its "{col},{row}"
    // cell coordinates) instead of separate image files, and the grid image is the atlas itself.
    atlasImageName?: string;
}