import LineSegment2 from "./lineSegment2";

export default interface RaycastHitResult2 // Result of performing a 2D raycast
{
    hitRayScale: number;
    hitLine: LineSegment2 | undefined;
}