import MultiplayerRoomBuilder from "./multiplayerRoomBuilder";
import RoomBuilder from "./roomBuilder";

// A handful of areas gathered around the one the owner arrives into: enough open floor to furnish before
// any mining, which takes a wall out a small cube at a time.
const NUM_SEED_ATTEMPTS = 8;
const MIN_SEED_SPAN = 8; // in voxels
const MAX_SEED_SPAN = 14;
const GROWTH_ROUNDS = 8;

const PROP_CHANCE_PER_SPOT = 0.05;
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
            .placeProps(PROP_CHANCE_PER_SPOT, MAX_PROP_STACK_HEIGHT);
        this.addEntranceDoor();
        return this;
    }
}
