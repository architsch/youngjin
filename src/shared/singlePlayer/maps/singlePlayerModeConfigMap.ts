import ObjectTypeConfigMap from "../../object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../object/types/addObjectSignal";
import ObjectGroup from "../../object/types/objectGroup";
import ObjectTransform from "../../object/types/objectTransform";
import RoomGenerationVoxelGrid from "../../room/types/roomGeneration/roomGenerationVoxelGrid";
import { PLAYER_HEIGHT, TUTORIAL_SINGLE_PLAYER_MODE } from "../../system/sharedConstants";
import VoxelGrid from "../../voxel/types/voxelGrid";
import SinglePlayerModeConfig from "../types/singlePlayerModeConfig";
import SinglePlayerModeConfigMetadata from "../types/singlePlayerModeConfigMetadata";

const cachedMetadataByMode: {[singlePlayerMode: string]: SinglePlayerModeConfigMetadata} = {};

const SinglePlayerModeConfigMap: {[singlePlayerMode: string]: SinglePlayerModeConfig} = {};

SinglePlayerModeConfigMap[TUTORIAL_SINGLE_PLAYER_MODE] = {
    loadMetadata: () => {
        const cachedMetadata = cachedMetadataByMode[TUTORIAL_SINGLE_PLAYER_MODE];
        if (cachedMetadata)
            return cachedMetadata;

        // Manually set parameters:
        const entranceVoxelCol = 5;
        const entranceVoxelRow = 30;
        const X1 = 5, X2 = 3, X3 = 5, Z1 = 7, Z2 = 5, Z3 = 5;

        if (X1 % 2 == 0 || X2 % 2 == 0 || X3 % 2 == 0 || Z1 % 2 == 0 || Z2 % 2 == 0 || Z3 % 2 == 0)
            throw new Error("X1,X2,X3,Z1,Z2,Z3 must all be positive odd integers.");

        // Algebraically derived parameters:
        const X = X1 + X2 + X3;
        const Z = Z1 + Z2 + Z3;
        const x0 = entranceVoxelCol - 0.5 * (X1 - 1);
        const z0 = entranceVoxelRow - Z + 1;

        const hotspots = {
            // A patch of bare floor a few steps in front of the entrance. The tutorial ordinarily
            // looks for one of its own, out from wherever the user is standing when it comes to ask
            // for it, and falls back to this one when that search comes up empty.
            floor: {row: entranceVoxelRow - 3, col: entranceVoxelCol},
            npc: {row: z0 + Z1 + 0.5*(Z2 - 1), col: x0 + X - 1},
            door: {row: z0, col: x0 + X - 1 - 0.5*(X3 - 1)},
        };
        const rects = {
            floor1: {rowStart: z0 + Z1, colStart: x0, numRows: Z2 + Z3, numCols: X1},
            floor2: {rowStart: z0 + Z1, colStart: x0 + X1, numRows: Z2, numCols: X2},
            floor3: {rowStart: z0, colStart: x0 + X1 + X2, numRows: Z1 + Z2, numCols: X3},
            wall1: {rowStart: z0 + Z1, colStart: x0 + X1, numRows: Z2, numCols: 1},
            wall2: {rowStart: z0 + Z1 - 1, colStart: x0 + X1 + X2, numRows: 1, numCols: X3},
        };

        const metadata: SinglePlayerModeConfigMetadata = {entranceVoxelCol, entranceVoxelRow, hotspots, rects};
        cachedMetadataByMode[TUTORIAL_SINGLE_PLAYER_MODE] = metadata;
        return metadata;
    },
    texturePackPath: "default",
    buildRoom: (voxelGrid: VoxelGrid, objectGroup: ObjectGroup) =>
    {
        // Note: See the "Tutorial Room" section of `docs/geometry/room_generation.md` for
        // more details on what these variables mean geometrically.

        const config = SinglePlayerModeConfigMap[TUTORIAL_SINGLE_PLAYER_MODE];
        const c = config.loadMetadata();

        // Add the floors and walls.
        const grid = new RoomGenerationVoxelGrid();
        grid.createRegion(c.rects.floor1.rowStart, c.rects.floor1.colStart, c.rects.floor1.numRows, c.rects.floor1.numCols, 16, 51, 41);
        grid.createRegion(c.rects.floor2.rowStart, c.rects.floor2.colStart, c.rects.floor2.numRows, c.rects.floor2.numCols, 6, 51, 43);
        grid.createRegion(c.rects.floor3.rowStart, c.rects.floor3.colStart, c.rects.floor3.numRows, c.rects.floor3.numCols, 31, 51, 46);
        grid.createWalls(c.rects.wall1.rowStart, c.rects.wall1.colStart, c.rects.wall1.numRows, c.rects.wall1.numCols);
        grid.createWalls(c.rects.wall2.rowStart, c.rects.wall2.colStart, c.rects.wall2.numRows, c.rects.wall2.numCols);
        grid.generate(voxelGrid);

        // Add the NPC.
        objectGroup.objectById["npc"] = new AddObjectSignal("", "@npc", "Receptionist",
            ObjectTypeConfigMap.getIndexByType("Player"), "npc",
            new ObjectTransform(
                {x: c.hotspots.npc.col + 0.5, y: 0.5 * PLAYER_HEIGHT, z: c.hotspots.npc.row + 0.5},
                {x: 1, y: 0, z: 0}));

        // Add the door.
        objectGroup.objectById["door"] = new AddObjectSignal("", "", "",
            ObjectTypeConfigMap.getIndexByType("Door"), "door",
            new ObjectTransform(
                {x: c.hotspots.door.col + 0.5, y: 0, z: c.hotspots.door.row + 0.001},
                {x: 0, y: 0, z: 1}));
    },
};

export default SinglePlayerModeConfigMap;
