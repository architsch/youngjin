import PlayerController from "../../playerController";
import App from "../../../../app";
import ClientObjectManager from "../../../clientObjectManager";
import PlayerProximityDetector from "../../playerProximityDetector";
import PhysicsObjectUtil from "../../../../../shared/physics/util/physicsObjectUtil";

const maxProximityDetectionDist = 6;

export default class PlayerProximityDetectionUpdater
{
    // Warning: This proximity detection logic may fail if the player
    // happens to teleport by a distance of more than [maxProximityDetectionDist - maxDist]
    // within a single frame of time,
    // since the player must be within the distance of [maxProximityDetectionDist] from the target
    // at least for a single frame of time (i.e. a single `update` method call) in order to
    // turn the target's proximity mode OFF (when the player moves away from the target).
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