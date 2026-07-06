export default interface ImageMapSeed
{
    rootDirName: string;
    mapName: string;
    hasGrid: boolean;
    gridCellSize?: number; // in pixels (undefined if hasGrid == false)
    maxCols?: number; // maximum number of columns in the image map grid (undefined if hasGrid == false)
}