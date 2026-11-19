import AABB3 from "../types/aabb3";
import Vec3 from "../types/vec3";
import RaycastHitResult3 from "../types/raycastHitResult3";
import Vector3DUtil from "./vector3DUtil";
import DirUtil from "./dirUtil";
import { DIR_VEC_BY_CODE, DIR_VEC_BY_NAME } from "../../system/sharedConstants";

const WORLD_UP: Vec3 = {x: 0, y: 1, z: 0};

// Scratch for coneReachesAABB: where along the axis the nearest part of the box changes, and the squared
// distance to the box in between, as the coefficients of a quadratic (see addSlabGap).
const coneBreakpointsTemp: number[] = [];
let gapA = 0, gapB = 0, gapC = 0;
const ascending = (a: number, b: number): number => a - b;
// How far clear of a cone a box must be to be told so without the full test, which rounding could not undo.
const CONE_CLEARANCE_MARGIN = 0.0001;
// How many times a sphere's way is narrowed down to where it is nearest an upright cylinder, and again to where it
// first touches it.
const CYLINDER_SEARCH_STEPS = 48;

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
    // dir snapped onto its nearest axis, with getFacingBasis's in-plane axes made exact. For anything
    // that must face an axis whatever its stored facing decodes to (a zero component decodes slightly
    // off zero, which along the up axis would leave the roll to that error).
    getAxisFacingBasis: (dir: Vec3): {normal: Vec3, right: Vec3, up: Vec3} =>
    {
        const normal = DIR_VEC_BY_CODE[DirUtil.dirVecToCode(dir)];
        const {right, up} = Geometry3DUtil.getFacingBasis(normal);
        return {normal: {...normal}, right: roundToAxis(right), up: roundToAxis(up)};
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
    // Whether a sphere reaches into a box (one that only touches it doesn't).
    sphereOverlapsAABB: (center: Vec3, radius: number, box: AABB3): boolean =>
    {
        const gapX = Math.max(0, Math.abs(center.x - box.center.x) - box.halfSize.x);
        const gapY = Math.max(0, Math.abs(center.y - box.center.y) - box.halfSize.y);
        const gapZ = Math.max(0, Math.abs(center.z - box.center.z) - box.halfSize.z);
        return gapX * gapX + gapY * gapY + gapZ * gapZ < radius * radius;
    },
    // Ray scale factor that moves a sphere's centre to where the sphere first touches a box, with the way out of the
    // box there; no hit normal if it never does. One touching the box as it sets off hits at 0. Between the points
    // where the centre passes a face plane of the box, its squared distance to the box is a quadratic in how far it
    // has come (see coneReachesAABB).
    castSphereAgainstAABB: (center: Vec3, destination: Vec3, radius: number, target: AABB3): RaycastHitResult3 =>
    {
        const rayX = destination.x - center.x, rayY = destination.y - center.y, rayZ = destination.z - center.z;
        // The box's bounds, from where the sphere sets off.
        const minX = target.center.x - target.halfSize.x - center.x, maxX = target.center.x + target.halfSize.x - center.x;
        const minY = target.center.y - target.halfSize.y - center.y, maxY = target.center.y + target.halfSize.y - center.y;
        const minZ = target.center.z - target.halfSize.z - center.z, maxZ = target.center.z + target.halfSize.z - center.z;

        coneBreakpointsTemp.length = 0;
        addConeBreakpoint(minX, rayX, 1);
        addConeBreakpoint(maxX, rayX, 1);
        addConeBreakpoint(minY, rayY, 1);
        addConeBreakpoint(maxY, rayY, 1);
        addConeBreakpoint(minZ, rayZ, 1);
        addConeBreakpoint(maxZ, rayZ, 1);
        coneBreakpointsTemp.sort(ascending);
        coneBreakpointsTemp.push(1);

        let from = 0;
        for (let i = 0; i < coneBreakpointsTemp.length; ++i)
        {
            const to = coneBreakpointsTemp[i];
            const middle = 0.5 * (from + to);
            gapA = gapB = gapC = 0;
            addSlabGap(minX, maxX, rayX, middle);
            addSlabGap(minY, maxY, rayY, middle);
            addSlabGap(minZ, maxZ, rayZ, middle);

            // The squared distance to the box, less the sphere's squared radius: touching where it comes down to zero.
            const c = gapC - radius * radius;
            let hitRayScale: number | undefined = undefined;
            if (gapA * from * from + gapB * from + c <= 0)
                hitRayScale = from;
            else if (gapA > 0)
            {
                const discriminant = gapB * gapB - 4 * gapA * c;
                const root = (discriminant >= 0) ? (-gapB - Math.sqrt(discriminant)) / (2 * gapA) : Infinity;
                if (root > from && root <= to)
                    hitRayScale = root;
            }
            if (hitRayScale != undefined)
            {
                const at: Vec3 = {x: center.x + rayX * hitRayScale, y: center.y + rayY * hitRayScale,
                    z: center.z + rayZ * hitRayScale};
                return {hitRayScale, hitNormal: getWayOutOfAABB(at, target, {x: -rayX, y: -rayY, z: -rayZ})};
            }
            from = to;
        }
        return {hitRayScale: 1, hitNormal: undefined};
    },
    // The same against another sphere, where it stands: the way out of it is from its centre to the moving one's. One
    // moving away from it never hits, unless they overlap as it sets off.
    castSphereAgainstSphere: (center: Vec3, destination: Vec3, radius: number, targetCenter: Vec3,
        targetRadius: number): RaycastHitResult3 =>
    {
        const apart = Vector3DUtil.subtract(center, targetCenter);
        const ray = Vector3DUtil.subtract(destination, center);
        const reach = radius + targetRadius;
        const c = Vector3DUtil.lengthSqr(apart) - reach * reach;
        if (c <= 0)
            return {hitRayScale: 0, hitNormal: normalizeOr(apart, Vector3DUtil.scale(ray, -1))};

        const a = Vector3DUtil.lengthSqr(ray);
        const b = 2 * Vector3DUtil.dot(apart, ray);
        const discriminant = b * b - 4 * a * c;
        if (a == 0 || b >= 0 || discriminant < 0)
            return {hitRayScale: 1, hitNormal: undefined};
        const hitRayScale = (-b - Math.sqrt(discriminant)) / (2 * a);
        if (hitRayScale > 1)
            return {hitRayScale: 1, hitNormal: undefined};
        return {hitRayScale, hitNormal: Vector3DUtil.normalize(
            Vector3DUtil.add(apart, Vector3DUtil.scale(ray, hitRayScale)))};
    },
    // The same against an upright cylinder standing in a box, as wide as the box is along x and as tall: the way out of
    // it is level off its side, straight up or down off an end, and between the two off an end's rim. Along a straight
    // way the sphere's distance to it falls and then rises, never the other way round, so the first touch lies between
    // where the sphere touches the box and where it is nearest the cylinder.
    castSphereAgainstUprightCylinder: (center: Vec3, destination: Vec3, radius: number,
        target: AABB3): RaycastHitResult3 =>
    {
        const box = Geometry3DUtil.castSphereAgainstAABB(center, destination, radius, target);
        if (box.hitNormal == undefined)
            return box;

        const rayX = destination.x - center.x, rayY = destination.y - center.y, rayZ = destination.z - center.z;
        const clearance = (rayScale: number): number => getDistanceToUprightCylinder(center.x + rayX * rayScale,
            center.y + rayY * rayScale, center.z + rayZ * rayScale, target) - radius;

        let hitRayScale = box.hitRayScale;
        if (clearance(hitRayScale) > 0)
        {
            let low = hitRayScale, high = 1;
            for (let i = 0; i < CYLINDER_SEARCH_STEPS; ++i)
            {
                const third = (high - low) / 3;
                if (clearance(low + third) <= clearance(high - third))
                    high -= third;
                else
                    low += third;
            }
            let touching = 0.5 * (low + high);
            if (clearance(touching) > 0)
                return {hitRayScale: 1, hitNormal: undefined};
            let clear = hitRayScale;
            for (let i = 0; i < CYLINDER_SEARCH_STEPS; ++i)
            {
                const middle = 0.5 * (clear + touching);
                if (clearance(middle) > 0)
                    clear = middle;
                else
                    touching = middle;
            }
            hitRayScale = touching;
        }
        const at: Vec3 = {x: center.x + rayX * hitRayScale, y: center.y + rayY * hitRayScale,
            z: center.z + rayZ * hitRayScale};
        return {hitRayScale, hitNormal: getWayOutOfUprightCylinder(at, target, {x: -rayX, y: -rayY, z: -rayZ})};
    },
    // Whether a box reaches into a cone that widens from its apex to a flat base centred on baseCenter, its
    // radius growing by radiusPerDistance with each unit of distance from the apex along its axis.
    // A ball travelling the axis and growing with it sweeps the cone out, so the box is in the cone where it
    // is no further from the ball's centre than the ball's radius. Between the points where the centre passes
    // a face plane of the box, that is a quadratic in how far the centre has come.
    coneReachesAABB: (apex: Vec3, baseCenter: Vec3, radiusPerDistance: number, box: AABB3): boolean =>
    {
        const length = Math.hypot(baseCenter.x - apex.x, baseCenter.y - apex.y, baseCenter.z - apex.z);
        if (length == 0)
            return false;
        const axisX = (baseCenter.x - apex.x) / length;
        const axisY = (baseCenter.y - apex.y) / length;
        const axisZ = (baseCenter.z - apex.z) / length;

        // The box's bounds, from the apex.
        const minX = box.center.x - box.halfSize.x - apex.x, maxX = box.center.x + box.halfSize.x - apex.x;
        const minY = box.center.y - box.halfSize.y - apex.y, maxY = box.center.y + box.halfSize.y - apex.y;
        const minZ = box.center.z - box.halfSize.z - apex.z, maxZ = box.center.z + box.halfSize.z - apex.z;

        // Wholly past the base. The sweep below rounds the cone's end off past it, so a box across the base's
        // plane may count from a little outside the rim.
        if (axisX * (axisX > 0 ? minX : maxX) + axisY * (axisY > 0 ? minY : maxY) +
            axisZ * (axisZ > 0 ? minZ : maxZ) > length)
        {
            return false;
        }

        const slopeSqr = radiusPerDistance * radiusPerDistance;

        // Every ball lies inside the cone carried on past its base, so a box whose bounding sphere stays clear
        // of that cone's side is reached by none. Most boxes asked about are, and are told so here.
        const centerX = 0.5 * (minX + maxX), centerY = 0.5 * (minY + maxY), centerZ = 0.5 * (minZ + maxZ);
        const along = centerX * axisX + centerY * axisY + centerZ * axisZ;
        const across = Math.sqrt(Math.max(0, centerX * centerX + centerY * centerY + centerZ * centerZ - along * along));
        const boxRadius = Math.hypot(box.halfSize.x, box.halfSize.y, box.halfSize.z);
        if (across - radiusPerDistance * along > (boxRadius + CONE_CLEARANCE_MARGIN) * Math.sqrt(1 + slopeSqr))
            return false;

        // The ball's own radius per distance, and how far it travels: past the base, to touch the cone at its rim.
        const ballSlopeSqr = slopeSqr / (1 + slopeSqr);
        const sweepLength = length * (1 + slopeSqr);

        coneBreakpointsTemp.length = 0;
        addConeBreakpoint(minX, axisX, sweepLength);
        addConeBreakpoint(maxX, axisX, sweepLength);
        addConeBreakpoint(minY, axisY, sweepLength);
        addConeBreakpoint(maxY, axisY, sweepLength);
        addConeBreakpoint(minZ, axisZ, sweepLength);
        addConeBreakpoint(maxZ, axisZ, sweepLength);
        coneBreakpointsTemp.sort(ascending);
        coneBreakpointsTemp.push(sweepLength);

        let from = 0;
        for (let i = 0; i < coneBreakpointsTemp.length; ++i)
        {
            const to = coneBreakpointsTemp[i];
            const middle = 0.5 * (from + to);
            gapA = gapB = gapC = 0;
            addSlabGap(minX, maxX, axisX, middle);
            addSlabGap(minY, maxY, axisY, middle);
            addSlabGap(minZ, maxZ, axisZ, middle);

            // The squared distance to the box, less the ball's squared radius: in the cone where not above zero.
            const a = gapA - ballSlopeSqr;
            if (a * from * from + gapB * from + gapC <= 0 || a * to * to + gapB * to + gapC <= 0)
                return true;
            if (a > 0)
            {
                const lowest = -gapB / (2 * a);
                if (lowest > from && lowest < to && a * lowest * lowest + gapB * lowest + gapC <= 0)
                    return true;
            }
            from = to;
        }
        return false;
    },
}

