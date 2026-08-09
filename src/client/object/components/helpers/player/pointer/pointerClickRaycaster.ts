import * as THREE from "three";
import ClientObjectManager from "../../../../clientObjectManager";
import GraphicsManager from "../../../../../graphics/graphicsManager";
import InstancedMeshBinding from "../../../../../graphics/types/mesh/instancedMeshBinding";
import MeshFactory from "../../../../../graphics/factories/meshFactory";
import PointerCoordUtil from "../../../../../graphics/util/pointerCoordUtil";

const ndcTemp: THREE.Vector2 = new THREE.Vector2();

//------------------------------------------------------------------------
// Turns a click on the game canvas into a click on whatever game object was
// drawn under it, by raycasting into the scene and notifying the object that
// the frontmost hit belongs to.
//------------------------------------------------------------------------

export default class PointerClickRaycaster
{
    private raycaster: THREE.Raycaster = new THREE.Raycaster();

    raycast(ev: PointerEvent): void
    {
        PointerCoordUtil.getNDC(ev, ndcTemp);

        this.raycaster.setFromCamera(ndcTemp, GraphicsManager.getCamera());
        const intersections = this.raycaster.intersectObjects(MeshFactory.getMeshes());

        if (intersections.length > 0)
        {
            const intersection = intersections[0];
            const instanceId = intersection.instanceId;

            if (instanceId != undefined) // Raycast target is an instanced mesh.
            {
                const gameObject = InstancedMeshBinding.findGameObject(intersection.object, instanceId);
                if (gameObject != undefined)
                {
                    const instancedMeshGraphics = gameObject.components.instancedMeshGraphics;
                    if (instancedMeshGraphics)
                        gameObject.onClick(instanceId, intersection.point);
                    else
                        console.error(`InstancedMeshGraphics component not found (params = ${JSON.stringify(gameObject.params)}, instanceId = ${instanceId})`);
                }
                else
                    console.error(`GameObject not found in InstancedMeshGraphics (instanceId = ${instanceId})`);
            }
            else // Raycast target is a regular mesh.
            {
                const objectId = intersection.object.name; // For regular (non-instanced) meshes, (intersection.object.name == meshId == objectId).
                const gameObject = ClientObjectManager.getObjectById(objectId);
                if (gameObject != undefined)
                {
                    const meshGraphics = gameObject.components.meshGraphics;
                    if (meshGraphics)
                        gameObject.onClick(-1, intersection.point);
                    else
                        console.error(`MeshGraphics component not found (${JSON.stringify(gameObject.params)})`);
                }
                else
                    console.error(`GameObject not found from mesh (objectId = ${objectId})`);
            }
        }
    }
}
