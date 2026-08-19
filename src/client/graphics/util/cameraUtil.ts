import * as THREE from "three";
import MeshFactory from "../factories/meshFactory";
import GraphicsManager from "../graphicsManager";
import PointerCoordUtil from "./pointerCoordUtil";
import GameObject from "../../object/types/gameObject";
import ClientObjectManager from "../../object/clientObjectManager";
import InstancedMeshBinding from "../types/mesh/instancedMeshBinding";
import ClientVoxelQueryUtil from "../../voxel/util/clientVoxelQueryUtil";
import { NEAR_EPSILON } from "../../../shared/system/sharedConstants";

//------------------------------------------------------------------------
// What the camera can see, and what a ray cast into the scene meets.
//
// Every raycast the client makes goes through here, so that the pieces each one is built out of —
// which meshes are worth testing, how far along the ray to look, and which game object a hit
// belongs to — are settled in one place rather than once per caller.
//
// Which meshes are tested is the question the two casts below answer differently, and it is the
// expensive one. A cast asking what stands *between* two points leaves out the room's own voxel
// mesh: that mesh holds one instance per quad of a whole room, three.js tests a ray against every
// instance a mesh holds, and the room is far more cheaply settled by walking the voxel grid instead
// (see ClientVoxelQueryUtil). A cast asking what the user pointed at keeps it, the room's own
// surfaces being most of what there is to point at.
//------------------------------------------------------------------------

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
    // Whether a world-space point falls inside the camera's view frustum (i.e. is in front of the
    // camera and within its field of view). Points behind the camera or off to the side return false.
    pointIsInFieldOfView: (worldPosition: THREE.Vector3): boolean =>
    {
        const camera = GraphicsManager.getCamera();
        viewProjMat4Temp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        frustumTemp.setFromProjectionMatrix(viewProjMat4Temp);
        return frustumTemp.containsPoint(worldPosition);
    },

    // Everything struck between two world points, nearest first, with the room's own voxel mesh left
    // out (see above). The hits are written into the caller's own array, so a cast made every frame
    // allocates nothing.
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

    // The frontmost thing drawn under a pointer event, or undefined where the user pointed at
    // nothing at all. Valid until the next cast, which reuses the array it is held in.
    castFromPointer: (ev: PointerEvent): THREE.Intersection | undefined =>
    {
        PointerCoordUtil.getNDC(ev, ndcTemp);
        raycaster.setFromCamera(ndcTemp, GraphicsManager.getCamera());
        raycaster.far = Infinity; // Whatever a previous cast between two points left behind.

        intersectionsTemp.length = 0;
        raycaster.intersectObjects(MeshFactory.getMeshes(), true, intersectionsTemp);
        return intersectionsTemp[0];
    },

    // The game object a struck piece of geometry belongs to, if it belongs to one at all. Geometry
    // drawn over the room to point something out belongs to none, which is not a fault: it is
    // guidance laid over the scene rather than a thing standing in it.
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

        // The room's own blocks are settled by walking the voxel grid instead, and so are left out
        // of the cast below.
        if (ClientVoxelQueryUtil.lineSegmentIsBlockedByDrawnVoxelBlock(vec3Temp, lookTargetWorldPosition))
            return false;

        CameraUtil.castBetweenPoints(vec3Temp, lookTargetWorldPosition, intersectionsTemp);
        if (intersectionsTemp.length == 0)
            return true;

        // Geometry belonging to no object is a gizmo drawn over the room, which hides nothing that
        // is standing in the room itself.
        const nearestObject = CameraUtil.getObjectFromIntersection(intersectionsTemp[0]);
        return (nearestObject == undefined) || (nearestObject == lookTargetObject);
    },
}

export default CameraUtil;
