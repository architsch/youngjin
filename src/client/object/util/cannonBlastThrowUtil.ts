import CannonBlastUtil from "../../../shared/object/util/cannonBlastUtil";
import PhysicsManager from "../../../shared/physics/physicsManager";
import Vec3 from "../../../shared/math/types/vec3";
import App from "../../app";
import { cameraShakeObservable, cannonBlastObservable } from "../../system/clientObservables";
import GameModeUtil from "../../system/util/gameModeUtil";
import ClientObjectManager from "../clientObjectManager";

// What a cannon ball's blast does to the user's own player, which this browser moves: thrown where the server says
// the blast reached it (see CannonBallUtil), by the rule the server throws an agent's by, and, in play mode, with a
// shake of the view it is seen through.
const CannonBlastThrowUtil =
{
    onCannonBlast: (blast: {position: Vec3, hitObjectIds: string[]}): void =>
    {
        const player = ClientObjectManager.getMyPlayer();
        const room = App.getCurrentRoom();
        if (player == undefined || room == undefined || !blast.hitObjectIds.includes(player.params.objectId) ||
            !PhysicsManager.hasRoom(room.id))
        {
            return;
        }

        const {x, y, z} = player.position;
        PhysicsManager.addCarriedVelocity(room.id, player.params.objectId, CannonBlastUtil.getThrow(blast.position, {x, y, z}));
        if (GameModeUtil.getGameMode() == "play")
            cameraShakeObservable.set(1);
    },
}

// Registered on import (see app.ts).
cannonBlastObservable.addListener("cannonBlastThrowUtil", CannonBlastThrowUtil.onCannonBlast);

export default CannonBlastThrowUtil;
