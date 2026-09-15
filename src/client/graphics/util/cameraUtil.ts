import * as THREE from "three";
import MeshFactory from "../factories/meshFactory";
import GraphicsManager from "../graphicsManager";
import PointerCoordUtil from "./pointerCoordUtil";
import GameObject from "../../object/types/gameObject";
import ClientObjectManager from "../../object/clientObjectManager";
import InstancedMeshBinding from "../types/mesh/instancedMeshBinding";
import ClientVoxelQueryUtil from "../../voxel/util/clientVoxelQueryUtil";
import ObjectHit from "../types/objectHit";
import { NEAR_EPSILON } from "../../../shared/system/sharedConstants";

// All client raycasts. castBetweenPoints skips the voxel mesh (three.js tests every instance; the
// voxel grid walk in ClientVoxelQueryUtil is far cheaper). The casts through the view include it.

const raycaster: THREE.Raycaster = new THREE.Raycaster();
const ndcTemp: THREE.Vector2 = new THREE.Vector2();
const vec3Temp = new THREE.Vector3();
const rayDirTemp = new THREE.Vector3();
const frustumTemp = new THREE.Frustum();
const viewProjMat4Temp = new THREE.Matrix4();
const meshesTemp: THREE.Mesh[] = [];
const intersectionsTemp: THREE.Intersection[] = [];

const CameraUtil =
{
    // Whether a world-space point is inside the camera frustum.
    pointIsInFieldOfView: (worldPosition: THREE.Vector3): boolean =>
    {
        const camera = GraphicsManager.getCamera();
        viewProjMat4Temp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        frustumTemp.setFromProjectionMatrix(viewProjMat4Temp);
        return frustumTemp.containsPoint(worldPosition);
    },

    // Hits between two points, nearest first, excluding the voxel mesh. Fills the caller's array.
    castBetweenPoints: (from: THREE.Vector3, to: THREE.Vector3,
        out: THREE.Intersection[]): THREE.Intersection[] =>
    {
        out.length = 0;

        rayDirTemp.subVectors(to, from);
        const dist = rayDirTemp.length();
        if (dist < NEAR_EPSILON)
            return out; // The points coincide: no direction to cast along, and nothing fits in between.
        rayDirTemp.divideScalar(dist);

        raycaster.set(from, rayDirTemp);
        raycaster.far = dist; // Only what stands in between, not what lies beyond the far point.
        MeshFactory.getMeshesExcept(ClientVoxelQueryUtil.getVoxelInstancedMeshId(), meshesTemp);
        raycaster.intersectObjects(meshesTemp, true, out);
        return out;
    },

    // Frontmost hit under the pointer. Valid until the next cast (the array is reused).
    castFromPointer: (ev: PointerEvent): THREE.Intersection | undefined =>
    {
        PointerCoordUtil.getNDC(ev, ndcTemp);
        return castThroughView(ndcTemp, Infinity)[0];
    },

    // The objects the camera's line of sight (the middle of the view) meets within maxDistance, nearest
    // first. The line can be tilted toward the ground by pitchDownAngle (radians), stopping at straight
    // down. Gizmos belong to no object, so they're left out.
    getObjectsAlongLineOfSight: (maxDistance: number, pitchDownAngle: number = 0): ObjectHit[] =>
    {
        const hits: ObjectHit[] = [];
        for (const intersection of castThroughView(ndcTemp.set(0, 0), maxDistance, pitchDownAngle))
        {
            const gameObject = CameraUtil.getObjectFromIntersection(intersection);
            if (gameObject != undefined)
                hits.push({gameObject, instanceId: intersection.instanceId ?? -1});
        }
        return hits;
    },

    // Undefined for geometry that belongs to no object (e.g. gizmos).
    getObjectFromIntersection: (intersection: THREE.Intersection): GameObject | undefined =>
    {
        const instanceId = intersection.instanceId;
        if (instanceId != undefined) // One instance of an instanced mesh.
            return InstancedMeshBinding.findGameObject(intersection.object, instanceId);
        // For regular (non-instanced) meshes, (mesh.name == meshId == objectId).
        return ClientObjectManager.getObjectById(intersection.object.name);
    },

    objectIsInLineOfSight: (lookTargetWorldPosition: THREE.Vector3, lookTargetObject: GameObject): boolean =>
    {
        const camera = GraphicsManager.getCamera();
        camera.getWorldPosition(vec3Temp);

        // Voxel blocks are checked by grid walk, so the cast below excludes them.
        if (ClientVoxelQueryUtil.lineSegmentIsBlockedByDrawnVoxelBlock(vec3Temp, lookTargetWorldPosition))
            return false;

        CameraUtil.castBetweenPoints(vec3Temp, lookTargetWorldPosition, intersectionsTemp);
        if (intersectionsTemp.length == 0)
            return true;

        // Object-less geometry is a gizmo and doesn't block the view.
        const nearestObject = CameraUtil.getObjectFromIntersection(intersectionsTemp[0]);
        return (nearestObject == undefined) || (nearestObject == lookTargetObject);
    },
}

// Hits through a point of the view (in NDC) within a distance, nearest first, into the shared array.
function castThroughView(ndc: THREE.Vector2, far: number, pitchDownAngle: number = 0): THREE.Intersection[]
{
    raycaster.setFromCamera(ndc, GraphicsManager.getCamera());
    pitchDown(raycaster.ray.direction, pitchDownAngle);
    raycaster.far = far;

    intersectionsTemp.length = 0;
    raycaster.intersectObjects(MeshFactory.getMeshes(), true, intersectionsTemp);
    return intersectionsTemp;
}

// Tilts a unit direction toward -y, keeping its heading.
function pitchDown(dir: THREE.Vector3, angle: number): void
{
    const horizontalLength = Math.hypot(dir.x, dir.z);
    if (angle == 0 || horizontalLength < NEAR_EPSILON)
        return; // Already vertical: no heading to tilt along.

    const pitch = Math.max(Math.atan2(dir.y, horizontalLength) - angle, -0.5 * Math.PI);
    const horizontalScale = Math.cos(pitch) / horizontalLength;
    dir.set(dir.x * horizontalScale, Math.sin(pitch), dir.z * horizontalScale);
}

export default CameraUtil;
