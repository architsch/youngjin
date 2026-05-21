import ObjectGroup from "../../object/types/objectGroup";
import { NUM_VOXEL_COLS, NUM_VOXEL_ROWS, ENTRANCE_VOXEL_COL, ENTRANCE_VOXEL_ROW } from "../../system/sharedConstants";
import Voxel from "../../voxel/types/voxel";
import VoxelGrid from "../../voxel/types/voxelGrid";
import VoxelQuadsRuntimeMemory from "../../voxel/types/voxelQuadsRuntimeMemory";
import RoomGenerationHelperUtil from "./roomGenerationHelperUtil";

const RoomGenerationUtil =
{
    generateEmptyRoom: (
        floorTextureIndex: number, wallTextureIndex: number, ceilingTextureIndex: number
    ): {voxelGrid: VoxelGrid, objectGroup: ObjectGroup} =>
    {
        const voxels = new Array<Voxel>(NUM_VOXEL_ROWS * NUM_VOXEL_COLS);
        const quadsMem = new VoxelQuadsRuntimeMemory();
        for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
        {
            for (let col = 0; col < NUM_VOXEL_COLS; ++col)
            {
                voxels[row * NUM_VOXEL_COLS + col] = new Voxel(quadsMem, row, col, 0b00000000);
            }
        }
        const quadTextureIndicesWithinLayer = [
            ceilingTextureIndex, // -y
            floorTextureIndex, // +y
            wallTextureIndex, // -x
            wallTextureIndex, // +x
            wallTextureIndex, // -z
            wallTextureIndex, // +z
        ];

        // Paint floor and ceiling quads
        for (let row = 1; row < NUM_VOXEL_ROWS-1; ++row)
        {
            for (let col = 1; col < NUM_VOXEL_COLS-1; ++col)
            {
                RoomGenerationHelperUtil.paintFloorAndCeilingTexture(quadsMem.quads, row, col, floorTextureIndex, ceilingTextureIndex);
            }
        }

        // Add corner/boundary walls
        for (let col = 1; col < NUM_VOXEL_COLS-1; ++col)
        {
            RoomGenerationHelperUtil.addWall(voxels, 0, col, quadTextureIndicesWithinLayer);
            RoomGenerationHelperUtil.addWall(voxels, NUM_VOXEL_ROWS-1, col, quadTextureIndicesWithinLayer);
        }
        for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
        {
            RoomGenerationHelperUtil.addWall(voxels, row, 0, quadTextureIndicesWithinLayer);
            RoomGenerationHelperUtil.addWall(voxels, row, NUM_VOXEL_COLS-1, quadTextureIndicesWithinLayer);
        }

        // Make the player's entrance point (i.e. behind the entrance door) hollow, so as to prevent the player from experiencing collision on entrance.
        RoomGenerationHelperUtil.removeWall(voxels, ENTRANCE_VOXEL_ROW, ENTRANCE_VOXEL_COL, 0, 4);

        return {
            voxelGrid: new VoxelGrid(voxels, quadsMem),
            objectGroup: new ObjectGroup([]),
        };
    },
}

export default RoomGenerationUtil;
