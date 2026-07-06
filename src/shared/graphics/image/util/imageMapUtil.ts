import ImageMap from "../types/imageMap";

const imageMapByName: {[mapName: string]: ImageMap} = {};

const ImageMapUtil =
{
    getImageMap: (mapName: string): ImageMap =>
    {
        return imageMapByName[mapName];
    },
    setImageMap: (mapName: string, imageMap: ImageMap) =>
    {
        imageMapByName[mapName] = imageMap;
    },
}

export default ImageMapUtil;