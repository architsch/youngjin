import sharp from "sharp";
import FileUtil from "../util/fileUtil";
import ImageFileUtil from "../util/imageFileUtil";
import { STATIC_PAGE_ROOT_DIR, SRC_ROOT_DIR } from "../../system/serverConstants";
import ImageMapSeed from "../../../shared/graphics/image/types/imageMapSeed";
import ImageMapSubfolderInfo from "../../../shared/graphics/image/types/imageMapSubfolderInfo";

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

    constructor(seed: ImageMapSeed)
    {
        this.rootDirName = seed.rootDirName;
        this.imageRootPath = `${ASSETS_ROOT_PATH}/${seed.rootDirName}`;
        this.mapName = seed.mapName;
        this.hasGrid = seed.hasGrid;
        this.gridCellSize = seed.gridCellSize;
        this.maxCols = seed.maxCols;
        this.atlasImageName = seed.atlasImageName;
    }

    async build(): Promise<void>
    {
        const manifestJSON = await FileUtil.read("manifest.json", this.imageRootPath);
        const manifest = JSON.parse(manifestJSON) as {images: {path: string, author: string, title: string}[]};
        
        // Collect all images
        const subfolderInfoByName: {[subfolderName: string]: ImageMapSubfolderInfo} = {};
        for (const image of manifest.images)
        {
            const subfolderName = image.path.includes("/") ? image.path.split("/")[0] : "";
            if (subfolderInfoByName[subfolderName] == undefined)
                subfolderInfoByName[subfolderName] = {name: subfolderName, imageMetadataList: [], numGridCols: 0, numGridRows: 0};
            const info = subfolderInfoByName[subfolderName];
            info.imageMetadataList.push({...image, coords: ""}); // 'coords' will be set inside the "buildGrid" method.
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

        await this.writeMapFile(subfolderInfoByName);
    }

    // For an atlas-based map, no grid image needs to be composed — the atlas already is the grid.
    // Each image's "path" holds its "{col},{row}" cell coordinates within the atlas, so this method
    // only validates those coordinates against the atlas's dimensions and adopts them as coords.
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

    private async writeMapFile(subfolderInfoByName: {[subfolderName: string]: ImageMapSubfolderInfo}): Promise<void>
    {
        const subfolderInfos = Object.values(subfolderInfoByName);

        const imageMetadataEntries =
            subfolderInfos.map(info =>
                info.imageMetadataList.map(image =>
                    `{path:"${image.path}",author:"${image.author}",title:"${image.title}"${image.coords ? `,coords:"${image.coords}"` : ""}}`)).flat().join(",");

        const subfolderGridSizesEntries =
            subfolderInfos.map(info =>
                `"${info.name}":{numCols:${info.numGridCols},numRows:${info.numGridRows}}`).join(",");

        const text = `// THIS FILE IS AUTO-GENERATED BY ImageMapBuilder. DO NOT EDIT MANUALLY.
import ImageMapUtil from "../../../shared/graphics/image/util/imageMapUtil";
import ImageMap from "../../../shared/graphics/image/types/imageMap";
import ImageMetadata from "../../../shared/graphics/image/types/imageMetadata";

const imageMetadataList: ImageMetadata[] = [${imageMetadataEntries}]
const subfolderGridSizes: {[subfolder: string]: {numCols: number, numRows: number}} = {${subfolderGridSizesEntries}}

ImageMapUtil.setImageMap("${this.mapName}", new ImageMap("${this.rootDirName}", ${this.gridCellSize ?? "0"}, subfolderGridSizes, imageMetadataList${this.atlasImageName ? `, "${this.atlasImageName}"` : ""}));
`;
        const mapNameCamelCased = this.mapName[0].toLowerCase() + this.mapName.substring(1);
        await FileUtil.write(`${mapNameCamelCased}.ts`, text, MAPS_ROOT_PATH);
    }
}