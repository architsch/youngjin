import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, COLLISION_LAYER_NULL, NUM_VOXEL_COLS,
    NUM_VOXEL_ROWS } from "../../system/sharedConstants";
import Voxel from "../../voxel/types/voxel";
import VoxelQuadUpdateUtil from "../../voxel/util/voxelQuadUpdateUtil";
import VoxelQueryUtil from "../../voxel/util/voxelQueryUtil";
import VoxelUpdateUtil from "../../voxel/util/voxelUpdateUtil";
import RoomPalette from "../types/roomPalette";
import RoomVolume from "../types/roomVolume";

const RoomVolumeUtil =
{
    // Carves a volume out of the grid in two passes: remove its blocks, then finish the faces enclosing it in
    // the palette. Which of them are drawn follows from what is still solid, so volumes can be carved in any
    // order.
    carveOutVolume(voxels: Voxel[], volume: RoomVolume, palette: RoomPalette): void
    {
        if (!volumeIsInsideGrid(volume))
        {
            console.error(`RoomVolumeUtil::carveOutVolume :: Volume's bounds are improper (volume = ${JSON.stringify(volume)}).`);
            return;
        }

        // Blocks removed via VoxelUpdateUtil (no room passed, so no validation), which updates faces
        // from actual solidity.
        for (let row = volume.rowMin; row <= volume.rowMax; ++row)
        {
            for (let col = volume.colMin; col <= volume.colMax; ++col)
            {
                for (let layer = volume.collisionLayerMin; layer <= volume.collisionLayerMax; ++layer)
                {
                    VoxelUpdateUtil.removeVoxelBlock(undefined, voxels,
                        VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, layer));
                }
            }
        }

        // Faces belong to the enclosing blocks and are drawn only where such a block exists.
        for (let row = volume.rowMin; row <= volume.rowMax; ++row)
        {
            for (let layer = volume.collisionLayerMin; layer <= volume.collisionLayerMax; ++layer)
            {
                paintEnclosingFace(voxels, row, volume.colMin-1, "x", "+", layer, palette.wall);
                paintEnclosingFace(voxels, row, volume.colMax+1, "x", "-", layer, palette.wall);
            }
        }
        for (let col = volume.colMin; col <= volume.colMax; ++col)
        {
            for (let layer = volume.collisionLayerMin; layer <= volume.collisionLayerMax; ++layer)
            {
                paintEnclosingFace(voxels, volume.rowMin-1, col, "z", "+", layer, palette.wall);
                paintEnclosingFace(voxels, volume.rowMax+1, col, "z", "-", layer, palette.wall);
            }
        }

        // Floor and ceiling; outside the layer range, the room's own floor/ceiling closes the volume
        // (see COLLISION_LAYER_NULL).
        const floorCollisionLayer = volume.collisionLayerMin - 1;
        const ceilingCollisionLayer = volume.collisionLayerMax + 1;

        for (let row = volume.rowMin; row <= volume.rowMax; ++row)
        {
            for (let col = volume.colMin; col <= volume.colMax; ++col)
            {
                paintEnclosingFace(voxels, row, col, "y", "+", floorCollisionLayer, palette.floor);
                paintEnclosingFace(voxels, row, col, "y", "-", ceilingCollisionLayer, palette.ceiling);
            }
        }
    },
}

// Within the grid and correctly ordered. Touching the room's edge is allowed.
function volumeIsInsideGrid(volume: RoomVolume): boolean
{
    return volume.rowMin >= 0 && volume.rowMax <= NUM_VOXEL_ROWS-1 &&
        volume.colMin >= 0 && volume.colMax <= NUM_VOXEL_COLS-1 &&
        volume.collisionLayerMin >= COLLISION_LAYER_MIN &&
        volume.collisionLayerMax <= COLLISION_LAYER_MAX &&
        volume.rowMin <= volume.rowMax && volume.colMin <= volume.colMax &&
        volume.collisionLayerMin <= volume.collisionLayerMax;
}

// Finishes one enclosing face. It is drawn only if the enclosing block is solid, and outside the layer
// range it is the room's own floor or ceiling (see VoxelQueryUtil.isVoxelQuadVisible).
function paintEnclosingFace(voxels: Voxel[], row: number, col: number,
    facingAxis: "x" | "y" | "z", orientation: "-" | "+", collisionLayer: number,
    textureIndex: number): void
{
    const voxel = VoxelQueryUtil.getVoxel(voxels, row, col);
    if (voxel == undefined)
        return; // outside the room, where there is no face to finish

    // Room floor and ceiling faces share one layer position.
    const quadCollisionLayer = (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
        ? COLLISION_LAYER_NULL : collisionLayer;
    VoxelQuadUpdateUtil.setVoxelQuadTexture(voxel, VoxelQueryUtil.getVoxelQuadIndex(
        row, col, facingAxis, orientation, quadCollisionLayer), textureIndex);
}

export default RoomVolumeUtil;
