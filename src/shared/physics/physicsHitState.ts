import LineSegment2 from "../math/types/lineSegment2";

export default interface PhysicsHitState
{
    minHitRayScale: number;
    hitLine: LineSegment2 | undefined;
}