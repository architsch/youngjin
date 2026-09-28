import sharp from "sharp";
import FileUtil from "../util/fileUtil";
import ImageFileUtil from "../util/imageFileUtil";
import { STATIC_PAGE_ROOT_DIR, SRC_ROOT_DIR } from "../../system/serverConstants";
import ImageMap from "../../../shared/graphics/image/types/imageMap";
import ImageMapSeed from "../../../shared/graphics/image/types/imageMapSeed";
import ImageMapSubfolderInfo from "../../../shared/graphics/image/types/imageMapSubfolderInfo";
import ImageMapSubfolderTab from "../../../shared/graphics/image/types/imageMapSubfolderTab";

const WEBP_QUALITY = 80;
const ASSETS_ROOT_PATH = `${STATIC_PAGE_ROOT_DIR}/app/assets`;
const MAPS_ROOT_PATH = `${SRC_ROOT_DIR}/shared/graphics/image/maps`;

export default class ImageMapBuilder
{
    private readonly rootDirName: string;
    private readonly imageRootPath: string;
    private readonly mapName: string;
    private readonly hasGrid: boolean;
    private readonly gridCellSize?: number;
    private readonly maxCols?: number;
    private readonly atlasImageName?: string;
    private readonly thumbnailSize?: number;
    private readonly preservedScaleCellSize?: number;

    constructor(seed: ImageMapSeed)
    {
        this.rootDirName = seed.rootDirName;
        this.imageRootPath = `${ASSETS_ROOT_PATH}/${seed.rootDirName}`;
        this.mapName = seed.mapName;
        this.hasGrid = seed.hasGrid;
        this.gridCellSize = seed.gridCellSize;
        this.maxCols = seed.maxCols;
        this.atlasImageName = seed.atlasImageName;
        this.thumbnailSize = seed.thumbnailSize;
        this.preservedScaleCellSize = seed.preservedScaleCellSize;
        if (this.thumbnailSize && this.atlasImageName)
            throw new Error(`Image map generation failed :: An atlas-based map cannot have thumbnails (mapName = ${this.mapName})`);
    }

    async build(): Promise<void>
    {
        const manifestJSON = await FileUtil.read("manifest.json", this.imageRootPath);
        // Other fields an image may carry (its title and author, source and license, for the notices) stay in the
        // manifest.
        const manifest = JSON.parse(manifestJSON) as {
            images: {path: string, author: string, title: string, keywords?: string, preserveScale?: boolean,
                disabled?: boolean}[],
            subfolders?: ImageMapSubfolderTab[],
        };

        // Collect all images but the disabled ones, which are left out of the game while keeping their paths.
        const subfolderInfoByName: {[subfolderName: string]: ImageMapSubfolderInfo} = {};
        for (const image of manifest.images)
        {
            if (image.disabled === true)
                continue;
            const subfolderName = ImageMap.getSubfolderName(image.path);
            if (subfolderInfoByName[subfolderName] == undefined)
                subfolderInfoByName[subfolderName] = {name: subfolderName, imageMetadataList: [], numGridCols: 0, numGridRows: 0};
            const info = subfolderInfoByName[subfolderName];
            // 'coords' will be set inside the "buildGrid" method.
            info.imageMetadataList.push({path: image.path,
                keywords: normalizeKeywords(image.keywords ?? `${image.title},${image.author}`), coords: "",
                preserveScale: image.preserveScale === true ? true : undefined});
        }
        if (Object.keys(subfolderInfoByName).length == 0)
            throw new Error(`Image map generation failed :: Every image is disabled, and the game needs one (mapName = ${this.mapName})`);
        // A tab whose images are all disabled is left out of the game with them.
        const subfolderTabs = manifest.subfolders?.filter(tab => subfolderInfoByName[tab.name] != undefined);
        if (manifest.subfolders)
            this.validateSubfolderTabs(manifest.subfolders, manifest.images, subfolderInfoByName);

        // An atlas map's images are cells of one file, not files of their own.
        if (!this.atlasImageName)
        {
            for (const info of Object.values(subfolderInfoByName))
                await this.readImageSizes(info);
        }

        if (this.hasGrid)
        {
            // Build the grid (or, for an atlas-based map, adopt the pre-composed atlas's grid)
            for (const info of Object.values(subfolderInfoByName))
            {
                if (this.atlasImageName)
                    await this.assignAtlasCellCoords(info);
                else
                    await this.buildGrid(info);
            }
        }

        if (this.thumbnailSize)
        {
            for (const info of Object.values(subfolderInfoByName))
                await this.buildThumbnails(info);
        }

        await this.writeMapFile(subfolderInfoByName, subfolderTabs);
    }

