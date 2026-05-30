import ObjectGroup from "../../object/types/objectGroup";
import { NUM_VOXEL_COLS, NUM_VOXEL_ROWS, MULTI_PLAYER_ENTRANCE_VOXEL_COL, MULTI_PLAYER_ENTRANCE_VOXEL_ROW } from "../../system/sharedConstants";
import Voxel from "../../voxel/types/voxel";
import VoxelGrid from "../../voxel/types/voxelGrid";
import VoxelQuadsRuntimeMemory from "../../voxel/types/voxelQuadsRuntimeMemory";
import { RoomType, RoomTypeEnumMap } from "../types/roomType";
import RoomGenerationHelperUtil from "./roomGenerationHelperUtil";

const RoomGenerationUtil =
{
    generateRoom: (roomName: string, roomType: RoomType): {voxelGrid: VoxelGrid, objectGroup: ObjectGroup} =>
    {
        switch (roomType)
        {
            case RoomTypeEnumMap.Hub:
            case RoomTypeEnumMap.Regular:
                return generateMultiplayerRoom(0, 1, 2);
            case RoomTypeEnumMap.SinglePlayer:
                return generateSingleplayerRoom(roomName, 0, 1, 2);
            default: throw new Error(`Unknown room type :: ${roomType}`);
        }
    },
}

function generateMultiplayerRoom(floorTextureIndex: number, wallTextureIndex: number,
    ceilingTextureIndex: number): {voxelGrid: VoxelGrid, objectGroup: ObjectGroup}
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
    RoomGenerationHelperUtil.removeWall(voxels, MULTI_PLAYER_ENTRANCE_VOXEL_ROW, MULTI_PLAYER_ENTRANCE_VOXEL_COL, 0, 4);

    return {
        voxelGrid: new VoxelGrid(voxels, quadsMem),
        objectGroup: new ObjectGroup([]),
    };
}

function generateSingleplayerRoom(roomName: string, floorTextureIndex: number, wallTextureIndex: number,
    ceilingTextureIndex: number): {voxelGrid: VoxelGrid, objectGroup: ObjectGroup}
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

    if (roomName == "tutorial")
    {
        // TODO: Construct the tutorial level.
        //...
    }
    else
    {
        throw new Error(`Unknown singleplayer roomName (${roomName})`);
    }

    return {
        voxelGrid: new VoxelGrid(voxels, quadsMem),
        objectGroup: new ObjectGroup([]),
    };
}

export default RoomGenerationUtil;
