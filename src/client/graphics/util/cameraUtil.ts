import * as THREE from "three";
import MeshFactory from "../factories/meshFactory";
import GraphicsManager from "../graphicsManager";
import GameObject from "../../object/types/gameObject";
import ClientObjectManager from "../../object/clientObjectManager";
import InstancedMeshBinding from "../types/mesh/instancedMeshBinding";

const raycaster: THREE.Raycaster = new THREE.Raycaster();
const vec3Temp = new THREE.Vector3();
const vec3Temp2 = new THREE.Vector3();

const CameraUtil =
{
    objectIsInLineOfSight: (lookTargetWorldPosition: THREE.Vector3, lookTargetObject: GameObject): boolean =>
    {
        const camera = GraphicsManager.getCamera();
        camera.getWorldPosition(vec3Temp);
        
        vec3Temp2.copy(lookTargetWorldPosition).sub(vec3Temp);
        raycaster.far = vec3Temp2.length(); // Only consider obstacles between the camera and the target, not geometry beyond it.
        vec3Temp2.normalize();

        raycaster.set(vec3Temp, vec3Temp2);
        const intersections = raycaster.intersectObjects(MeshFactory.getMeshes());

        if (intersections.length > 0)
        {
            const intersection = intersections[0];
            const instanceId = intersection.instanceId;

            if (instanceId != undefined) // Raycast target is an instanced mesh.
            {
                const gameObject = InstancedMeshBinding.findGameObject(intersection.object, instanceId);
                if (gameObject != undefined)
                    return gameObject == lookTargetObject;
                else
                    console.error(`GameObject not found in InstancedMeshGraphics (instanceId = ${instanceId})`);
            }
            else // Raycast target is a regular mesh.
            {
                const objectId = intersection.object.name; // For regular (non-instanced) meshes, (intersection.object.name == meshId == objectId).
                const gameObject = ClientObjectManager.getObjectById(objectId);
                if (gameObject != undefined)
                    return gameObject == lookTargetObject;
                else
                    console.error(`GameObject not found from mesh (objectId = ${objectId})`);
            }
        }
        return true;
    }
}

export default CameraUtil;