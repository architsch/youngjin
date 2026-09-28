export default interface ImageMapSeed
{
    rootDirName: string;
    mapName: string;
    hasGrid: boolean;
    gridCellSize?: number; // in pixels (undefined if hasGrid == false)
    maxCols?: number; // maximum number of columns in the image map grid (undefined if hasGrid == false, or if the map is atlas-based)

    // Atlas image name (no extension) under the root. If set, images are atlas cells (path = "{col},{row}").
    atlasImageName?: string;

    // Thumbnail longest side in px (undefined = none; atlas maps can't have them). Saves download,
    // decode and GPU upload for images shown small.
    thumbnailSize?: number;

    // The cell (in px) an image that keeps its scale must be whole cells of (see ImageMetadata.preserveScale).
    // Undefined for a map none of whose images may keep their scale.
    preservedScaleCellSize?: number;
}
