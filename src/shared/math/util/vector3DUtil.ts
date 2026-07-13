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
    mult: (v1: Vec3, v2: Vec3): Vec3 =>
    {
        return { x: v1.x * v2.x, y: v1.y * v2.y, z: v1.z * v2.z };
    },
    cross: (v1: Vec3, v2: Vec3): Vec3 =>
    {
        return {
            x: v1.y * v2.z - v1.z * v2.y,
            y: v1.z * v2.x - v1.x * v2.z,
            z: v1.x * v2.y - v1.y * v2.x
        };
    },
    // Rotates `v` by the shortest-arc rotation that carries unit direction `from` onto unit
    // direction `to`. `from`/`to` need not be pre-normalized. The result keeps the length of `v`
    // (it is a pure rotation), so a unit `v` stays unit. When `from == to` this is a no-op.
    rotateFromTo: (v: Vec3, from: Vec3, to: Vec3): Vec3 =>
    {
        const f = Vector3DUtil.normalize(from);
        const t = Vector3DUtil.normalize(to);

        // Quaternion that rotates f onto t: xyz = f × t, w = 1 + f·t.
        let qx = f.y * t.z - f.z * t.y;
        let qy = f.z * t.x - f.x * t.z;
        let qz = f.x * t.y - f.y * t.x;
        let qw = 1 + (f.x * t.x + f.y * t.y + f.z * t.z);

        if (qw < 1e-8) // f and t are (nearly) antiparallel: rotate 180° about any axis ⟂ f.
        {
            const ax = Math.abs(f.x), ay = Math.abs(f.y), az = Math.abs(f.z);
            if (ax <= ay && ax <= az) { qx = 0; qy = -f.z; qz = f.y; } // f × e_x
            else if (ay <= az) { qx = f.z; qy = 0; qz = -f.x; }        // f × e_y
            else { qx = -f.y; qy = f.x; qz = 0; }                      // f × e_z
            qw = 0;
        }

        const qLenInv = 1 / Math.sqrt(qx*qx + qy*qy + qz*qz + qw*qw);
        qx *= qLenInv; qy *= qLenInv; qz *= qLenInv; qw *= qLenInv;

        // Apply the quaternion to v: v + 2·q_xyz × (q_xyz × v + w·v).
        const tx = 2 * (qy * v.z - qz * v.y);
        const ty = 2 * (qz * v.x - qx * v.z);
        const tz = 2 * (qx * v.y - qy * v.x);
        return {
            x: v.x + qw * tx + (qy * tz - qz * ty),
            y: v.y + qw * ty + (qz * tx - qx * tz),
            z: v.z + qw * tz + (qx * ty - qy * tx)
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