import MultiplayerRoomBuilder from "./multiplayerRoomBuilder";
import RoomBuilder from "./roomBuilder";

// A handful of small areas gathered around the one the owner arrives into, and nothing more.
const NUM_SEED_ATTEMPTS = 5;
const MIN_SEED_SPAN = 3;
const MAX_SEED_SPAN = 5;
const GROWTH_ROUNDS = 4;

const PROP_CHANCE_PER_CELL = 0.05;
const MAX_PROP_STACK_HEIGHT = 2;

// A personal space: a small single-storey home carved out of solid blocks, which the owner can mine
// out further. Finished plainly via its palette selection (see
// @src/shared/room/generation/util/roomGenerationUtil.ts).
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
        this.addEntranceDoor();
        return this;
    }
}
