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

    // Longest side (in pixels) of a downscaled copy of each image, written beside it, for the places
    // that never show the image larger than that. Undefined if the map has no thumbnails, which an
    // atlas-based map cannot have, its images not being files of their own.
    //
    // A thumbnail is not just a smaller download: an image is decoded, and uploaded to the GPU, at
    // whatever size its file is, however small it is then drawn.
    thumbnailSize?: number;
}