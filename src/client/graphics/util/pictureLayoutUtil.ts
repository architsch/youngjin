import ImageMetadata from "../../../shared/graphics/image/types/imageMetadata";
import Vec2 from "../../../shared/math/types/vec2";
import { PICTURE_ATLAS_CELL_SIZE, PICTURE_ATLAS_CELL_WORLD_SIZE } from "../../../shared/system/sharedConstants";
import TexelRect from "../types/texture/texelRect";
import TextureAtlasLayout from "../types/texture/textureAtlasLayout";
import TextureAtlasLayoutUtil from "./textureAtlasLayoutUtil";

const PIXELS_PER_WORLD_UNIT = PICTURE_ATLAS_CELL_SIZE / PICTURE_ATLAS_CELL_WORLD_SIZE;

// How a picture lays its image out (see PictureGameObject), wherever the image is drawn.
const PictureLayoutUtil =
{
    // Where an image goes in a picture's extent, turned by quarterTurns, from the texels it is drawn over: at its
    // own scale if it keeps one, else fitted. The placeholder of an object without an image fills the extent.
    getLayout: (image: ImageMetadata | undefined, texels: TexelRect, pictureSize: Vec2,
        quarterTurns: number): TextureAtlasLayout =>
    {
        if (image == undefined)
            return TextureAtlasLayoutUtil.getLayout(pictureSize, texels, "fill", 0);
        if (image.preserveScale && image.width && image.height)
        {
            return TextureAtlasLayoutUtil.getLayout(pictureSize, texels, "preserve", quarterTurns,
                {x: image.width / PIXELS_PER_WORLD_UNIT, y: image.height / PIXELS_PER_WORLD_UNIT});
        }
        return TextureAtlasLayoutUtil.getLayout(pictureSize, texels, "fit", quarterTurns);
    },
}

export default PictureLayoutUtil;
