import RandomNumberGenerator from "../../../math/types/randomNumberGenerator";
import SandboxRoomBuilder from "../../../room/generation/types/builder/sandboxRoomBuilder";
import Room from "../../../room/types/room";
import { COLLISION_LAYER_MIN, NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../../../system/sharedConstants";
import SinglePlayerModeConfig from "./singlePlayerModeConfig";

const SandboxSinglePlayerModeConfig: SinglePlayerModeConfig =
{
    getRoomBuilderParams: () =>
    {
        return {
            entranceVoxelCol: Math.floor(0.5 * NUM_VOXEL_COLS),
            entranceVoxelRow: Math.floor(0.5 * NUM_VOXEL_ROWS),
            entranceVoxelCollisionLayer: COLLISION_LAYER_MIN,
            paletteSelection: {texturePackPaths: ["default"], palettes: []},
            hotspots: {},
            volumes: {},
            rand: new RandomNumberGenerator(),
        };
    },
    buildRoom: (room: Room) =>
    {
        new SandboxRoomBuilder(SandboxSinglePlayerModeConfig.getRoomBuilderParams(), room).run();
    },
};

export default SandboxSinglePlayerModeConfig;