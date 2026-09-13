import { NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../../../../system/sharedConstants";
import { RoomVolumeConstructorMap } from "../../maps/roomVolumeConstructorMap";
import RoomVolumeUtil from "../../util/roomVolumeUtil";
import RoomPalette from "../roomPalette";
import MultiplayerRoomBuilder from "./multiplayerRoomBuilder";
import RoomBuilder from "./roomBuilder";

// The central lounge spanning both storeys.
const LOUNGE_HALF_SPAN = 5;

// Stair-capable wing attempts, placed before the smaller areas while space remains.
const NUM_WING_ATTEMPTS = 12;

const NUM_SEED_ATTEMPTS = 14;
const MIN_SEED_SPAN = 3;
const MAX_SEED_SPAN = 6;
const GROWTH_ROUNDS = 12;

// How likely an area big enough for a flight of steps is to be given a storey of its own above it.
const SECOND_STOREY_CHANCE = 0.7;

const PROP_CHANCE_PER_CELL = 0.04;
const MAX_PROP_STACK_HEIGHT = 3;

// A shared social space: a tall central lounge surrounded by smaller areas across two storeys.
export default class HubRoomBuilder extends MultiplayerRoomBuilder
{
    override run(): RoomBuilder
    {
        super.run();

        RoomVolumeUtil.carveOutVolume(this.room.voxelGrid.voxels,
            RoomVolumeConstructorMap["FirstStorey"](
                1, NUM_VOXEL_ROWS-2, 1, NUM_VOXEL_COLS-2, new RoomPalette(0, 0, 0, 0)));

        RoomVolumeUtil.carveOutVolume(this.room.voxelGrid.voxels,
            RoomVolumeConstructorMap["SecondStorey"](
                1, NUM_VOXEL_ROWS-2, 1, NUM_VOXEL_COLS-2, new RoomPalette(0, 0, 0, 0)));

        // NOTE: I temporarily turned off procedural generation for Hub rooms.
        // For now, every new Hub room will simply be two empty storeys.
        /*
        // The lounge, standing open from the room's own floor to its own ceiling. It is placed
        // rather than drawn, since it is the thing the rest of the hub is arranged around.
        this.addArea(RoomVolumeConstructorMap["BothStoreys"](
            Math.floor(0.5 * NUM_VOXEL_ROWS) - LOUNGE_HALF_SPAN,
            Math.floor(0.5 * NUM_VOXEL_ROWS) + LOUNGE_HALF_SPAN,
            Math.floor(0.5 * NUM_VOXEL_COLS) - LOUNGE_HALF_SPAN,
            Math.floor(0.5 * NUM_VOXEL_COLS) + LOUNGE_HALF_SPAN,
            this.nextPalette()));

        this.allocateStaircaseCapableAreas(NUM_WING_ATTEMPTS, ["FirstStorey"])
            .allocateAreas(NUM_SEED_ATTEMPTS, MIN_SEED_SPAN, MAX_SEED_SPAN, ["FirstStorey"])
            .growAreas(GROWTH_ROUNDS)
            .raiseSecondStoreys(SECOND_STOREY_CHANCE, true) // a hub is never a single storey
            .connectAreas()
            .carveOutRoom()
            .placeProps(PROP_CHANCE_PER_CELL, MAX_PROP_STACK_HEIGHT);
        */
        this.addEntranceDoor();
        return this;
    }
}
