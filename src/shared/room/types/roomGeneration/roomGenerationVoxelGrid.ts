import { NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../../../system/sharedConstants";
import VoxelGrid from "../../../voxel/types/voxelGrid";
import RoomGenerationHelperUtil from "../../util/roomGenerationHelperUtil";
import RoomGenerationVoxel from "./roomGenerationVoxel";
import { RoomGenerationVoxelType } from "./roomGenerationVoxelType";

export default class RoomGenerationVoxelGrid
{
    voxels: RoomGenerationVoxel[];

    constructor()
    {
        this.voxels = new Array<RoomGenerationVoxel>(NUM_VOXEL_COLS * NUM_VOXEL_ROWS);

        for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
        {
            for (let col = 0; col < NUM_VOXEL_COLS; ++col)
            {
                this.voxels[row * NUM_VOXEL_COLS + col] = new RoomGenerationVoxel(row, col);
            }
        }
    }

    generate(voxelGrid: VoxelGrid)
    {
        for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
        {
            for (let col = 0; col < NUM_VOXEL_COLS; ++col)
            {
                const voxel = this.voxels[row * NUM_VOXEL_COLS + col];

                switch (voxel.type)
                {
                    case RoomGenerationVoxelType.Wall:
                        RoomGenerationHelperUtil.addWall(
                            voxelGrid.voxels, row, col,
                            voxel.textureIndices);
                        break;
                    case RoomGenerationVoxelType.Floor:
                        RoomGenerationHelperUtil.paintFloorAndCeilingTexture(
                            voxelGrid.quadsMem.quads, row, col,
                            voxel.getFloorTextureIndex(),
                            voxel.getCeilingTextureIndex());
                        break;
                    default:
                        throw new Error(`Unknown RoomGenerationVoxelType :: ${voxel.type}`);
                }
            }
        }
    }

    createWalls(rowStart: number, colStart: number, numRows: number, numCols: number)
    {
        for (let row = rowStart; row < rowStart + numRows; ++row)
        {
            for (let col = colStart; col < colStart + numCols; ++col)
            {
                const voxel = this.voxels[row * NUM_VOXEL_COLS + col];
                voxel.type = RoomGenerationVoxelType.Wall;
            }
        }
    }

    createRegion(rowStart: number, colStart: number, numRows: number, numCols: number,
        floorTextureIndex: number, ceilingTextureIndex: number, wallTextureIndex: number)
    {
        // Set floor/ceiling textures
        for (let row = rowStart; row < rowStart + numRows; ++row)
        {
            for (let col = colStart; col < colStart + numCols; ++col)
            {
                const voxel = this.voxels[row * NUM_VOXEL_COLS + col];
                voxel.type = RoomGenerationVoxelType.Floor;
                voxel.setFloorTextureIndex(floorTextureIndex);
                voxel.setCeilingTextureIndex(ceilingTextureIndex);
            }
        }
        // Set the inward-facing wall textures of the region's boundary.
        for (let row = rowStart; row < rowStart + numRows; ++row)
        {
            for (let col = colStart; col < colStart + numCols; ++col)
            {
                this.voxels[row * NUM_VOXEL_COLS + (col-1)]?.setNeighborFacingWallTextureIndex(row, col, wallTextureIndex);
                this.voxels[row * NUM_VOXEL_COLS + (col+1)]?.setNeighborFacingWallTextureIndex(row, col, wallTextureIndex);
                this.voxels[(row-1) * NUM_VOXEL_COLS + col]?.setNeighborFacingWallTextureIndex(row, col, wallTextureIndex);
                this.voxels[(row+1) * NUM_VOXEL_COLS + col]?.setNeighborFacingWallTextureIndex(row, col, wallTextureIndex);
            }
        }
    }
}