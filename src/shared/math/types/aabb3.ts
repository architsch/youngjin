import Vec3 from "./vec3";

export default interface AABB3 // 3D Axis-Aligned Bounding Box
{
    center: Vec3;
    halfSize: Vec3;
}