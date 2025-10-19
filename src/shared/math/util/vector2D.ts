import Vec2 from "../types/vec2"

const Vector2D =
{
    normalize: (v: Vec2): Vec2 =>
    {
        const length = Math.sqrt(v.x*v.x + v.y*v.y);
        if (length == 0)
            return { x: 0, y: 0 };
        const lengthInv = 1 / length;
        return { x: v.x * lengthInv, y: v.y * lengthInv };
    },
    scale: (v: Vec2, scaleFactor: number): Vec2 =>
    {
        return { x: v.x * scaleFactor, y: v.y * scaleFactor };
    },
    add: (v1: Vec2, v2: Vec2): Vec2 =>
    {
        return { x: v1.x + v2.x, y: v1.y + v2.y };
    },
    subtract: (v1: Vec2, v2: Vec2): Vec2 =>
    {
        return { x: v1.x - v2.x, y: v1.y - v2.y };
    },
    cross: (v1: Vec2, v2: Vec2): number =>
    {
        return v1.x * v2.y - v1.y * v2.x;
    },
    dot: (v1: Vec2, v2: Vec2): number =>
    {
        return v1.x * v2.x + v1.y * v2.y;
    },
    length: (v: Vec2): number =>
    {
        return Math.sqrt(v.x * v.x + v.y * v.y);
    },
    distSqr: (v1: Vec2, v2: Vec2): number =>
    {
        const dx = v2.x - v1.x;
        const dy = v2.y - v1.y;
        return dx*dx + dy*dy;
    },
}

export default Vector2D;