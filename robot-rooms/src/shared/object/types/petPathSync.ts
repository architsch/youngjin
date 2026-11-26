import Vec3 from "../../math/types/vec3";
import ObjectWaypoint from "./objectWaypoint";

// What a pet's room was last told of where it goes (see PetPathSyncUtil): the way, which point of it comes next, where
// that has brought the pet by now for whoever plays it out, which of the pet's ways it was (see PetBehavior.pathRevision),
// whether the pet stood turning to its way then, how many points of its way were still to be told, and whether the pet
// was off its way then, the room being told where its body had been. And, since the pet's last beat: where the room
// has had it, from the place it had it then on through each point of the way it has come by; and where its body has
// been, each point with how many seconds after the one before it the body was there, and the seconds since the last
// of them.
type PetPathSync = {
    waypoints: ObjectWaypoint[],
    next: number,
    shownAt: Vec3,
    revision: number,
    turning: boolean,
    untold: number,
    carried: boolean,
    shownTrail: Vec3[],
    trail: {pos: Vec3, seconds: number}[],
    sinceTrail: number,
};

export default PetPathSync;
