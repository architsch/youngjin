export default class ImageMap
{
    private rootDirName: string;
    private gridCellSize: number; // in pixels

    // (subfolderName == "") if there is no subfolder.
    private subfolderGridSizes: {[subfolderName: string]: {numCols: number, numRows: number}};

    // coords = {subfolderName},{col},{row}
    // (subfolderName == "") if there is no subfolder.
    private pathByCoords: {[coords: string]: string};

    // path = (relative path under the root directory, but excluding the file extension)
    // The name of the root directory is given by rootDirName,
    // and the root directory is located right under the app's assets_url (see ThingsPoolEnv).
    private coordsByPath: {[path: string]: string};

    constructor(rootDirName: string, gridCellSize: number,
        subfolderGridSizes: {[subfolderName: string]: {numCols: number, numRows: number}},
        pathByCoords: {[coords: string]: string},
        coordsByPath: {[path: string]: string})
    {
        this.rootDirName = rootDirName;
        this.gridCellSize = gridCellSize;
        this.subfolderGridSizes = subfolderGridSizes;
        this.pathByCoords = pathByCoords;
        this.coordsByPath = coordsByPath;
    }

    getGridCellSize(): number
    {
        return this.gridCellSize;
    }
    getNumGridCols(subfolderName: string): number
    {
        return this.subfolderGridSizes[subfolderName].numCols;
    }
    getNumGridRows(subfolderName: string): number
    {
        return this.subfolderGridSizes[subfolderName].numRows;
    }

    hasImagePath(path: string): boolean
    {
        return this.coordsByPath[path] != undefined;
    }

    getImageCoordsByPath(path: string): string
    {
        return this.coordsByPath[path];
    }
    getImagePathByCoords(coords: string): string
    {
        return this.pathByCoords[coords];
    }
    getImagePathByRawCoords(subfolderName: string, col: number, row: number): string
    {
        return this.getImagePathByCoords(`${subfolderName},${col},${row}`);
    }
    getFirstImagePath(): string
    {
        return Object.keys(this.coordsByPath)[0];
    }
    getRandomImagePath(): string
    {
        const paths = Object.keys(this.coordsByPath);
        return paths[Math.floor(Math.random() * paths.length)];
    }

    // path = (relative path under the root directory, but excluding the file extension)
    // The name of the root directory is given by rootDirName,
    // and the root directory is located right under the app's assets_url (see ThingsPoolEnv).
    getImageURLByPath(assetsURL: string, path: string): string
    {
        if (path.length <= 0)
            return "";
        return `${assetsURL}/${this.rootDirName}/${path}.jpg`;
    }
    // coords = {subfolderName},{col},{row}
    // (subfolderName == "") if there is no subfolder.
    getImageURLByCoords(assetsURL: string, coords: string): string
    {
        return this.getImageURLByPath(assetsURL, this.pathByCoords[coords]);
    }
    getImageURLByRawCoords(assetsURL: string, subfolderName: string, col: number, row: number): string
    {
        return this.getImageURLByCoords(assetsURL, `${subfolderName},${col},${row}`);
    }

    getGridImageURL(assetsURL: string, subfolderName: string): string
    {
        return `${assetsURL}/${this.rootDirName}/${subfolderName}/grid.jpg`;
    }

    getSubfolderNames(): string[]
    {
        return Object.keys(this.subfolderGridSizes);
    }
}