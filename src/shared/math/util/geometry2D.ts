import AABB2 from "../types/aabb2";
import Circle2 from "../types/circle2";
import Vec2 from "../types/vec2";
import Vector2D from "./vector2D";
import LineSegment2 from "../types/lineSegment2";
import RaycastHitResult2 from "../types/raycastHitResult2";

const Geometry2D =
{
    // Returns the circle-casting ray's scale factor which, when applied to the ray,
    // makes the circle up at the point of collision
    // between itself and the target AABB.
    // (Returns 1 when the circle doesn't hit the AABB)
    // (Warning: This function won't work 100% accurately near the corner of the AABB, where the circle will be treated like a square.)
    circlecastToAABB: (circle: Circle2, circleEnd: Vec2, aabb: AABB2): RaycastHitResult2 =>
    {
        const bottomLeftCorner: Vec2 = { x: aabb.x1 - circle.radius, y: aabb.y1 - circle.radius };
        const bottomRightCorner: Vec2 = { x: aabb.x2 + circle.radius, y: aabb.y1 - circle.radius };
        const topLeftCorner: Vec2 = { x: aabb.x1 - circle.radius, y: aabb.y2 + circle.radius };
        const topRightCorner: Vec2 = { x: aabb.x2 + circle.radius, y: aabb.y2 + circle.radius };

        const bottom: LineSegment2 = {start: bottomLeftCorner, end: bottomRightCorner};
        const right: LineSegment2 = {start: bottomRightCorner, end: topRightCorner};
        const top: LineSegment2 = {start: topRightCorner, end: topLeftCorner};
        const left: LineSegment2 = {start: topLeftCorner, end: bottomLeftCorner};

        const circleStart: Vec2 = { x: circle.x, y: circle.y };
        const ray: LineSegment2 = { start: circleStart, end: circleEnd };
        let minHitRayScale = 1;
        let hitRayScale: number;
        let hitLine: LineSegment2 | undefined;

        hitRayScale = Math.min(minHitRayScale, Geometry2D.raycastToLine(ray, bottom, true));
        if (hitRayScale < minHitRayScale)
        {
            minHitRayScale = hitRayScale;
            hitLine = bottom;
        }
        hitRayScale = Math.min(minHitRayScale, Geometry2D.raycastToLine(ray, right, true));
        if (hitRayScale < minHitRayScale)
        {
            minHitRayScale = hitRayScale;
            hitLine = right;
        }
        hitRayScale = Math.min(minHitRayScale, Geometry2D.raycastToLine(ray, top, true));
        if (hitRayScale < minHitRayScale)
        {
            minHitRayScale = hitRayScale;
            hitLine = top;
        }
        hitRayScale = Math.min(minHitRayScale, Geometry2D.raycastToLine(ray, left, true));
        if (hitRayScale < minHitRayScale)
        {
            minHitRayScale = hitRayScale;
            hitLine = left;
        }
        return { hitRayScale: minHitRayScale, hitLine };
    },
    // Returns the ray's scale factor which, when applied to the ray,
    // makes the ray end up at the point of intersection
    // between itself and the target line segment.
    // (Returns 1 when the ray doesn't hit the line)
    raycastToLine: (ray: LineSegment2, line: LineSegment2, hitLineFromRightSideOnly: boolean = false): number =>
    {
        const rayFromTo = Vector2D.subtract(ray.end, ray.start);
        const lineFromTo = Vector2D.subtract(line.end, line.start);
        const cross = Vector2D.cross(rayFromTo, lineFromTo);
        if (cross == 0)
            return 1;
        if (hitLineFromRightSideOnly && cross > 0)
            return 1;
        const crossInverse = 1 / cross;
        const startDiff = Vector2D.subtract(line.start, ray.start);
        const rayScale = Vector2D.cross(startDiff, lineFromTo) * crossInverse;
        const lineScale = Vector2D.cross(startDiff, rayFromTo) * crossInverse;
        if (rayScale < 0 || rayScale > 1 || lineScale < 0 || lineScale > 1)
            return 1;
        return rayScale;
    },
}

export default Geometry2D;