import CannonBlastUtil from "../../../shared/object/util/cannonBlastUtil";
import PhysicsManager from "../../../shared/physics/physicsManager";
import Vec3 from "../../../shared/math/types/vec3";
import App from "../../app";
import { cameraShakeObservable, cannonBlastObservable } from "../../system/clientObservables";
import GameModeUtil from "../../system/util/gameModeUtil";
import ClientObjectManager from "../clientObjectManager";

// What a cannon ball's blast does to the bodies this browser moves (those with a Rigidbody, whatever their type: its
// user's own player is one): each is thrown where the server says the blast reached it (see CannonBallUtil), by the
// rule the server throws an agent's by. Struck by the ball itself, a body goes off the ball the way the server says
// the two met, wherever it has got to since; reached by the blast alone, away from the burst from where it is now. In
// play mode, the user's view shakes with their own player.
const CannonBlastThrowUtil =
{
    onCannonBlast: (blast: {position: Vec3, hitObjectIds: string[],
        struck?: {objectId: string, heading: number}}): void =>
    {
        const room = App.getCurrentRoom();
        if (room == undefined || !PhysicsManager.hasRoom(room.id))
            return;

        for (const objectId of blast.hitObjectIds)
        {
            const body = ClientObjectManager.getObjectById(objectId);
            if (body?.components.rigidbody == undefined)
                continue;
            const {x, y, z} = body.position;
            const heading = (blast.struck?.objectId == objectId) ? blast.struck.heading
                : CannonBlastUtil.getHeading(blast.position, {x, y, z});
            PhysicsManager.addCarriedVelocity(room.id, objectId, CannonBlastUtil.getThrow(heading));
            if (body == ClientObjectManager.getMyPlayer() && GameModeUtil.getGameMode() == "play")
                cameraShakeObservable.set(1);
        }
    },
}

// Registered on import (see app.ts).
cannonBlastObservable.addListener("cannonBlastThrowUtil", CannonBlastThrowUtil.onCannonBlast);

export default CannonBlastThrowUtil;