// Where a point leaving the origin at a rate passes a plane, kept if it lies within the sweep.
function addConeBreakpoint(planeOffset: number, rate: number, sweepLength: number): void
{
    if (rate == 0)
        return;
    const distance = planeOffset / rate;
    if (distance > 0 && distance < sweepLength)
        coneBreakpointsTemp.push(distance);
}

// Adds one axis's share of the squared distance between a point leaving the origin at a rate and the slab
// [min, max], as the coefficients of a quadratic in how far the point has come. `at` tells which side of the
// slab the point is on.
function addSlabGap(min: number, max: number, rate: number, at: number): void
{
    const position = rate * at;
    if (position >= min && position <= max)
        return;
    const offset = (position < min) ? min : -max;
    const slope = (position < min) ? -rate : rate;
    gapA += slope * slope;
    gapB += 2 * offset * slope;
    gapC += offset * offset;
}

// From the nearest point of a box to a point outside it; for a point inside, the fallback's way (up, if that is nothing).
function getWayOutOfAABB(point: Vec3, box: AABB3, fallback: Vec3): Vec3
{
    const nearest: Vec3 = {
        x: Math.max(box.center.x - box.halfSize.x, Math.min(box.center.x + box.halfSize.x, point.x)),
        y: Math.max(box.center.y - box.halfSize.y, Math.min(box.center.y + box.halfSize.y, point.y)),
        z: Math.max(box.center.z - box.halfSize.z, Math.min(box.center.z + box.halfSize.z, point.z)),
    };
    return normalizeOr(Vector3DUtil.subtract(point, nearest), fallback);
}

