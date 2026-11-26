import Vec3 from "../../math/types/vec3";
import Voxel from "../../voxel/types/voxel";
import AddObjectSignal from "./addObjectSignal";
import PetPersonSighting from "./petPersonSighting";
import PetSighting from "./petSighting";

// Where a pet is played, as its behavior asks of it (see PetBehaviorUtil): the time, by whoever plays it; the room, by
// its id, whose winds its physics knows (see PhysicsManager); the blocks it goes round and the things placed there; the
// room's other living pets, as they show; the players in it who can be seen, a ghost being nobody; and, where its
// owner's browser plays it, what they are looking at while they edit (their camera's pivot).
type PetSurroundings = {
    now: number,
    roomID: string,
    voxels: Voxel[],
    objectById: {[objectId: string]: AddObjectSignal},
    pets: PetSighting[],
    people: PetPersonSighting[],
    ownerFocus?: Vec3,
};

export default PetSurroundings;
