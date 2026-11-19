import Vec2 from "./vec2";

export default interface AABB2 // 2D Axis-Aligned Bounding Box
{
    center: Vec2;
    halfSize: Vec2;
}