    // Every tab must hold images (disabled or not), and every image must sit in a tab.
    private validateSubfolderTabs(subfolderTabs: ImageMapSubfolderTab[], images: {path: string}[],
        subfolderInfoByName: {[subfolderName: string]: ImageMapSubfolderInfo}): void
    {
        const tabNames = subfolderTabs.map(tab => tab.name);
        for (const tabName of tabNames)
        {
            if (!images.some(image => ImageMap.getSubfolderName(image.path) == tabName))
                throw new Error(`Image map generation failed :: Subfolder "${tabName}" is listed in the manifest but holds no images (mapName = ${this.mapName})`);
        }
        for (const subfolderName of Object.keys(subfolderInfoByName))
        {
            if (!tabNames.includes(subfolderName))
                throw new Error(`Image map generation failed :: Subfolder "${subfolderName}" holds images but is not listed in the manifest's subfolders (mapName = ${this.mapName})`);
        }
    }

    // Every image's size, which an image that keeps its scale must give in whole cells.
    private async readImageSizes(subfolderInfo: ImageMapSubfolderInfo): Promise<void>
    {
        for (const imageMetadata of subfolderInfo.imageMetadataList)
        {
            const imageFile = ImageFileUtil.readImage(`${imageMetadata.path}.webp`, this.imageRootPath);
            const fileMetadata = await imageFile?.metadata();
            if (!fileMetadata?.width || !fileMetadata?.height)
                throw new Error(`Image map generation failed :: Failed to read image (${this.imageRootPath}/${imageMetadata.path}.webp)`);
            imageMetadata.width = fileMetadata.width;
            imageMetadata.height = fileMetadata.height;
            if (!imageMetadata.preserveScale)
                continue;

            const cellSize = this.preservedScaleCellSize;
            if (cellSize == undefined)
                throw new Error(`Image map generation failed :: Image "${imageMetadata.path}" keeps its scale, which no image in this map may (mapName = ${this.mapName})`);
            if (fileMetadata.width % cellSize != 0 || fileMetadata.height % cellSize != 0)
                throw new Error(`Image map generation failed :: Image "${imageMetadata.path}" keeps its scale, so its size (${fileMetadata.width}x${fileMetadata.height}) must be whole cells of ${cellSize}px (mapName = ${this.mapName})`);
        }
    }

    // Writes a thumbnail beside each image (fit within the thumbnail size; unchanged if already smaller).
    private async buildThumbnails(subfolderInfo: ImageMapSubfolderInfo): Promise<void>
    {
        for (const imageMetadata of subfolderInfo.imageMetadataList)
        {
            const imageFile = ImageFileUtil.readImage(`${imageMetadata.path}.webp`, this.imageRootPath);
            if (!imageFile)
                throw new Error(`Image map generation failed :: Failed to read image (${this.imageRootPath}/${imageMetadata.path}.webp)`);
            const thumbnail = imageFile
                .resize(this.thumbnailSize, this.thumbnailSize, { fit: "inside", withoutEnlargement: true })
                .webp({ quality: WEBP_QUALITY });
            await ImageFileUtil.writeImage(`${imageMetadata.path}${ImageMap.THUMBNAIL_PATH_SUFFIX}.webp`,
                thumbnail, this.imageRootPath);
        }
    }

    // Atlas maps: no grid image to compose. Paths are "{col},{row}" cells, validated against the atlas.
    private async assignAtlasCellCoords(subfolderInfo: ImageMapSubfolderInfo): Promise<void>
    {
        const atlasFile = ImageFileUtil.readImage(`${this.atlasImageName}.webp`, this.imageRootPath);
        if (!atlasFile)
            throw new Error(`Image map generation failed :: Failed to read atlas image (${this.imageRootPath}/${this.atlasImageName}.webp)`);
        const atlasMetadata = await atlasFile.metadata();
        if (!atlasMetadata.width || !atlasMetadata.height
            || atlasMetadata.width % this.gridCellSize! != 0 || atlasMetadata.height % this.gridCellSize! != 0)
            throw new Error(`Image map generation failed :: Atlas image's size (${atlasMetadata.width}x${atlasMetadata.height}) is not a multiple of the grid cell size (${this.gridCellSize})`);

        const numCols = atlasMetadata.width / this.gridCellSize!;
        const numRows = atlasMetadata.height / this.gridCellSize!;

        for (const imageMetadata of subfolderInfo.imageMetadataList)
        {
            const cellCoords = imageMetadata.path.includes("/") ? imageMetadata.path.split("/")[1] : imageMetadata.path;
            const words = cellCoords.split(",");
            const col = parseInt(words[0]);
            const row = parseInt(words[1]);
            if (words.length != 2 || isNaN(col) || isNaN(row)
                || col < 0 || col >= numCols || row < 0 || row >= numRows)
                throw new Error(`Image map generation failed :: Image path "${imageMetadata.path}" is not a valid "{col},{row}" cell of the ${numCols}x${numRows} atlas (${this.atlasImageName}.webp)`);
            imageMetadata.coords = `${subfolderInfo.name},${col},${row}`;
        }
        subfolderInfo.numGridCols = numCols;
        subfolderInfo.numGridRows = numRows;
    }

