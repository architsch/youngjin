import App from "../../../../app";
import ClientObjectManager from "../../../clientObjectManager";
import GameObject from "../../../types/gameObject/gameObject";
import PlayerProximityDetector from "../../playerProximityDetector";
import PhysicsObjectUtil from "../../../../../shared/physics/util/physicsObjectUtil";

const maxProximityDetectionDist = 6;

export default class PlayerProximityDetectionUpdater
{
    // May miss a proximity exit if the player teleports more than
    // [maxProximityDetectionDist - maxDist] in one frame.
    update(deltaTime: number, player: GameObject): void
    {
        const currentRoom = App.getCurrentRoom();

        if (currentRoom)
        {
            const physicsObjects = PhysicsObjectUtil.getObjectsIn2DDist(currentRoom.id,
                player.position.x, player.position.z, maxProximityDetectionDist);

            for (const objectId in physicsObjects)
            {
                const obj = ClientObjectManager.getObjectById(objectId);
                if (obj != undefined)
                {
                    if (obj.spawnFinished)
                    {
                        const detector = obj.components.playerProximityDetector;
                        if (detector != undefined)
                            (detector as PlayerProximityDetector).updateProximity(player);
                    }
                }
                else
                    console.error(`PhysicsObject with ID '${objectId}' not found in ClientObjectManager.`);
            }
        }
    }
}
