import ObjectTypeConfigMap from "../../object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../object/types/addObjectSignal";
import ObjectGroup from "../../object/types/objectGroup";
import ObjectTransform from "../../object/types/objectTransform";
import RoomGenerationPalette from "../../room/types/roomGeneration/roomGenerationPalette";
import RoomGenerationVolume from "../../room/types/roomGeneration/roomGenerationVolume";
import RoomGenerationSpaceUtil from "../../room/util/roomGenerationSpaceUtil";
import RoomGenerationVolumeUtil from "../../room/util/roomGenerationVolumeUtil";
import { PLAYER_HEIGHT, TUTORIAL_SINGLE_PLAYER_MODE } from "../../system/sharedConstants";
import VoxelGrid from "../../voxel/types/voxelGrid";
import SinglePlayerModeConfig from "../types/singlePlayerModeConfig";
import SinglePlayerModeConfigMetadata from "../types/singlePlayerModeConfigMetadata";

const cachedMetadataByMode: {[singlePlayerMode: string]: SinglePlayerModeConfigMetadata} = {};

// The tutorial room's spaces are each finished in a palette of their own, so that a player being
// walked from one to the next can see that he has moved from one room into another. Nothing stands
// free inside them, so what the accent texture would decorate never comes up.
const TUTORIAL_PALETTES: {[name: string]: RoomGenerationPalette} = {
    arrival: {floorTextureIndex: 16, ceilingTextureIndex: 51, wallTextureIndex: 41, propTextureIndex: 41},
    passage: {floorTextureIndex: 6, ceilingTextureIndex: 51, wallTextureIndex: 43, propTextureIndex: 43},
    reception: {floorTextureIndex: 31, ceilingTextureIndex: 51, wallTextureIndex: 46, propTextureIndex: 46},
};

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

        // The tutorial declares a ground storey and nothing above it, which is what makes it a
        // single-storey room (see buildRoom below).
        const storey = RoomGenerationVolumeUtil.GROUND_STOREY;
        const volume = (rowStart: number, colStart: number, numRows: number,
            numCols: number): RoomGenerationVolume => ({...storey, rowStart, colStart, numRows, numCols});

        const volumes = {
            // The four rooms the tutorial is walked through, from the one the player arrives in to
            // the one he leaves by.
            room1: volume(z0 + Z1, x0, Z2 + Z3, X1),
            room2: volume(z0 + Z1, x0 + X1 + 1, Z2, X2 - 1),
            room3: volume(z0 + Z1, x0 + X1 + X2, Z2, X3),
            room4: volume(z0, x0 + X1 + X2, Z1 - 1, X3),
            // The two stretches of wall between them, which the tutorial opens up as the player is
            // sent on. Until it does, these are mass like the rest of the room around it.
            wall1: volume(z0 + Z1, x0 + X1, Z2, 1),
            wall2: volume(z0 + Z1 - 1, x0 + X1 + X2, 1, X3),
        };

        const metadata: SinglePlayerModeConfigMetadata = {entranceVoxelCol, entranceVoxelRow, hotspots, volumes};
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

        // The room, as the four spaces standing open in it. Every one of them is on the ground
        // storey and none on the storey above, so the room is built no higher than the slab that
        // caps it: that slab is the ceiling the player is walked around under rather than anybody's
        // floor, and nothing stands in the empty height over it for a camera looking down into the
        // room to have to see past.
        RoomGenerationSpaceUtil.build(voxelGrid, [
            {volume: c.volumes.room1, palette: TUTORIAL_PALETTES.arrival},
            {volume: c.volumes.room2, palette: TUTORIAL_PALETTES.passage},
            {volume: c.volumes.room3, palette: TUTORIAL_PALETTES.reception},
            {volume: c.volumes.room4, palette: TUTORIAL_PALETTES.reception},
        ]);

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
