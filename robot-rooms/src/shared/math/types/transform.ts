import Vec3 from "./vec3";

// A placement as plain data, in whatever space its user defines (e.g. a label's patch relative to its
// object; see ObjectTypeConfig). ObjectTransform is the stored, room-space kind.
export default interface Transform
{
    pos: Vec3;
    dir: Vec3;
    scale: Vec3;
}
