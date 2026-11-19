import * as THREE from "three";

// The unit square a glass is drawn as (see the "Square" geometry): its corners, counter-clockwise from the bottom left
// as seen from in front.
const SQUARE_CORNERS = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];

// The whole view, in normalized device coordinates.
const VIEW_BOX = new THREE.Box2(new THREE.Vector2(-1, -1), new THREE.Vector2(1, 1));

// How far in front of the glass the reflection's near plane lies, so that what lies flat on the face around the glass,
// as deep as the glass is, stays out of it.
const NEAR_PLANE_LIFT = 0.002;

// How far toward the glass the head light lights the reflection from, and how near the glass it may come (see
// getHeadLightPosition).
export const HEAD_LIGHT_SHIFT = 1.5;
export const HEAD_LIGHT_GLASS_CLEARANCE = 0.25;

const LEFT_FOR_RIGHT = new THREE.Matrix4().makeScale(-1, 1, 1);

const matrixTemp = new THREE.Matrix4();
const normalTemp = new THREE.Vector3();
const pointTemp = new THREE.Vector3();
const planeTemp = new THREE.Plane();
const clipPlaneTemp = new THREE.Vector4();
const farCornerTemp = new THREE.Vector4();
const projectedTemp = new THREE.Vector4();
const ndcTemp = new THREE.Vector2();
const inViewTemp: THREE.Vector3[] = SQUARE_CORNERS.map(() => new THREE.Vector3());
// A square cut by a plane keeps at most five corners.
const clippedTemp: THREE.Vector3[] = [0, 1, 2, 3, 4].map(() => new THREE.Vector3());

// The geometry of a mirror's reflection (see MirrorReflectionUtil): the camera the reflection is drawn through, which is
// the camera reflected in the glass's plane, and where it draws each point of the room in the texture the glass reads.
const MirrorProjectionUtil =
{
    // The glass's corners in the world (see SQUARE_CORNERS), from the matrix its unit square is drawn with.
    getGlassCorners: (glassMatrix: THREE.Matrix4, out: THREE.Vector3[]): THREE.Vector3[] =>
    {
        SQUARE_CORNERS.forEach(([x, y], i) => out[i].set(x, y, 0).applyMatrix4(glassMatrix));
        return out;
    },
    // The plane the glass lies in, its normal the way its front faces.
    getGlassPlane: (glassMatrix: THREE.Matrix4, out: THREE.Plane): THREE.Plane =>
    {
        normalTemp.setFromMatrixColumn(glassMatrix, 2).normalize();
        pointTemp.setFromMatrixPosition(glassMatrix);
        return out.setFromNormalAndCoplanarPoint(normalTemp, pointTemp);
    },
    // Where the camera sees the glass: the box, in normalized device coordinates, of its part in front of the near
    // plane, within the view. False if none of it shows.
    getVisibleExtent: (camera: THREE.PerspectiveCamera, corners: THREE.Vector3[], out: THREE.Box2): boolean =>
    {
        corners.forEach((corner, i) => inViewTemp[i].copy(corner).applyMatrix4(camera.matrixWorldInverse));
        const numClipped = clipInFrontOf(inViewTemp, -camera.near, clippedTemp);

        out.makeEmpty();
        for (let i = 0; i < numClipped; ++i)
        {
            const v = clippedTemp[i];
            projectedTemp.set(v.x, v.y, v.z, 1).applyMatrix4(camera.projectionMatrix);
            out.expandByPoint(ndcTemp.set(projectedTemp.x / projectedTemp.w, projectedTemp.y / projectedTemp.w));
        }
        out.intersect(VIEW_BOX);
        return out.max.x > out.min.x && out.max.y > out.min.y;
    },
    // The camera reflected in the plane, its view turned left for right so that it is a camera's like any other: it
    // sees the room as the glass shows it, each point of the glass where the camera does but across the view.
    reflectCamera: (camera: THREE.Camera, plane: THREE.Plane, out: THREE.Camera): void =>
    {
        const n = plane.normal;
        const c = plane.constant;
        matrixTemp.set(
            1 - 2 * n.x * n.x, -2 * n.x * n.y, -2 * n.x * n.z, -2 * c * n.x,
            -2 * n.y * n.x, 1 - 2 * n.y * n.y, -2 * n.y * n.z, -2 * c * n.y,
            -2 * n.z * n.x, -2 * n.z * n.y, 1 - 2 * n.z * n.z, -2 * c * n.z,
            0, 0, 0, 1);
        out.matrixWorld.multiplyMatrices(matrixTemp, camera.matrixWorld).multiply(LEFT_FOR_RIGHT);
        out.matrixWorldInverse.copy(out.matrixWorld).invert();
    },
    // The reflected camera's projection (after reflectCamera): the camera's own, narrowed to the glass's extent as the
    // camera sees it (turned left for right, as the reflection sees it), with its near plane on the glass, so that
    // nothing behind the glass is drawn.
    setReflectionProjection: (camera: THREE.PerspectiveCamera, extent: THREE.Box2, plane: THREE.Plane,
        out: THREE.PerspectiveCamera): void =>
    {
        const left = -extent.max.x;
        const right = -extent.min.x;
        const bottom = extent.min.y;
        const top = extent.max.y;
        matrixTemp.set(
            2 / (right - left), 0, 0, -(right + left) / (right - left),
            0, 2 / (top - bottom), 0, -(top + bottom) / (top - bottom),
            0, 0, 1, 0,
            0, 0, 0, 1);
        out.projectionMatrix.multiplyMatrices(matrixTemp, camera.projectionMatrix);

        planeTemp.copy(plane);
        planeTemp.constant -= NEAR_PLANE_LIFT;
        setObliqueNearPlane(out.projectionMatrix, planeTemp.applyMatrix4(out.matrixWorldInverse));
        out.projectionMatrixInverse.copy(out.projectionMatrix).invert();
        // As three.js and the sky read them (see AtmosphereMaterialUtil).
        out.near = camera.near;
        out.far = camera.far;
    },
    // What takes a point of the room to where the reflection drew it in its texture: the reflected camera's view and
    // projection, then from normalized device coordinates into the part of the texture drawn (widthShare and
    // heightShare of it, from its bottom left).
    getTextureMatrix: (reflectionCamera: THREE.Camera, widthShare: number, heightShare: number,
        out: THREE.Matrix4): THREE.Matrix4 =>
    {
        out.set(
            0.5 * widthShare, 0, 0, 0.5 * widthShare,
            0, 0.5 * heightShare, 0, 0.5 * heightShare,
            0, 0, 0.5, 0.5,
            0, 0, 0, 1);
        return out.multiply(reflectionCamera.projectionMatrix).multiply(reflectionCamera.matrixWorldInverse);
    },
    // Where the head light lights the reflection from: moved toward the glass's plane, so that the side of the viewer
    // the glass shows isn't left dark by a light above their head, but no nearer the plane than a clearance, and not
    // moved at all from that near or behind it.
    getHeadLightPosition: (light: THREE.Vector3, plane: THREE.Plane, out: THREE.Vector3): THREE.Vector3 =>
    {
        const shift = THREE.MathUtils.clamp(plane.distanceToPoint(light) - HEAD_LIGHT_GLASS_CLEARANCE, 0,
            HEAD_LIGHT_SHIFT);
        return out.copy(light).addScaledVector(plane.normal, -shift);
    },
}

