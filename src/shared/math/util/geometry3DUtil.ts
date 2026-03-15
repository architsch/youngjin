import AABB3 from "../types/aabb3";
import Vec3 from "../types/vec3";
import RaycastHitResult3 from "../types/raycastHitResult3";

const Geometry3DUtil =
{
    AABBsOverlap: (a: AABB3, b: AABB3): boolean =>
    {
        return Math.abs(a.x - b.x) < (a.halfSizeX + b.halfSizeX) &&
            Math.abs(a.y - b.y) < (a.halfSizeY + b.halfSizeY) &&
            Math.abs(a.z - b.z) < (a.halfSizeZ + b.halfSizeZ);
    },
    // Returns the AABB-casting ray's scale factor which, when applied to the ray,
    // pushes the source AABB to end up at the point of collision
    // between itself and the target AABB.
    // (Returns hitRayScale=1 when the source AABB doesn't hit the target AABB)
    // Uses the slab method for ray-AABB intersection.
    castAABBAgainstAABB: (source: AABB3, destination: Vec3, target: AABB3): RaycastHitResult3 =>
    {
        // NOTE FOR MY FUTURE SELF:
        // Claude wrote the algorithm below, so it's okay if you don't
        // understand what's going on here. It's probably just some super nerdy stuff
        // found somewhere on the internet.

        // Expand target by source's half-sizes (Minkowski sum)
        const minX = target.x - target.halfSizeX - source.halfSizeX;
        const minY = target.y - target.halfSizeY - source.halfSizeY;
        const minZ = target.z - target.halfSizeZ - source.halfSizeZ;
        const maxX = target.x + target.halfSizeX + source.halfSizeX;
        const maxY = target.y + target.halfSizeY + source.halfSizeY;
        const maxZ = target.z + target.halfSizeZ + source.halfSizeZ;

        const dx = destination.x - source.x;
        const dy = destination.y - source.y;
        const dz = destination.z - source.z;

        let tmin = 0;
        let tmax = 1;
        let normalX = 0, normalY = 0, normalZ = 0;

        // X slab
        if (dx !== 0)
        {
            const tx1 = (minX - source.x) / dx;
            const tx2 = (maxX - source.x) / dx;
            const tentry = Math.min(tx1, tx2);
            const texit = Math.max(tx1, tx2);
            if (tentry > tmin)
            {
                tmin = tentry;
                normalX = dx > 0 ? -1 : 1;
                normalY = 0;
                normalZ = 0;
            }
            tmax = Math.min(tmax, texit);
        }
        else
        {
            if (source.x <= minX || source.x >= maxX)
                return { hitRayScale: 1, hitNormal: undefined };
        }

        if (tmin > tmax)
            return { hitRayScale: 1, hitNormal: undefined };

        // Y slab
        if (dy !== 0)
        {
            const ty1 = (minY - source.y) / dy;
            const ty2 = (maxY - source.y) / dy;
            const tentry = Math.min(ty1, ty2);
            const texit = Math.max(ty1, ty2);
            if (tentry > tmin)
            {
                tmin = tentry;
                normalX = 0;
                normalY = dy > 0 ? -1 : 1;
                normalZ = 0;
            }
            tmax = Math.min(tmax, texit);
        }
        else
        {
            if (source.y <= minY || source.y >= maxY)
                return { hitRayScale: 1, hitNormal: undefined };
        }

        if (tmin > tmax)
            return { hitRayScale: 1, hitNormal: undefined };

        // Z slab
        if (dz !== 0)
        {
            const tz1 = (minZ - source.z) / dz;
            const tz2 = (maxZ - source.z) / dz;
            const tentry = Math.min(tz1, tz2);
            const texit = Math.max(tz1, tz2);
            if (tentry > tmin)
            {
                tmin = tentry;
                normalX = 0;
                normalY = 0;
                normalZ = dz > 0 ? -1 : 1;
            }
            tmax = Math.min(tmax, texit);
        }
        else
        {
            if (source.z <= minZ || source.z >= maxZ)
                return { hitRayScale: 1, hitNormal: undefined };
        }

        if (tmin > tmax || tmin < 0 || tmin > 1)
            return { hitRayScale: 1, hitNormal: undefined };

        return { hitRayScale: tmin, hitNormal: { x: normalX, y: normalY, z: normalZ } };
    },
}

export default Geometry3DUtil;