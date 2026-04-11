import Vec3 from "../types/vec3"

const Vector3DUtil =
{
    normalize: (v: Vec3): Vec3 =>
    {
        const length = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z);
        if (length == 0)
            return { x: 0, y: 0, z: 0 };
        const lengthInv = 1 / length;
        return { x: v.x * lengthInv, y: v.y * lengthInv, z: v.z * lengthInv };
    },
    scale: (v: Vec3, scaleFactor: number): Vec3 =>
    {
        return { x: v.x * scaleFactor, y: v.y * scaleFactor, z: v.z * scaleFactor };
    },
    add: (v1: Vec3, v2: Vec3): Vec3 =>
    {
        return { x: v1.x + v2.x, y: v1.y + v2.y, z: v1.z + v2.z };
    },
    subtract: (v1: Vec3, v2: Vec3): Vec3 =>
    {
        return { x: v1.x - v2.x, y: v1.y - v2.y, z: v1.z - v2.z };
    },
    cross: (v1: Vec3, v2: Vec3): Vec3 =>
    {
        return {
            x: v1.y * v2.z - v1.z * v2.y,
            y: v1.z * v2.x - v1.x * v2.z,
            z: v1.x * v2.y - v1.y * v2.x
        };
    },
    dot: (v1: Vec3, v2: Vec3): number =>
    {
        return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    },
    length: (v: Vec3): number =>
    {
        return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    },
    lengthSqr: (v: Vec3): number =>
    {
        return v.x * v.x + v.y * v.y + v.z * v.z;
    },
    distSqr: (v1: Vec3, v2: Vec3): number =>
    {
        const dx = v2.x - v1.x;
        const dy = v2.y - v1.y;
        const dz = v2.z - v1.z;
        return dx*dx + dy*dy + dz*dz;
    },
}

export default Vector3DUtil;