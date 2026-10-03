import ImageMapSeed from "../../../shared/graphics/image/types/imageMapSeed";
import { NUM_VOXEL_TEXTURE_COLS, NUM_VOXEL_TEXTURE_ROWS, PICTURE_ATLAS_CELL_SIZE, PICTURE_THUMBNAIL_SIZE }
    from "../../../shared/system/sharedConstants";

const VOXEL_TEXTURE_PACK_GRID_CELL_SIZE = 256;

// Every image map SSG builds, by map name. The image map editor also builds the picture map after every save
// (see @dev/scripts/imageMapEditor).
export const ImageMapSeeds = {
    VoxelTexturePackImageMap: {
        rootDirName: "voxel_texture_packs",
        mapName: "VoxelTexturePackImageMap",
        hasGrid: true,
        gridCellSize: VOXEL_TEXTURE_PACK_GRID_CELL_SIZE,
        // A cell shows a pack's whole atlas, so it takes the atlas's shape.
        gridCellHeight: VOXEL_TEXTURE_PACK_GRID_CELL_SIZE * NUM_VOXEL_TEXTURE_ROWS / NUM_VOXEL_TEXTURE_COLS,
        maxCols: 2,
        augmentedPathSuffix: "_augmented",
    },
    PictureImageMap: {
        rootDirName: "pictures",
        mapName: "PictureImageMap",
        hasGrid: false,
        thumbnailSize: PICTURE_THUMBNAIL_SIZE,
        preservedScaleCellSize: PICTURE_ATLAS_CELL_SIZE,
    },
} satisfies {[mapName: string]: ImageMapSeed};
