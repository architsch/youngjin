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

    // Name of a pre-composed atlas image file (without extension) located right under the root
    // directory. If defined, the map's images are the atlas's grid cells (each image's "path" is
    // its "{col},{row}" cell coordinates) instead of separate image files, and the grid image is
    // the atlas itself.
    private atlasImageName?: string;

    // The longest side of the thumbnail written beside each of the map's images, in pixels, or 0 if
    // the map has no thumbnails (see ImageMapSeed.thumbnailSize).
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

    // path = (relative path under the root directory, but excluding the file extension)
    // The name of the root directory is given by rootDirName,
    // and the root directory is located right under the app's assets_url (see ThingsPoolEnv).
    getImageURLByPath(assetsURL: string, path: string): string
    {
        return this.getFileURLByPath(assetsURL, path, "");
    }
    // Same as above, but for the image's thumbnail — or for the image itself, where the map has no
    // thumbnails, so that a caller who only ever shows images small can ask any map for thumbnails.
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
        if (this.atlasImageName)
            return `${assetsURL}/${this.rootDirName}/${this.atlasImageName}.webp`;
        return `${assetsURL}/${this.rootDirName}/${subfolderName}/grid.webp`;
    }

    getSubfolderNames(): string[]
    {
        return Object.keys(this.subfolderGridSizes);
    }
}