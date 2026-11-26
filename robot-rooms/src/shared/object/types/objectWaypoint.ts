import Vec3 from "../../math/types/vec3";

// A place on an object's path (see SetObjectPathSignal), and how fast it goes there, in world units a second. carried:
// something takes it there, rather than its going by itself, so it turns nowhere for it (see PetPathSyncUtil); a path's
// carried places come first.
export default interface ObjectWaypoint
{
    pos: Vec3;
    speed: number;
    carried?: boolean;
}
