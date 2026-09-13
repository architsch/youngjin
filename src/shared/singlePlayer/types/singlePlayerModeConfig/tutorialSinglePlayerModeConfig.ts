import RandomNumberGenerator from "../../../math/types/randomNumberGenerator";
import TutorialRoomBuilder from "../../../room/generation/types/builder/tutorialRoomBuilder";
import RoomBuilderParams from "../../../room/generation/types/params/roomBuilderParams";
import RoomPalette from "../../../room/generation/types/roomPalette";
import RoomVolume from "../../../room/generation/types/roomVolume";
import Room from "../../../room/types/room";
import DoorObjectTypeConfig from "../../../object/types/objectTypeConfig/doorObjectTypeConfig";
import { PLAYER_HEIGHT } from "../../../object/types/objectTypeConfig/playerObjectTypeConfig";
import { COLLISION_LAYER_MIN, STOREY_FLOOR_COLLISION_LAYER } from "../../../system/sharedConstants";

const DOOR_FOOTPRINT_HEIGHT =
    DoorObjectTypeConfig.components.spawnedByAny.collider.hitboxSize.sizeY;
import SinglePlayerModeConfig from "./singlePlayerModeConfig";

let cachedParams: RoomBuilderParams | undefined;

// Fixed seed (currently unused), so template and procedural rooms share the same inputs.
const TUTORIAL_SEED = 0;

// Distinct palettes per space, so moving between them is visible.
const ARRIVAL_PALETTE = new RoomPalette(16, 51, 41, 41);
const PASSAGE_PALETTE = new RoomPalette(6, 51, 43, 43);
const RECEPTION_PALETTE = new RoomPalette(31, 51, 46, 46);

const TutorialSinglePlayerModeConfig: SinglePlayerModeConfig =
{
    getRoomBuilderParams: () =>
    {
        if (cachedParams)
            return cachedParams;

        // See the "Tutorial room" section of @docs/geometry/room_generation.md.

        // Manually set parameters:
        const entranceVoxelCol = 5;
        const entranceVoxelRow = 30;
        const entranceVoxelCollisionLayer = COLLISION_LAYER_MIN;
        const X1 = 5, X2 = 3, X3 = 5, Z1 = 7, Z2 = 5, Z3 = 5;

        if (X1 % 2 == 0 || X2 % 2 == 0 || X3 % 2 == 0 || Z1 % 2 == 0 || Z2 % 2 == 0 || Z3 % 2 == 0)
            throw new Error("X1,X2,X3,Z1,Z2,Z3 must all be positive odd integers.");

        // Algebraically derived parameters:
        const X = X1 + X2 + X3;
        const Z = Z1 + Z2 + Z3;
        const x0 = entranceVoxelCol - 0.5 * (X1 - 1);
        const z0 = entranceVoxelRow - Z + 1;

        const hotspots = {
            // Fallback floor patch in front of the entrance (the tutorial normally picks one near the user).
            floor: {x: entranceVoxelCol + 0.5, y: 0, z: entranceVoxelRow - 3 + 0.5},
            npc: {x: x0 + X - 1 + 0.5, y: 0.5 * PLAYER_HEIGHT, z: z0 + Z1 + 0.5*(Z2 - 1) + 0.5},
            // Door origin half a footprint up (collider-centred; see DoorObjectTypeConfig).
            door: {x: x0 + X - 1 - 0.5*(X3 - 1) + 0.5, y: 0.5 * DOOR_FOOTPRINT_HEIGHT, z: z0},
        };

        // All spaces are on the first storey (a single-storey room with nothing above it).
        const volume = (rowStart: number, colStart: number,
            numRows: number, numCols: number,
            palette?: RoomPalette): RoomVolume =>
            new RoomVolume(rowStart, rowStart + numRows - 1, colStart, colStart + numCols - 1,
                COLLISION_LAYER_MIN, STOREY_FLOOR_COLLISION_LAYER - 1, palette);

        const volumes = {
            // The four rooms, in the order the player passes through them.
            room1: volume(z0 + Z1, x0, Z2 + Z3, X1, ARRIVAL_PALETTE),
            room2: volume(z0 + Z1, x0 + X1 + 1, Z2, X2 - 1, PASSAGE_PALETTE),
            room3: volume(z0 + Z1, x0 + X1 + X2, Z2, X3, RECEPTION_PALETTE),
            room4: volume(z0, x0 + X1 + X2, Z1 - 1, X3, RECEPTION_PALETTE),
            // Walls between them, opened by steps.
            wall1: volume(z0 + Z1, x0 + X1, Z2, 1),
            wall2: volume(z0 + Z1 - 1, x0 + X1 + X2, 1, X3),
        };

        cachedParams = {
            entranceVoxelCol,
            entranceVoxelRow,
            entranceVoxelCollisionLayer,
            // Palettes are set per volume, so only the pack is selected.
            paletteSelection: {texturePackPaths: ["default"], palettes: []},
            hotspots,
            volumes,
            rand: new RandomNumberGenerator(TUTORIAL_SEED),
        };
        return cachedParams;
    },
    buildRoom: (room: Room) =>
    {
        new TutorialRoomBuilder(TutorialSinglePlayerModeConfig.getRoomBuilderParams(), room).run();
    },
};

export default TutorialSinglePlayerModeConfig;
