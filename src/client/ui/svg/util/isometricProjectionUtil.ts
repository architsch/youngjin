import InstancedMeshCompositionPart from "../../../../shared/graphics/mesh/composition/types/instancedMeshCompositionPart";
import Vec3 from "../../../../shared/math/types/vec3";
import Vector3DUtil from "../../../../shared/math/util/vector3DUtil";
import IsometricFace from "../types/isometricFace";

// Renders composition parts as flat SVG faces for icons. Views from a corner (single-axis views can't
// distinguish boxes from cylinders). Primitives are tessellated into polygons, back-faces dropped,
// and parts painted back to front (each part is convex, so its remaining faces never overlap).

const COS_30 = Math.cos(Math.PI / 6);
const SIN_30 = 0.5;

// View direction, used for back-face culling and depth ordering.
const VIEW_DIR: Vec3 = {x: 1, y: 1, z: -1};

// Matches the cylinder geometry's radial segments (see GeometryConstructorMap).
const NUM_CYLINDER_SEGMENTS = 16;

// Shades of the top, front and right faces; in-between normals blend them.
const TOP_SHADE = 1;
const FRONT_SHADE = 0.74;
const RIGHT_SHADE = 0.52;

// Face corner order (counter-clockwise from outside), so corners determine the facing.
const NEAR_SIDE_CORNER_SIGNS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
const FAR_SIDE_CORNER_SIGNS = [[-1, 1], [1, 1], [1, -1], [-1, -1]];

const IsometricProjectionUtil =
{
    // Faces fitted to a square viewBox, ordered back to front.
    getFaces: (parts: InstancedMeshCompositionPart[],
        viewBoxSize: number, padding: number): IsometricFace[] =>
    {
        // Farthest first; copied so the caller's parts aren't reordered.
        const sortedParts = [...parts].sort((a, b) => getDepth(a.offset) - getDepth(b.offset));

        const polygons: Vec3[][] = [];
        for (const part of sortedParts)
            addPartPolygons(part, polygons);

        // Drop back-faces.
        const visiblePolygons = polygons.filter(
            (polygon) => Vector3DUtil.dot(getNormal(polygon), VIEW_DIR) > 0);
        if (visiblePolygons.length == 0)
            return [];

        const projectedPolygons = visiblePolygons.map(projectPolygon);

        // Fit to the viewBox (parts are authored at character scale).
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const points of projectedPolygons)
        {
            for (let i = 0; i < points.length; i += 2)
            {
                minX = Math.min(minX, points[i]);
                maxX = Math.max(maxX, points[i]);
                minY = Math.min(minY, points[i + 1]);
                maxY = Math.max(maxY, points[i + 1]);
            }
        }
        const span = Math.max(maxX - minX, maxY - minY);
        const scale = (span > 0) ? ((viewBoxSize - 2 * padding) / span) : 0;
        const originX = 0.5 * (viewBoxSize - (minX + maxX) * scale);
        const originY = 0.5 * (viewBoxSize - (minY + maxY) * scale);

        return visiblePolygons.map((polygon, i) => ({
            d: getPathData(projectedPolygons[i], scale, originX, originY),
            shade: getShade(getNormal(polygon)),
        }));
    },
}

function addPartPolygons(part: InstancedMeshCompositionPart, polygons: Vec3[][])
{
    // A part's instancedMeshId carries the geometry it is drawn from (see MeshDataUtil).
    const geometryId = part.instancedMeshId.split("+")[0];
    switch (geometryId)
    {
        case "Box":
            addBoxPolygons(part.offset, part.scale, polygons);
            break;
        case "Cylinder":
            addCylinderPolygons(part.offset, part.scale, getAxisIndex(part.dir), polygons);
            break;
        // Other geometry is a flat decal (e.g. a face), which only adds slivers at icon size.
    }
}

