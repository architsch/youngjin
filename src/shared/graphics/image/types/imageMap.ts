import { dummyImagesDebugEnabledObservable } from "../../../system/sharedObservables";
import ImageMetadata from "./imageMetadata";
import ImageMapSubfolderTab from "./imageMapSubfolderTab";
import ImageMapCategory from "./imageMapCategory";

export default class ImageMap
{
    // What an image's path is followed by in its thumbnail's (see ImageMapSeed.thumbnailSize).
    static readonly THUMBNAIL_PATH_SUFFIX = ".thumbnail";

    // The category tabs a chooser adds to a subfolder's own: every image, and those naming none of its categories. No
    // category may take either name.
    static readonly ALL_TAB = "all";
    static readonly MISC_TAB = "misc";

    private rootDirName: string;
    private gridCellSize: number; // in pixels

    // (subfolderName == "") if there is no subfolder.
    private subfolderGridSizes: {[subfolderName: string]: {numCols: number, numRows: number}};

    private imageMetadataByCoords: {[coords: string]: ImageMetadata} = {};
    private imageMetadataByPath: {[path: string]: ImageMetadata} = {};

    private imageMetadataList: ImageMetadata[];

    // Atlas image name (no extension) under the root directory. If set, images are atlas cells
    // (path = "{col},{row}") and the atlas is the grid image.
    private atlasImageName?: string;

    // Thumbnail longest side in px, or 0 for none (see ImageMapSeed.thumbnailSize).
    private thumbnailSize: number;

    // The subfolders' tab order and titles, if the manifest gives them.
    private subfolderTabs?: ImageMapSubfolderTab[];

    constructor(rootDirName: string, gridCellSize: number,
        subfolderGridSizes: {[subfolderName: string]: {numCols: number, numRows: number}},
        imageMetadataList: ImageMetadata[],
        atlasImageName?: string,
        thumbnailSize: number = 0,
        subfolderTabs?: ImageMapSubfolderTab[])
    {
        this.rootDirName = rootDirName;
        this.gridCellSize = gridCellSize;
        this.subfolderGridSizes = subfolderGridSizes;
        this.imageMetadataList = imageMetadataList;
        this.atlasImageName = atlasImageName;
        this.thumbnailSize = thumbnailSize;
        this.subfolderTabs = subfolderTabs;

        for (const imageMetadata of imageMetadataList)
        {
            if (imageMetadata.coords)
                this.imageMetadataByCoords[imageMetadata.coords] = imageMetadata;
            this.imageMetadataByPath[imageMetadata.path] = imageMetadata;
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
    hasImagePathInSubfolder(path: string, subfolderName: string): boolean
    {
        return this.hasImagePath(path) && ImageMap.getSubfolderName(path) == subfolderName;
    }

    getImageMetadataByPath(path: string): ImageMetadata
    {
        return this.imageMetadataByPath[path];
    }
    getImageMetadataByCoords(coords: string): ImageMetadata
    {
        return this.imageMetadataByCoords[coords];
    }
    getImagePathByRawCoords(subfolderName: string, col: number, row: number): string
    {
        return this.getImageMetadataByCoords(`${subfolderName},${col},${row}`).path;
    }
    getFirstImagePath(): string
    {
        return this.imageMetadataList[0].path;
    }
    getImageMetadataList(): ImageMetadata[]
    {
        return this.imageMetadataList;
    }
    getImageMetadataListInSubfolder(subfolderName: string): ImageMetadata[]
    {
        return this.imageMetadataList.filter(metadata => ImageMap.getSubfolderName(metadata.path) == subfolderName);
    }
    // "" for a path outside any subfolder.
    static getSubfolderName(path: string): string
    {
        const slashIndex = path.indexOf("/");
        return (slashIndex < 0) ? "" : path.substring(0, slashIndex);
    }

    // path: relative to the root directory (rootDirName under the assets URL), without extension.
    getImageURLByPath(assetsURL: string, path: string): string
    {
        return this.getFileURLByPath(assetsURL, path, "");
    }
    // 0 when the map has no thumbnails.
    getThumbnailSize(): number
    {
        return this.thumbnailSize;
    }
    // Falls back to the full image when the map has no thumbnails.
    getThumbnailURLByPath(assetsURL: string, path: string): string
    {
        return this.getFileURLByPath(assetsURL, path,
            (this.thumbnailSize > 0) ? ImageMap.THUMBNAIL_PATH_SUFFIX : "");
    }
    private getFileURLByPath(assetsURL: string, path: string, pathSuffix: string): string
    {
        if (dummyImagesDebugEnabledObservable.peek())
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

    // In the manifest's tab order if it gives one.
    getSubfolderNames(): string[]
    {
        if (this.subfolderTabs)
            return this.subfolderTabs.map(tab => tab.name);
        return Object.keys(this.subfolderGridSizes);
    }
    getSubfolderTitle(subfolderName: string): string
    {
        return this.subfolderTabs?.find(tab => tab.name == subfolderName)?.title ?? subfolderName;
    }
    // In tab order; none if the manifest lists none.
    getSubfolderCategories(subfolderName: string): ImageMapCategory[]
    {
        return this.subfolderTabs?.find(tab => tab.name == subfolderName)?.categories ?? [];
    }
}