// How far a point is from an upright cylinder standing in a box (see castSphereAgainstUprightCylinder), or 0 inside it.
function getDistanceToUprightCylinder(x: number, y: number, z: number, box: AABB3): number
{
    const past = Math.max(0, Math.hypot(x - box.center.x, z - box.center.z) - box.halfSize.x);
    const over = Math.max(0, Math.abs(y - box.center.y) - box.halfSize.y);
    return Math.hypot(past, over);
}

// From the nearest point of that cylinder to a point outside it; for a point inside, level, straight away from its
// middle line, and on that line the fallback's way.
function getWayOutOfUprightCylinder(point: Vec3, box: AABB3, fallback: Vec3): Vec3
{
    const fromMiddle: Vec3 = {x: point.x - box.center.x, y: 0, z: point.z - box.center.z};
    const across = Math.hypot(fromMiddle.x, fromMiddle.z);
    const past = Math.max(0, across - box.halfSize.x);
    const height = point.y - box.center.y;
    const over = (Math.abs(height) > box.halfSize.y) ? height - Math.sign(height) * box.halfSize.y : 0;
    if (past == 0 && over == 0)
        return normalizeOr(fromMiddle, fallback);
    const share = (past > 0) ? past / across : 0;
    return Vector3DUtil.normalize({x: fromMiddle.x * share, y: over, z: fromMiddle.z * share});
}

function normalizeOr(v: Vec3, fallback: Vec3): Vec3
{
    if (Vector3DUtil.lengthSqr(v) > 0)
        return Vector3DUtil.normalize(v);
    return (Vector3DUtil.lengthSqr(fallback) > 0) ? Vector3DUtil.normalize(fallback) : {...WORLD_UP};
}

// Adding 0 turns a rounded -0 into 0, which strict comparisons tell apart.
function roundToAxis(v: Vec3): Vec3
{
    return {x: Math.round(v.x) + 0, y: Math.round(v.y) + 0, z: Math.round(v.z) + 0};
}

export default Geometry3DUtil;