// The part of a polygon (in a camera's own space) at or beyond a depth: z no greater than maxZ, as the camera looks
// down -z. Returns how many corners it has, written into out.
function clipInFrontOf(polygon: THREE.Vector3[], maxZ: number, out: THREE.Vector3[]): number
{
    let count = 0;
    for (let i = 0; i < polygon.length; ++i)
    {
        const a = polygon[i];
        const b = polygon[(i + 1) % polygon.length];
        const aIn = a.z <= maxZ;
        if (aIn)
            out[count++].copy(a);
        if (aIn != (b.z <= maxZ))
            out[count++].lerpVectors(a, b, (maxZ - a.z) / (b.z - a.z));
    }
    return count;
}

// Puts a perspective projection's near plane on a plane given in the camera's own space, the camera behind it
// (Lengyel's oblique near-plane clipping, as three.js's Reflector does it). The far plane tilts to meet it, through
// the corner of the view farthest from it.
function setObliqueNearPlane(projection: THREE.Matrix4, plane: THREE.Plane): void
{
    const e = projection.elements;
    clipPlaneTemp.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    farCornerTemp.set((Math.sign(clipPlaneTemp.x) + e[8]) / e[0], (Math.sign(clipPlaneTemp.y) + e[9]) / e[5], -1,
        (1 + e[10]) / e[14]);
    clipPlaneTemp.multiplyScalar(2 / clipPlaneTemp.dot(farCornerTemp));
    e[2] = clipPlaneTemp.x;
    e[6] = clipPlaneTemp.y;
    e[10] = clipPlaneTemp.z + 1;
    e[14] = clipPlaneTemp.w;
}

export default MirrorProjectionUtil;
