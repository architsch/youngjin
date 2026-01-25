import * as THREE from "three";
import FirstPersonController from "../../firstPersonController";
import PhysicsManager from "../../../../../shared/physics/physicsManager";
import App from "../../../../app";
import ObjectManager from "../../../objectManager";
import PlayerProximityDetector from "../../playerProximityDetector";
import InstancedMeshGraphics from "../../instancedMeshGraphics";
import MeshFactory from "../../../../graphics/factories/meshFactory";
import GraphicsManager from "../../../../graphics/graphicsManager";
import GameObject from "../../../types/gameObject";

const vec3Temp = new THREE.Vector3();
const vec3Temp2 = new THREE.Vector3();

const maxProximityDetectionDist = 6;

export default class FirstPersonProximityDetection
{
    private raycaster: THREE.Raycaster = new THREE.Raycaster();

    update(deltaTime: number, controller: FirstPersonController): void
    {
        const currentRoom = App.getCurrentRoom();

        if (currentRoom)
        {
            const physicsObjects = PhysicsManager.getObjectsInDist(currentRoom.id,
                controller.gameObject.position.x, controller.gameObject.position.z, maxProximityDetectionDist);
            
            for (const physicsObject of physicsObjects)
            {
                const objectId = physicsObject.objectId;
                const obj = ObjectManager.getObjectById(objectId);
                if (obj != undefined)
                {
                    if (obj.spawnFinished)
                    {
                        const detector = obj.components.playerProximityDetector;
                        if (detector != undefined)
                            (detector as PlayerProximityDetector).updateProximity(controller.gameObject, this);
                    }
                }
                else
                    console.error(`PhysicsObject with ID '${objectId}' not found in ObjectManager.`);
            }
        }
    }

    objectIsInLineOfSight(lookTargetWorldPosition: THREE.Vector3, lookTargetObject: GameObject): boolean
    {
        const camera = GraphicsManager.getCamera();
        camera.getWorldPosition(vec3Temp);
        
        vec3Temp2.copy(lookTargetWorldPosition);
        vec3Temp2.sub(vec3Temp);
        vec3Temp2.normalize();

        this.raycaster.set(vec3Temp, vec3Temp2);
        const intersections = this.raycaster.intersectObjects(MeshFactory.getMeshes());

        if (intersections.length > 0)
        {
            const intersection = intersections[0];
            const instanceId = intersection.instanceId;

            if (instanceId != undefined)
            {
                const gameObject = InstancedMeshGraphics.findGameObject(intersection.object, instanceId);
                if (gameObject != undefined)
                    return gameObject == lookTargetObject;
                else
                    console.error(`GameObject not found in InstancedMeshGraphics (instanceId = ${instanceId})`);
            }
            else
                console.error(`InstanceId not found (object name = ${intersection.object.name})`);
        }
        return false;
    }
}