import Vec3 from "../../math/types/vec3";
import Voxel from "../../voxel/types/voxel";
import AddObjectSignal from "./addObjectSignal";
import HelperBehavior from "./helperBehavior";

// Where a helper is played, as its behavior asks of it (see HelperBehaviorUtil): the blocks it walks round, the things
// placed there, where the people in its room stand (at a player's middle), its room's other helpers, whether an admin
// holds it still, and how what it does is shown.
type HelperSurroundings = {
    voxels: Voxel[],
    objectById: {[objectId: string]: AddObjectSignal},
    getPeople: () => Vec3[],
    // One of them by user id, while they are in its room.
    getPerson: (userID: string) => Vec3 | undefined,
    getOtherHelpers: () => HelperBehavior[],
    // Whether anyone's lines wait for its answer.
    hasLinesWaiting: () => boolean,
    isHeld: () => boolean,
    showAt: () => void,
    showFacing: () => void,
    showSaying: () => void,
    showThinking: () => void,
};

export default HelperSurroundings;
