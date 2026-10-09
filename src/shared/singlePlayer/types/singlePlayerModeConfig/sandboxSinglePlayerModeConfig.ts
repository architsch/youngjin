import RandomNumberGenerator from "../../../math/types/randomNumberGenerator";
import SandboxRoomBuilder from "../../../room/generation/types/builder/sandboxRoomBuilder";
import Room from "../../../room/types/room";
import { MAX_ROOM_X, MAX_ROOM_Z } from "../../../system/sharedConstants";
import SinglePlayerModeConfig from "./singlePlayerModeConfig";

const SandboxSinglePlayerModeConfig: SinglePlayerModeConfig =
{
    getRoomBuilderParams: () =>
    {
        return {
            entrancePos: {x: 0.5 * MAX_ROOM_X + 0.5, y: 0, z: 0.5 * MAX_ROOM_Z + 0.5},
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