    private async buildGrid(subfolderInfo: ImageMapSubfolderInfo): Promise<void>
    {
        const numImages = subfolderInfo.imageMetadataList.length;
        const numCols = numImages === 0 ? 0 : Math.min(this.maxCols!, numImages);
        const numRows = numImages === 0 ? 0 : Math.ceil(numImages / numCols);
        const gridWidth = numCols === 0 ? 0 : numCols * this.gridCellSize!;
        const gridHeight = numRows === 0 ? 0 : numRows * this.gridCellSize!;

        const composites: sharp.OverlayOptions[] = [];
        let col = 0, row = 0, maxCol = 0, maxRow = 0;

        for (const imageMetadata of subfolderInfo.imageMetadataList)
        {
            imageMetadata.coords = `${subfolderInfo.name},${col},${row}`;

            const imageFile = ImageFileUtil.readImage(`${imageMetadata.path}.webp`, this.imageRootPath);
            if (!imageFile)
                throw new Error(`Image map generation failed :: Failed to read image (${this.imageRootPath}/${imageMetadata.path}.webp)`);
            const imageBuffer = await (imageFile
                .resize(this.gridCellSize, this.gridCellSize, { fit: "cover" })
                .toBuffer());
            
            composites.push({input: imageBuffer, left: col * this.gridCellSize!, top: row * this.gridCellSize!});
            if (col > maxCol)
                maxCol = col;
            if (row > maxRow)
                maxRow = row;

            col = (col + 1) % numCols;
            if (col == 0)
                row++;
        }
        subfolderInfo.numGridCols = maxCol + 1;
        subfolderInfo.numGridRows = maxRow + 1;

        const gridImage = sharp({create: {width: gridWidth, height: gridHeight, channels: 3, background: {r: 0, g: 0, b: 0}}})
            .composite(composites)
            .webp({ quality: WEBP_QUALITY });
        await ImageFileUtil.writeImage(`${subfolderInfo.name.length == 0 ? "" : `${subfolderInfo.name}/`}grid.webp`, gridImage, this.imageRootPath);
    }

    private async writeMapFile(subfolderInfoByName: {[subfolderName: string]: ImageMapSubfolderInfo},
        subfolderTabs?: ImageMapSubfolderTab[]): Promise<void>
    {
        const subfolderInfos = Object.values(subfolderInfoByName);

        const imageMetadataEntries =
            subfolderInfos.map(info =>
                info.imageMetadataList.map(image =>
                    `{path:"${image.path}"`
                    + (image.keywords ? `,keywords:${JSON.stringify(image.keywords)}` : "")
                    + (image.coords ? `,coords:"${image.coords}"` : "")
                    + (image.width ? `,width:${image.width},height:${image.height}` : "")
                    + (image.preserveScale ? ",preserveScale:true" : "")
                    + "}")).flat().join(",");

        const subfolderGridSizesEntries =
            subfolderInfos.map(info =>
                `"${info.name}":{numCols:${info.numGridCols},numRows:${info.numGridRows}}`).join(",");

        // The constructor's optional trailing arguments, written out only as far as the last one given.
        const optionalArgs: (string | undefined)[] = [
            this.atlasImageName ? `"${this.atlasImageName}"` : undefined,
            this.thumbnailSize ? `${this.thumbnailSize}` : undefined,
            subfolderTabs ? "subfolderTabs" : undefined,
        ];
        while (optionalArgs.length > 0 && optionalArgs[optionalArgs.length - 1] == undefined)
            optionalArgs.pop();
        const optionalArgsText = optionalArgs.map(arg => `, ${arg ?? "undefined"}`).join("");

        const subfolderTabsImport = subfolderTabs
            ? `\nimport ImageMapSubfolderTab from "../types/imageMapSubfolderTab";` : "";
        const subfolderTabsDeclaration = subfolderTabs
            ? `\nconst subfolderTabs: ImageMapSubfolderTab[] = [${subfolderTabs.map(tab =>
                `{name:"${tab.name}",title:"${tab.title}"}`).join(",")}]` : "";

        // NOTE: import paths below are relative to the generated file (MAPS_ROOT_PATH). Don't let IDE
        // refactors rewrite them.
        const text = `// THIS FILE IS AUTO-GENERATED BY ImageMapBuilder. DO NOT EDIT MANUALLY.
import ImageMapUtil from "../util/imageMapUtil";
import ImageMap from "../types/imageMap";
import ImageMetadata from "../types/imageMetadata";${subfolderTabsImport}

const imageMetadataList: ImageMetadata[] = [${imageMetadataEntries}]
const subfolderGridSizes: {[subfolder: string]: {numCols: number, numRows: number}} = {${subfolderGridSizesEntries}}${subfolderTabsDeclaration}

ImageMapUtil.setImageMap("${this.mapName}", new ImageMap("${this.rootDirName}", ${this.gridCellSize ?? "0"}, subfolderGridSizes, imageMetadataList${optionalArgsText}));
`;
        const mapNameCamelCased = this.mapName[0].toLowerCase() + this.mapName.substring(1);
        await FileUtil.write(`${mapNameCamelCased}.ts`, text, MAPS_ROOT_PATH);
    }
}

// As ImageMetadata.keywords holds them: trimmed, lowercase, each once, joined by bare commas.
function normalizeKeywords(keywords: string): string
{
    const words = keywords.split(",").map(word => word.trim().replace(/\s+/g, " ").toLowerCase());
    return [...new Set(words.filter(word => word.length > 0))].join(",");
}