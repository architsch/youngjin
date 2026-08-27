import RandomNumberGenerator from "../../../math/types/randomNumberGenerator";
import TutorialRoomBuilder from "../../../room/generation/types/builder/tutorialRoomBuilder";
import RoomBuilderParams from "../../../room/generation/types/params/roomBuilderParams";
import RoomPalette from "../../../room/generation/types/roomPalette";
import RoomVolume from "../../../room/generation/types/roomVolume";
import Room from "../../../room/types/room";
import { COLLISION_LAYER_MIN, DOOR_FOOTPRINT_HEIGHT, PLAYER_HEIGHT, STOREY_FLOOR_COLLISION_LAYER } from "../../../system/sharedConstants";
import SinglePlayerModeConfig from "./singlePlayerModeConfig";

let cachedParams: RoomBuilderParams | undefined;

// The tutorial room is the same room every time it is built, so its generator is handed a fixed
// seed rather than a fresh one. Nothing in the tutorial's own construction draws from it today; it
// is here so that a template room and a procedural one are built from the same kind of thing.
const TUTORIAL_SEED = 0;

// The tutorial room's spaces are each finished in a palette of their own, so that a player being
// walked from one to the next can see that he has moved from one room into another. Nothing stands
// free inside them, so what the prop texture would decorate never comes up.
const ARRIVAL_PALETTE = new RoomPalette(16, 51, 41, 41);
const PASSAGE_PALETTE = new RoomPalette(6, 51, 43, 43);
const RECEPTION_PALETTE = new RoomPalette(31, 51, 46, 46);

const TutorialSinglePlayerModeConfig: SinglePlayerModeConfig =
{
    getRoomBuilderParams: () =>
    {
        if (cachedParams)
            return cachedParams;

        // Note: See the "Tutorial Room" section of `docs/geometry/room_generation.md` for
        // more details on what these variables mean geometrically.

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
            // A patch of bare floor a few steps in front of the entrance. The tutorial ordinarily
            // looks for one of its own, out from wherever the user is standing when it comes to ask
            // for it, and falls back to this one when that search comes up empty.
            floor: {x: entranceVoxelCol + 0.5, y: 0, z: entranceVoxelRow - 3 + 0.5},
            npc: {x: x0 + X - 1 + 0.5, y: 0.5 * PLAYER_HEIGHT, z: z0 + Z1 + 0.5*(Z2 - 1) + 0.5},
            // A door's collider is centered on its position while the door itself stands on the
            // floor, so its origin sits half a footprint up (see DoorObjectTypeConfig).
            door: {x: x0 + X - 1 - 0.5*(X3 - 1) + 0.5, y: 0.5 * DOOR_FOOTPRINT_HEIGHT, z: z0},
        };

        // Every one of the tutorial's spaces is on the first storey and none on the storey above,
        // which is what makes it a single-storey room: it is built no higher than the slab that
        // caps it, and nothing stands in the empty height over that for a camera looking down into
        // the room to have to see past.
        const volume = (rowStart: number, colStart: number,
            numRows: number, numCols: number,
            palette?: RoomPalette): RoomVolume =>
            new RoomVolume(rowStart, rowStart + numRows - 1, colStart, colStart + numCols - 1,
                COLLISION_LAYER_MIN, STOREY_FLOOR_COLLISION_LAYER - 1, palette);

        const volumes = {
            // The four rooms the tutorial is walked through, from the one the player arrives in to
            // the one he leaves by.
            room1: volume(z0 + Z1, x0, Z2 + Z3, X1, ARRIVAL_PALETTE),
            room2: volume(z0 + Z1, x0 + X1 + 1, Z2, X2 - 1, PASSAGE_PALETTE),
            room3: volume(z0 + Z1, x0 + X1 + X2, Z2, X3, RECEPTION_PALETTE),
            room4: volume(z0, x0 + X1 + X2, Z1 - 1, X3, RECEPTION_PALETTE),
            // The two stretches of wall between them, which the tutorial opens up as the player is
            // sent on. Until it does, these are mass like the rest of the room around it.
            wall1: volume(z0 + Z1, x0 + X1, Z2, 1),
            wall2: volume(z0 + Z1 - 1, x0 + X1 + X2, 1, X3),
        };

        cachedParams = {
            entranceVoxelCol,
            entranceVoxelRow,
            entranceVoxelCollisionLayer,
            // The tutorial's rooms each carry the palette they are finished in, so there is nothing
            // left for the room to draw - only the pack those palettes are positions within.
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
