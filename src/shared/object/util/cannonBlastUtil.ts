import Vec3 from "../../math/types/vec3";
import { CANNON_BLAST_LIFT_SPEED, CANNON_BLAST_PUSH_SPEED } from "../types/objectTypeConfig/cannonBallObjectTypeConfig";

// What a cannon ball's blast does to a body it reaches, the same for whoever moves that body: its user's browser, or
// the server, for an agent's (see CannonBallUtil).
const CannonBlastUtil =
{
    // The way the blast throws a body across the room, as an angle about the y axis, from x toward z: straight away
    // from where the ball's middle was as it burst. For the body the ball struck, that is off its side where the two
    // met, a body being round to a ball (see ColliderConfig.shape). One right over or under the burst goes along x.
    getHeading: (burstPos: Vec3, bodyPos: Vec3): number =>
    {
        return Math.atan2(bodyPos.z - burstPos.z, bodyPos.x - burstPos.x);
    },
    // The velocity the blast gives a body thrown that way, for it to carry (see PhysicsManager.addCarriedVelocity):
    // across the room, and upward, which lifts it off its feet as it goes.
    getThrow: (heading: number): Vec3 =>
    {
        return {x: Math.cos(heading) * CANNON_BLAST_PUSH_SPEED, y: CANNON_BLAST_LIFT_SPEED,
            z: Math.sin(heading) * CANNON_BLAST_PUSH_SPEED};
    },
}

export default CannonBlastUtil;
