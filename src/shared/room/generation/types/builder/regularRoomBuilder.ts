import MultiplayerRoomBuilder from "./multiplayerRoomBuilder";
import RoomBuilder from "./roomBuilder";

// A handful of small areas gathered around the one the owner arrives into, and nothing more.
const NUM_SEED_ATTEMPTS = 5;
const MIN_SEED_SPAN = 3;
const MAX_SEED_SPAN = 5;
const GROWTH_ROUNDS = 4;

const PROP_CHANCE_PER_CELL = 0.05;
const MAX_PROP_STACK_HEIGHT = 2;

// A Regular room is more of a personal space than a shared playground. It therefore starts as a
// relatively small, cosy home-like environment that is only one storey tall. The rest of the room
// is left as fully occupied blocks, which the user is then able to manually remove block-by-block
// if he wants - just like how mining works in Minecraft.
export default class RegularRoomBuilder extends MultiplayerRoomBuilder
{
    override run(): RoomBuilder
    {
        super.run();

        this.allocateAreas(NUM_SEED_ATTEMPTS, MIN_SEED_SPAN, MAX_SEED_SPAN, ["FirstStorey"])
            .growAreas(GROWTH_ROUNDS)
            .connectAreas()
            .carveOutRoom()
            .placeProps(PROP_CHANCE_PER_CELL, MAX_PROP_STACK_HEIGHT);
        return this;
    }
}
