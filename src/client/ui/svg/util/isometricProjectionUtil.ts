import InstancedMeshCompositionPart from "../../../../shared/graphics/mesh/composition/types/instancedMeshCompositionPart";
import Vec3 from "../../../../shared/math/types/vec3";
import Vector3DUtil from "../../../../shared/math/util/vector3DUtil";
import IsometricFace from "../types/isometricFace";

//------------------------------------------------------------------------
// Draws the parts of an InstancedMeshComposition as a flat set of SVG faces,
// so that a form assembled out of boxes and cylinders can be shown as an icon.
//
// The view looks in from a corner rather than straight down an axis, because a
// single orthogonal view cannot tell these forms apart: a cylinder reads as a
// circle from one axis and as a rectangle from another, so all three dimensions
// have to stay visible at once.
//
// Every primitive is tessellated into flat polygons before being projected,
// which lets boxes and cylinders share one path through here and spares the
// cylinders any elliptical-arc math — at icon size, the geometry's own segment
// count is already indistinguishable from a smooth outline.
//
// What hides what is then settled by drawing the parts back to front, which the
// parts' shapes allow: each is convex, so once the faces turned away from the
// viewer are dropped, the ones left over tile the part's outline without ever
// overlapping each other. That leaves only the order between parts to decide,
// and a part's own depth decides it.
//------------------------------------------------------------------------

const COS_30 = Math.cos(Math.PI / 6);
const SIN_30 = 0.5;

// The corner the view looks in from. A face is turned toward the viewer when its
// normal points at all this way, and the same measure orders the parts by depth.
const VIEW_DIR: Vec3 = {x: 1, y: 1, z: -1};

// Matches the cylinder geometry's own radial segment count (see GeometryConstructorMap),
// so an icon is faceted exactly the way the character itself is.
const NUM_CYLINDER_SEGMENTS = 16;

// Relative brightness of the three faces this view can turn toward the viewer: the
// top, the front, and the right. A face angled between them blends these by how far
// it faces each way, which is what shades a cylinder's curved side smoothly.
const TOP_SHADE = 1;
const FRONT_SHADE = 0.74;
const RIGHT_SHADE = 0.52;

// Corner order of a box's face, as offsets along the face's two in-plane axes. Both
// run counter-clockwise as seen from outside the box, so a face's own corners are
// enough to tell which way it points.
const NEAR_SIDE_CORNER_SIGNS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
const FAR_SIDE_CORNER_SIGNS = [[-1, 1], [1, 1], [1, -1], [-1, -1]];

const IsometricProjectionUtil =
{
    // Projects 'parts' into faces laid out to fill a square viewBox of the given size,
    // ordered back to front so that drawing them in order resolves what hides what.
    getFaces: (parts: InstancedMeshCompositionPart[],
        viewBoxSize: number, padding: number): IsometricFace[] =>
    {
        // Farthest part first, so a nearer one simply paints over whatever it stands
        // before. The parts themselves are left untouched, since they belong to whoever
        // asked for the faces.
        const sortedParts = [...parts].sort((a, b) => getDepth(a.offset) - getDepth(b.offset));

        const polygons: Vec3[][] = [];
        for (const part of sortedParts)
            addPartPolygons(part, polygons);

        // A face turned away from the viewer is hidden by its own part, so it is dropped
        // before anything is measured or drawn.
        const visiblePolygons = polygons.filter(
            (polygon) => Vector3DUtil.dot(getNormal(polygon), VIEW_DIR) > 0);
        if (visiblePolygons.length == 0)
            return [];

        const projectedPolygons = visiblePolygons.map(projectPolygon);

        // The parts are authored at the scale they occupy on the character, so the
        // projection is fitted to the viewBox rather than used as-is.
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
        // Anything else is a flat decal (e.g. a face), which carries no shape of its
        // own and would only add slivers at icon size.
    }
}

function addBoxPolygons(center: Vec3, scale: Vec3, polygons: Vec3[][])
{
    // Boxes are authored facing forward or backward, either of which leaves them
    // axis-aligned, so the part's scale is the box's full extent along each axis.
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
    // The geometry is a unit cylinder whose length runs along its own depth axis and
    // whose cross-section is a circle across the other two, so the part's scale gives
    // the length along 'axis' and the diameter across it. Every cylinder these forms
    // are built from is circular, which is what lets one radius stand for the whole
    // cross-section here.
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

    // Both caps are wound counter-clockwise as seen from outside their own end, which
    // is why one is gathered in reverse.
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

// How near a point sits to the viewer. Only the order it puts things in matters here,
// which is why it is left unscaled.
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

// Flattened to consecutive x/y pairs, which keeps the projected outline in the one
// form the path data below needs it in.
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