function addBoxPolygons(center: Vec3, scale: Vec3, polygons: Vec3[][])
{
    // Boxes are axis-aligned, so scale is their full extent per axis.
    const c = [center.x, center.y, center.z];
    const half = [0.5 * scale.x, 0.5 * scale.y, 0.5 * scale.z];

    for (let axis = 0; axis < 3; ++axis)
    {
        const u = (axis + 1) % 3;
        const v = (axis + 2) % 3;
        for (let side = -1; side <= 1; side += 2)
        {
            const cornerSigns = (side > 0) ? NEAR_SIDE_CORNER_SIGNS : FAR_SIDE_CORNER_SIGNS;
            polygons.push(cornerSigns.map((signs) => {
                const p = [c[0], c[1], c[2]];
                p[axis] += side * half[axis];
                p[u] += signs[0] * half[u];
                p[v] += signs[1] * half[v];
                return {x: p[0], y: p[1], z: p[2]};
            }));
        }
    }
}

function addCylinderPolygons(center: Vec3, scale: Vec3, axis: number, polygons: Vec3[][])
{
    // Unit cylinder along its depth axis with a circular cross-section: scale gives length along
    // `axis` and the diameter across it.
    const c = [center.x, center.y, center.z];
    const halfLength = 0.5 * scale.z;
    const radius = 0.25 * (scale.x + scale.y);
    const u = (axis + 1) % 3;
    const v = (axis + 2) % 3;

    const ringCorner = (segment: number, side: number): Vec3 => {
        const angle = 2 * Math.PI * segment / NUM_CYLINDER_SEGMENTS;
        const p = [c[0], c[1], c[2]];
        p[axis] += side * halfLength;
        p[u] += radius * Math.cos(angle);
        p[v] += radius * Math.sin(angle);
        return {x: p[0], y: p[1], z: p[2]};
    };

    // Caps wind counter-clockwise from outside, so one is reversed.
    const nearCap: Vec3[] = [];
    const farCap: Vec3[] = [];
    for (let segment = 0; segment < NUM_CYLINDER_SEGMENTS; ++segment)
    {
        polygons.push([
            ringCorner(segment, -1), ringCorner(segment + 1, -1),
            ringCorner(segment + 1, 1), ringCorner(segment, 1),
        ]);
        nearCap.push(ringCorner(segment, 1));
        farCap.unshift(ringCorner(segment, -1));
    }
    polygons.push(nearCap, farCap);
}

// Which axis a part's length runs along, taken from the direction it faces.
function getAxisIndex(dir: Vec3): number
{
    const absX = Math.abs(dir.x);
    const absY = Math.abs(dir.y);
    const absZ = Math.abs(dir.z);
    if (absY >= absX && absY >= absZ)
        return 1;
    return (absX >= absZ) ? 0 : 2;
}

function getNormal(polygon: Vec3[]): Vec3
{
    return Vector3DUtil.normalize(Vector3DUtil.cross(
        Vector3DUtil.subtract(polygon[1], polygon[0]),
        Vector3DUtil.subtract(polygon[2], polygon[0])));
}

// Unscaled depth, used only for ordering.
function getDepth(point: Vec3): number
{
    return Vector3DUtil.dot(point, VIEW_DIR);
}

function getShade(normal: Vec3): number
{
    const top = Math.max(normal.y, 0);
    const front = Math.max(-normal.z, 0);
    const right = Math.max(normal.x, 0);
    const total = top + front + right;
    if (total <= 0)
        return TOP_SHADE; // A visible face always faces at least one of the three.
    return (TOP_SHADE * top + FRONT_SHADE * front + RIGHT_SHADE * right) / total;
}

// Flattened x/y pairs for path data.
function projectPolygon(polygon: Vec3[]): number[]
{
    const points: number[] = [];
    for (const corner of polygon)
    {
        points.push((corner.x + corner.z) * COS_30);
        // SVG's vertical axis grows downward, so the world's "up" turns into a negative step.
        points.push((corner.x - corner.z) * SIN_30 - corner.y);
    }
    return points;
}

function getPathData(points: number[], scale: number, originX: number, originY: number): string
{
    const commands: string[] = [];
    for (let i = 0; i < points.length; i += 2)
    {
        const x = originX + points[i] * scale;
        const y = originY + points[i + 1] * scale;
        commands.push(`${(i == 0) ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    commands.push("Z");
    return commands.join(" ");
}

export default IsometricProjectionUtil;
