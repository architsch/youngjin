import PlayerController from "../../playerController";
import App from "../../../../app";
import ClientObjectManager from "../../../clientObjectManager";
import PlayerProximityDetector from "../../playerProximityDetector";
import PhysicsObjectUtil from "../../../../../shared/physics/util/physicsObjectUtil";

const maxProximityDetectionDist = 6;

export default class FirstPersonProximityDetection
{
    update(deltaTime: number, controller: PlayerController): void
    {
        const currentRoom = App.getCurrentRoom();

        if (currentRoom)
        {
            const physicsObjects = PhysicsObjectUtil.getObjectsIn2DDist(currentRoom.id,
                controller.gameObject.position.x, controller.gameObject.position.z, maxProximityDetectionDist);
            
            for (const objectId in physicsObjects)
            {
                const obj = ClientObjectManager.getObjectById(objectId);
                if (obj != undefined)
                {
                    if (obj.spawnFinished)
                    {
                        const detector = obj.components.playerProximityDetector;
                        if (detector != undefined)
                            (detector as PlayerProximityDetector).updateProximity(controller.gameObject);
                    }
                }
                else
                    console.error(`PhysicsObject with ID '${objectId}' not found in ClientObjectManager.`);
            }
        }
    }
}