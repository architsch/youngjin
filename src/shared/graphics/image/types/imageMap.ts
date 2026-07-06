import { imageListChooserDebugEnabledObservable } from "../../../system/sharedObservables";
import ImageMetadata from "./imageMetadata";

export default class ImageMap
{
    private rootDirName: string;
    private gridCellSize: number; // in pixels

    // (subfolderName == "") if there is no subfolder.
    private subfolderGridSizes: {[subfolderName: string]: {numCols: number, numRows: number}};
    
    private imageMetadataByCoords: {[coords: string]: ImageMetadata} = {};
    private imageMetadataByPath: {[path: string]: ImageMetadata} = {};
    private imageMetadataByAuthor: {[author: string]: ImageMetadata} = {};
    private imageMetadataByTitle: {[title: string]: ImageMetadata} = {};

    private imageMetadataList: ImageMetadata[];

    constructor(rootDirName: string, gridCellSize: number,
        subfolderGridSizes: {[subfolderName: string]: {numCols: number, numRows: number}},
        imageMetadataList: ImageMetadata[])
    {
        this.rootDirName = rootDirName;
        this.gridCellSize = gridCellSize;
        this.subfolderGridSizes = subfolderGridSizes;
        this.imageMetadataList = imageMetadataList;

        for (const imageMetadata of imageMetadataList)
        {
            if (imageMetadata.coords)
                this.imageMetadataByCoords[imageMetadata.coords] = imageMetadata;
            this.imageMetadataByPath[imageMetadata.path] = imageMetadata;
            this.imageMetadataByAuthor[imageMetadata.author] = imageMetadata;
            this.imageMetadataByTitle[imageMetadata.title] = imageMetadata;
        }
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
        return this.imageMetadataByPath[path] != undefined;
    }

    getImageMetadataByPath(path: string): ImageMetadata
    {
        return this.imageMetadataByPath[path];
    }
    getImageMetadataByCoords(coords: string): ImageMetadata
    {
        return this.imageMetadataByCoords[coords];
    }
    getImageMetadataByAuthor(author: string): ImageMetadata
    {
        return this.imageMetadataByAuthor[author];
    }
    getImageMetadataByTitle(title: string): ImageMetadata
    {
        return this.imageMetadataByTitle[title];
    }
    getImagePathByRawCoords(subfolderName: string, col: number, row: number): string
    {
        return this.getImageMetadataByCoords(`${subfolderName},${col},${row}`).path;
    }
    getFirstImagePath(): string
    {
        return this.imageMetadataList[0].path;
    }
    getRandomImagePath(): string
    {
        return this.imageMetadataList[Math.floor(Math.random() * this.imageMetadataList.length)].path;
    }
    getImageMetadataList(): ImageMetadata[]
    {
        return this.imageMetadataList;
    }

    // path = (relative path under the root directory, but excluding the file extension)
    // The name of the root directory is given by rootDirName,
    // and the root directory is located right under the app's assets_url (see ThingsPoolEnv).
    getImageURLByPath(assetsURL: string, path: string): string
    {
        if (imageListChooserDebugEnabledObservable.peek())
            return `${assetsURL}/${this.rootDirName}/1/1.webp`;
        if (path.length <= 0)
            return "";
        return `${assetsURL}/${this.rootDirName}/${path}.webp`;
    }
    // coords = {subfolderName},{col},{row}
    // (subfolderName == "") if there is no subfolder.
    getImageURLByCoords(assetsURL: string, coords: string): string
    {
        const imageMetadata = this.getImageMetadataByCoords(coords);
        return this.getImageURLByPath(assetsURL, imageMetadata.path);
    }
    getImageURLByRawCoords(assetsURL: string, subfolderName: string, col: number, row: number): string
    {
        return this.getImageURLByCoords(assetsURL, `${subfolderName},${col},${row}`);
    }

    getGridImageURL(assetsURL: string, subfolderName: string): string
    {
        return `${assetsURL}/${this.rootDirName}/${subfolderName}/grid.webp`;
    }

    getSubfolderNames(): string[]
    {
        return Object.keys(this.subfolderGridSizes);
    }
}