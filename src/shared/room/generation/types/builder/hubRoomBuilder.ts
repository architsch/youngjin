import { GENERATED_WALL_THICKNESS } from "../../../../system/sharedConstants";
import { RoomVolumeConstructorMap } from "../../maps/roomVolumeConstructorMap";
import RoomVolumeUtil from "../../util/roomVolumeUtil";
import RoomPalette from "../roomPalette";
import MultiplayerRoomBuilder from "./multiplayerRoomBuilder";
import RoomBuilder from "./roomBuilder";

// The central lounge spanning both storeys, in voxels: a strip a wall's thickness wide through the room's
// middle, and how far the lounge reaches to either side of it.
const LOUNGE_MIDDLE_STRIP_WIDTH = GENERATED_WALL_THICKNESS;
const LOUNGE_HALF_SPAN = 10;

// Stair-capable wing attempts, placed before the smaller areas while space remains.
const NUM_WING_ATTEMPTS = 12;

const NUM_SEED_ATTEMPTS = 14;
const MIN_SEED_SPAN = 6; // in voxels
const MAX_SEED_SPAN = 12;
const GROWTH_ROUNDS = 12;

// How likely an area big enough for a flight of steps is to be given a storey of its own above it.
const SECOND_STOREY_CHANCE = 0.7;

const PROP_CHANCE_PER_SPOT = 0.04;
const MAX_PROP_STACK_HEIGHT = 3;

// A shared social space: a tall central lounge surrounded by smaller areas across two storeys.
export default class HubRoomBuilder extends MultiplayerRoomBuilder
{
    override run(): RoomBuilder
    {
        super.run();

        const interior = RoomVolumeConstructorMap["Interior"]();

        RoomVolumeUtil.carveOutVolume(this.room.voxelGrid.voxels,
            RoomVolumeConstructorMap["FirstStorey"](
                interior.rowMin, interior.rowMax, interior.colMin, interior.colMax, new RoomPalette(0, 0, 0, 0)));

        RoomVolumeUtil.carveOutVolume(this.room.voxelGrid.voxels,
            RoomVolumeConstructorMap["SecondStorey"](
                interior.rowMin, interior.rowMax, interior.colMin, interior.colMax, new RoomPalette(0, 0, 0, 0)));

        // NOTE: I temporarily turned off procedural generation for Hub rooms.
        // For now, every new Hub room will simply be two empty storeys.
        /*
        // The lounge, standing open from the room's own floor to its own ceiling. It is placed
        // rather than drawn, since it is the thing the rest of the hub is arranged around.
        const middleRow = 0.5 * (interior.rowMin + interior.rowMax + 1);
        const middleCol = 0.5 * (interior.colMin + interior.colMax + 1);
        this.addArea(RoomVolumeConstructorMap["BothStoreys"](
            middleRow - LOUNGE_HALF_SPAN, middleRow + LOUNGE_MIDDLE_STRIP_WIDTH - 1 + LOUNGE_HALF_SPAN,
            middleCol - LOUNGE_HALF_SPAN, middleCol + LOUNGE_MIDDLE_STRIP_WIDTH - 1 + LOUNGE_HALF_SPAN,
            this.nextPalette()));

        this.allocateStaircaseCapableAreas(NUM_WING_ATTEMPTS, ["FirstStorey"])
            .allocateAreas(NUM_SEED_ATTEMPTS, MIN_SEED_SPAN, MAX_SEED_SPAN, ["FirstStorey"])
            .growAreas(GROWTH_ROUNDS)
            .raiseSecondStoreys(SECOND_STOREY_CHANCE, true) // a hub is never a single storey
            .connectAreas()
            .carveOutRoom()
            .placeProps(PROP_CHANCE_PER_SPOT, MAX_PROP_STACK_HEIGHT);
        */
        this.addEntranceDoor();
        return this;
    }
}
