import { NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../../../../system/sharedConstants";
import { RoomVolumeConstructorMap } from "../../maps/roomVolumeConstructorMap";
import MultiplayerRoomBuilder from "./multiplayerRoomBuilder";
import RoomBuilder from "./roomBuilder";

// The open space the hub is built around: a lounge standing through both storeys, in the middle of
// the room, with the smaller areas gathered around it.
const LOUNGE_HALF_SPAN = 5;

// The wings: areas shaped to hold a flight of steps, so that the hub reliably comes out with a
// second storey to climb to. They are placed before the smaller areas, while there is still room
// around the lounge for something this shape.
const NUM_WING_ATTEMPTS = 12;

const NUM_SEED_ATTEMPTS = 14;
const MIN_SEED_SPAN = 3;
const MAX_SEED_SPAN = 6;
const GROWTH_ROUNDS = 12;

// How likely an area big enough for a flight of steps is to be given a storey of its own above it.
const SECOND_STOREY_CHANCE = 0.7;

const PROP_CHANCE_PER_CELL = 0.04;
const MAX_PROP_STACK_HEIGHT = 3;

// A Hub room is a shared social playground, so it consists of a vast open space in the middle (with
// a high ceiling), surrounded by relatively smaller random areas across two storeys. Think of it as
// a wide multi-storey lounge or lobby.
export default class HubRoomBuilder extends MultiplayerRoomBuilder
{
    override run(): RoomBuilder
    {
        super.run();

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
            .raiseSecondStoreys(SECOND_STOREY_CHANCE, true /* a hub is never a single storey */)
            .connectAreas()
            .carveOutRoom()
            .placeProps(PROP_CHANCE_PER_CELL, MAX_PROP_STACK_HEIGHT);
        return this;
    }
}
