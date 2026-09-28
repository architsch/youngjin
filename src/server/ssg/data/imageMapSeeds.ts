import ImageMapSeed from "../../../shared/graphics/image/types/imageMapSeed";
import { PICTURE_ATLAS_CELL_SIZE, PICTURE_THUMBNAIL_SIZE } from "../../../shared/system/sharedConstants";

// Every image map SSG builds, by map name. The image map editor also builds the picture map after every save
// (see @dev/scripts/imageMapEditor).
export const ImageMapSeeds = {
    VoxelTexturePackImageMap: {
        rootDirName: "voxel_texture_packs",
        mapName: "VoxelTexturePackImageMap",
        hasGrid: true,
        gridCellSize: 256,
        maxCols: 2,
    },
    PictureImageMap: {
        rootDirName: "pictures",
        mapName: "PictureImageMap",
        hasGrid: false,
        thumbnailSize: PICTURE_THUMBNAIL_SIZE,
        preservedScaleCellSize: PICTURE_ATLAS_CELL_SIZE,
    },
} satisfies {[mapName: string]: ImageMapSeed};
