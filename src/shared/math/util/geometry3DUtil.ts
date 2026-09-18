import AABB3 from "../types/aabb3";
import Vec3 from "../types/vec3";
import RaycastHitResult3 from "../types/raycastHitResult3";
import Vector3DUtil from "./vector3DUtil";
import { DIR_VEC_BY_NAME } from "../../system/sharedConstants";

const WORLD_UP: Vec3 = {x: 0, y: 1, z: 0};

const Geometry3DUtil =
{
    areAABBsEqual: (a: AABB3, b: AABB3): boolean =>
    {
        return a.center.x === b.center.x && a.halfSize.x === b.halfSize.x &&
            a.center.y === b.center.y && a.halfSize.y === b.halfSize.y &&
            a.center.z === b.center.z && a.halfSize.z === b.halfSize.z;
    },
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
    // The in-plane axes a flat part gets when it is turned to face dir. Mirrors how three.js orients
    // an Object3D by lookAt, including its nudge for a dir along the up axis, so this agrees with what
    // is drawn (see InstancedPartUtil.bakePartMatrix).
    getFacingBasis: (dir: Vec3): {right: Vec3, up: Vec3} =>
    {
        let forward = (Vector3DUtil.lengthSqr(dir) == 0) ? {x: 0, y: 0, z: 1} : dir;
        forward = Vector3DUtil.normalize(forward);

        let right = Vector3DUtil.cross(WORLD_UP, forward);
        if (Vector3DUtil.lengthSqr(right) == 0)
        {
            forward = Vector3DUtil.normalize({x: forward.x, y: forward.y, z: forward.z + 0.0001});
            right = Vector3DUtil.cross(WORLD_UP, forward);
        }
        right = Vector3DUtil.normalize(right);

        return {right, up: Vector3DUtil.cross(forward, right)};
    },
    // Whether two squares that share a facing overlap once projected onto their common plane. Their
    // separation along dir is ignored, so parallel squares at different depths still count as
    // overlapping.
    squaresOverlap: (offsetA: Vec3, scaleA: Vec3, offsetB: Vec3, scaleB: Vec3, dir: Vec3): boolean =>
    {
        const basis = Geometry3DUtil.getFacingBasis(dir);
        const between = Vector3DUtil.subtract(offsetB, offsetA);
        return Math.abs(Vector3DUtil.dot(between, basis.right))
                < 0.5 * (Math.abs(scaleA.x) + Math.abs(scaleB.x))
            && Math.abs(Vector3DUtil.dot(between, basis.up))
                < 0.5 * (Math.abs(scaleA.y) + Math.abs(scaleB.y));
    },
    // Ray scale factor that moves the source AABB to its first contact with the target (1 = no hit).
    // Slab method (see Cyrus-Beck clipping).
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
                hitNormal = DIR_VEC_BY_NAME[ray.x > 0 ? "-x" : "+x"];
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
                hitNormal = DIR_VEC_BY_NAME[ray.y > 0 ? "-y" : "+y"];
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
                hitNormal = DIR_VEC_BY_NAME[ray.z > 0 ? "-z" : "+z"];
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