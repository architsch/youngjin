import Vec3 from "../../math/types/vec3";

// A user's pets coming into a room after them (see PetEntranceUtil): the spot they come in at, as the middle of a pet
// standing there, and the way they face; where each sets out from to walk there, as its middle too, behind the door
// their owner came in by, if they came in by one; which are still to come, by id, the next first; and since when that
// one has waited, by whoever plays them's clock.
type PetEntrance = {
    spot: {pos: Vec3, facing: number},
    from: Vec3 | undefined,
    waiting: string[],
    since: number,
};

export default PetEntrance;
