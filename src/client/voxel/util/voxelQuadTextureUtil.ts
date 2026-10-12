import Geometry3DUtil from "../../../shared/math/util/geometry3DUtil";
import { NUM_PACK_VOXEL_TEXTURES, NUM_VOXEL_TEXTURE_COLS, PROCEDURAL_VOXEL_TEXTURE_MARGIN,
    VOXEL_TEXTURE_CELL_SIZE } from "../../../shared/system/sharedConstants";
import VoxelQuadTransformDimensions from "../../../shared/voxel/types/voxelQuadTransformDimensions";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";
import TexelRect from "../../graphics/types/texture/texelRect";

// What a voxel quad shows of its room's texture pack, whatever draws it.
const VoxelQuadTextureUtil =
{
    // How much of a texture's cell, all round, is no part of what tiles: none of a pack's own (see
    // PROCEDURAL_VOXEL_TEXTURE_MARGIN). Whatever shows the texture leaves it out.
    getTextureMargin: (textureIndex: number): number =>
    {
        return (textureIndex < NUM_PACK_VOXEL_TEXTURES) ? 0 : PROCEDURAL_VOXEL_TEXTURE_MARGIN;
    },
    // The texels of the pack's atlas a quad shows. worldX, worldZ: where the quad's middle lies in the room.
    getTexelRect: (quadIndex: number, textureIndex: number, dims: VoxelQuadTransformDimensions,
        worldX: number, worldZ: number, out: TexelRect): TexelRect =>
    {
        const { scaleX, scaleY } = dims;

        // The quad shows the part of the tile it lies over, a tile being a world unit across, so faces side
        // by side make up one tile between them: across, from where it starts along its own right. Up a
        // wall, a layer shows half a tile, the halves alternating so two layers show the whole; a floor or
        // ceiling goes by where it starts along its own up.
        const {right, up} = Geometry3DUtil.getAxisFacingBasis({x: dims.dirX, y: dims.dirY, z: dims.dirZ});
        const sampleOffsetX = getFractionOfTile(worldX * right.x + worldZ * right.z - 0.5 * scaleX); // [0,1)
        const sampleOffsetY = (VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex) == "y")
            ? getFractionOfTile(worldX * up.x + worldZ * up.z - 0.5 * scaleY)
            : ((VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex) % 2 == 0) ? scaleY : 0); // [0,1)

        // What tiles of the texture's cell: all of a pack's own, and what is inside a procedural one's margin
        // (see PROCEDURAL_VOXEL_TEXTURE_MARGIN). The quad shows its share of that, in whole texels.
        const margin = VoxelQuadTextureUtil.getTextureMargin(textureIndex);
        const tileSize = VOXEL_TEXTURE_CELL_SIZE - 2 * margin;
        const cellX = (textureIndex % NUM_VOXEL_TEXTURE_COLS) * VOXEL_TEXTURE_CELL_SIZE;
        const cellY = Math.floor(textureIndex / NUM_VOXEL_TEXTURE_COLS) * VOXEL_TEXTURE_CELL_SIZE;

        out.x = cellX + margin + sampleOffsetX * tileSize;
        out.y = cellY + margin + sampleOffsetY * tileSize;
        out.width = scaleX * tileSize;
        out.height = scaleY * tileSize;
        return out;
    },
}

function getFractionOfTile(along: number): number
{
    return along - Math.floor(along);
}

export default VoxelQuadTextureUtil;
