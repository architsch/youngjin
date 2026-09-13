import { imageListChooserDebugEnabledObservable } from "../../../system/sharedObservables";
import ImageMetadata from "./imageMetadata";

export default class ImageMap
{
    // What an image's path is followed by in its thumbnail's (see ImageMapSeed.thumbnailSize).
    static readonly THUMBNAIL_PATH_SUFFIX = ".thumbnail";

    private rootDirName: string;
    private gridCellSize: number; // in pixels

    // (subfolderName == "") if there is no subfolder.
    private subfolderGridSizes: {[subfolderName: string]: {numCols: number, numRows: number}};

    private imageMetadataByCoords: {[coords: string]: ImageMetadata} = {};
    private imageMetadataByPath: {[path: string]: ImageMetadata} = {};
    private imageMetadataByAuthor: {[author: string]: ImageMetadata} = {};
    private imageMetadataByTitle: {[title: string]: ImageMetadata} = {};

    private imageMetadataList: ImageMetadata[];

    // Atlas image name (no extension) under the root directory. If set, images are atlas cells
    // (path = "{col},{row}") and the atlas is the grid image.
    private atlasImageName?: string;

    // Thumbnail longest side in px, or 0 for none (see ImageMapSeed.thumbnailSize).
    private thumbnailSize: number;

    constructor(rootDirName: string, gridCellSize: number,
        subfolderGridSizes: {[subfolderName: string]: {numCols: number, numRows: number}},
        imageMetadataList: ImageMetadata[],
        atlasImageName?: string,
        thumbnailSize: number = 0)
    {
        this.rootDirName = rootDirName;
        this.gridCellSize = gridCellSize;
        this.subfolderGridSizes = subfolderGridSizes;
        this.imageMetadataList = imageMetadataList;
        this.atlasImageName = atlasImageName;
        this.thumbnailSize = thumbnailSize;

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

    // path: relative to the root directory (rootDirName under the assets URL), without extension.
    getImageURLByPath(assetsURL: string, path: string): string
    {
        return this.getFileURLByPath(assetsURL, path, "");
    }
    // Falls back to the full image when the map has no thumbnails.
    getThumbnailURLByPath(assetsURL: string, path: string): string
    {
        return this.getFileURLByPath(assetsURL, path,
            (this.thumbnailSize > 0) ? ImageMap.THUMBNAIL_PATH_SUFFIX : "");
    }
    private getFileURLByPath(assetsURL: string, path: string, pathSuffix: string): string
    {
        if (imageListChooserDebugEnabledObservable.peek())
            return `${assetsURL}/${this.rootDirName}/1/1${pathSuffix}.webp`;
        if (path.length <= 0)
            return "";
        return `${assetsURL}/${this.rootDirName}/${path}${pathSuffix}.webp`;
    }
    // coords = {subfolderName},{col},{row} (subfolderName is "" without subfolders).
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
        if (this.atlasImageName)
            return `${assetsURL}/${this.rootDirName}/${this.atlasImageName}.webp`;
        return `${assetsURL}/${this.rootDirName}/${subfolderName}/grid.webp`;
    }

    getSubfolderNames(): string[]
    {
        return Object.keys(this.subfolderGridSizes);
    }
}