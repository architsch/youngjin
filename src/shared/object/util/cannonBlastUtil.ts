import Vec3 from "../../math/types/vec3";
import Vector3DUtil from "../../math/util/vector3DUtil";
import { CANNON_BLAST_LIFT_SPEED, CANNON_BLAST_PUSH_SPEED } from "../types/objectTypeConfig/cannonBallObjectTypeConfig";

// What a cannon ball's blast does to a body it reaches, the same for whoever moves that body: its user's browser, or
// the server, for an agent's (see CannonBallUtil).
const CannonBlastUtil =
{
    // The velocity the blast gives a body, for it to carry (see PhysicsManager.addCarriedVelocity): away from where the
    // ball burst, across the room, and upward, which lifts it off its feet as it goes. A body right over or under the
    // burst is thrown along x.
    getThrow: (burstPos: Vec3, bodyPos: Vec3): Vec3 =>
    {
        const away: Vec3 = {x: bodyPos.x - burstPos.x, y: 0, z: bodyPos.z - burstPos.z};
        const across = (Vector3DUtil.lengthSqr(away) > 0) ? Vector3DUtil.normalize(away) : {x: 1, y: 0, z: 0};
        return {x: across.x * CANNON_BLAST_PUSH_SPEED, y: CANNON_BLAST_LIFT_SPEED, z: across.z * CANNON_BLAST_PUSH_SPEED};
    },
}

export default CannonBlastUtil;
