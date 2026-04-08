import AABB3 from "../types/aabb3";
import Vec3 from "../types/vec3";
import RaycastHitResult3 from "../types/raycastHitResult3";
import Vector3DUtil from "./vector3DUtil";
import { DIR_VEC } from "../../system/sharedConstants";

const Geometry3DUtil =
{
    pointOverlapsAABB: (point: Vec3, aabb: AABB3): boolean =>
    {
        return Math.abs(point.x - aabb.center.x) < aabb.halfSize.x &&
            Math.abs(point.y - aabb.center.y) < aabb.halfSize.y &&
            Math.abs(point.z - aabb.center.z) < aabb.halfSize.z;
    },
    AABBsOverlap: (a: AABB3, b: AABB3): boolean =>
    {
        return Math.abs(a.center.x - b.center.x) < (a.halfSize.x + b.halfSize.x) &&
            Math.abs(a.center.y - b.center.y) < (a.halfSize.y + b.halfSize.y) &&
            Math.abs(a.center.z - b.center.z) < (a.halfSize.z + b.halfSize.z);
    },
    getIntersectionAABB: (a: AABB3, b: AABB3): AABB3 =>
    {
        const x1 = Math.max(a.center.x - a.halfSize.x, b.center.x - b.halfSize.x);
        const x2 = Math.min(a.center.x + a.halfSize.x, b.center.x + b.halfSize.x);
        const y1 = Math.max(a.center.y - a.halfSize.y, b.center.y - b.halfSize.y);
        const y2 = Math.min(a.center.y + a.halfSize.y, b.center.y + b.halfSize.y);
        const z1 = Math.max(a.center.z - a.halfSize.z, b.center.z - b.halfSize.z);
        const z2 = Math.min(a.center.z + a.halfSize.z, b.center.z + b.halfSize.z);
        return {
            center: {x: 0.5*(x1+x2), y: 0.5*(y1+y2), z: 0.5*(z1+z2)},
            halfSize: {x: 0.5*(x2-x1), y: 0.5*(y2-y1), z: 0.5*(z2-z1)}
        };
    },
    // Returns the AABB-casting ray's scale factor which, when applied to the ray,
    // pushes the source AABB to end up at the point of collision
    // between itself and the target AABB.
    // (Returns hitRayScale=1 when the source AABB doesn't hit the target AABB)
    // Uses the slab method for ray-AABB intersection.
    // (Note: Look up "Cyrus-Beck clipping")
    castAABBAgainstAABB: (source: AABB3, destination: Vec3, target: AABB3): RaycastHitResult3 =>
    {
        // Expand target by source's half-sizes (Minkowski sum)
        const min = Vector3DUtil.subtract(
            Vector3DUtil.subtract(target.center, target.halfSize), source.halfSize);
        const max = Vector3DUtil.add(
            Vector3DUtil.add(target.center, target.halfSize), source.halfSize);

        const ray = Vector3DUtil.subtract(destination, source.center);

        let tmin = 0;
        let tmax = 1;
        let hitNormal: Vec3 | undefined = undefined;

        if (ray.x !== 0)
        {
            const tx1 = (min.x - source.center.x) / ray.x;
            const tx2 = (max.x - source.center.x) / ray.x;
            const tentry = Math.min(tx1, tx2);
            const texit = Math.max(tx1, tx2);
            if (tentry > tmin)
            {
                tmin = tentry;
                hitNormal = DIR_VEC[ray.x > 0 ? "-x" : "+x"];
            }
            tmax = Math.min(tmax, texit);
        }
        else if (source.center.x <= min.x || source.center.x >= max.x)
            return { hitRayScale: 1, hitNormal: undefined };

        if (tmin > tmax)
            return { hitRayScale: 1, hitNormal: undefined };

        if (ray.y !== 0)
        {
            const ty1 = (min.y - source.center.y) / ray.y;
            const ty2 = (max.y - source.center.y) / ray.y;
            const tentry = Math.min(ty1, ty2);
            const texit = Math.max(ty1, ty2);
            if (tentry > tmin)
            {
                tmin = tentry;
                hitNormal = DIR_VEC[ray.y > 0 ? "-y" : "+y"];
            }
            tmax = Math.min(tmax, texit);
        }
        else if (source.center.y <= min.y || source.center.y >= max.y)
            return { hitRayScale: 1, hitNormal: undefined };

        if (tmin > tmax)
            return { hitRayScale: 1, hitNormal: undefined };

        if (ray.z !== 0)
        {
            const tz1 = (min.z - source.center.z) / ray.z;
            const tz2 = (max.z - source.center.z) / ray.z;
            const tentry = Math.min(tz1, tz2);
            const texit = Math.max(tz1, tz2);
            if (tentry > tmin)
            {
                tmin = tentry;
                hitNormal = DIR_VEC[ray.z > 0 ? "-z" : "+z"];
            }
            tmax = Math.min(tmax, texit);
        }
        else if (source.center.z <= min.z || source.center.z >= max.z)
            return { hitRayScale: 1, hitNormal: undefined };

        if (tmin > tmax)
            return { hitRayScale: 1, hitNormal: undefined };

        if (tmin < 0 || tmin > 1)
            return { hitRayScale: 1, hitNormal: undefined };

        return { hitRayScale: tmin, hitNormal };
    },
}

export default Geometry3DUtil;