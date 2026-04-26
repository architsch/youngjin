export default interface ImageMapSubfolderInfo
{
    name: string;
    images: {path: string, author: string, title: string}[];
    gridCells: {coords: string, path: string}[];
    numGridCols: number;
    numGridRows: number;
}