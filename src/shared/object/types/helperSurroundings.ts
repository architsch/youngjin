import Vec3 from "../../math/types/vec3";
import Voxel from "../../voxel/types/voxel";

// Where a helper is played, as its behavior asks of it (see HelperBehaviorUtil): the blocks it walks round, where the
// people in its room stand (at a player's middle), whether an admin holds it still, and how what it does is shown.
type HelperSurroundings = {
    voxels: Voxel[],
    getPeople: () => Vec3[],
    // One of them by user id, while they are in its room.
    getPerson: (userID: string) => Vec3 | undefined,
    // Whether anyone's lines wait for its answer.
    hasLinesWaiting: () => boolean,
    isHeld: () => boolean,
    showAt: () => void,
    showFacing: () => void,
    showSaying: () => void,
    showThinking: () => void,
};

export default HelperSurroundings;
