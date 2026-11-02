import Vec3 from "../../math/types/vec3";

// A place on an object's path (see SetObjectPathSignal), and how fast it goes there, in world units a second.
export default interface ObjectWaypoint
{
    pos: Vec3;
    speed: number;
}
