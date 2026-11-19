import ImageMetadata from "./imageMetadata";

export default interface ImageMapSubfolderInfo
{
    name: string;
    imageMetadataList: ImageMetadata[];
    numGridCols: number;
    numGridRows: number;
}