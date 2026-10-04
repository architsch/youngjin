import ImageMap from "../types/imageMap";

const imageMapByName: {[mapName: string]: ImageMap} = {};

const ImageMapUtil =
{
    getImageMap: (mapName: string): ImageMap =>
    {
        return imageMapByName[mapName];
    },
    // Keeps each image's index in the map's list as its place in the order a chooser offers them in (see
    // ImageMetadata.order).
    setImageMap: (mapName: string, imageMap: ImageMap) =>
    {
        imageMapByName[mapName] = imageMap;
        imageMap.getImageMetadataList().forEach((imageMetadata, index) => imageMetadata.order = index);
    },
}

export default ImageMapUtil;