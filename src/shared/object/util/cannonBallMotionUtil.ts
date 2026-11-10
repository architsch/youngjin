import Vec3 from "../../math/types/vec3";
import Vector3DUtil from "../../math/util/vector3DUtil";
import PhysicsManager from "../../physics/physicsManager";
import PhysicsSphereHit from "../../physics/types/physicsSphereHit";
import { MAX_ROOM_X, MAX_ROOM_Y, MAX_ROOM_Z } from "../../system/sharedConstants";
import { CANNON_BALL_MAX_SPEED, CANNON_BALL_RADIUS, CANNON_BALL_VANISH_DISTANCE,
    CANNON_BALL_WIND_SHARE } from "../types/objectTypeConfig/cannonBallObjectTypeConfig";

// The longest stretch a ball flies between two looks at what pushes it and what is in its way, in seconds.
const SUB_STEP_SECONDS = 1 / 30;

// How a cannon ball flies, the same for the server, which decides what becomes of it, as for the browsers, which draw
// it between the server's words (see CannonBallUtil, CannonBallGameObject).
const CannonBallMotionUtil =
{
    // Flies a ball on for a while, its place and velocity changed in place: straight, with no weight, but for the
    // share it takes of what each fan's stream it passes through pushes with, and never faster than a ball goes at
    // most. It stops at the first thing it strikes, which is returned with the time it had left to fly. A velocity
    // nothing pushed is left exactly as it was.
    advance: (roomID: string, pos: Vec3, vel: Vec3, seconds: number,
        ignoredObjectIds: ReadonlySet<string>): {hit: PhysicsSphereHit | undefined, secondsLeft: number} =>
    {
        let secondsLeft = seconds;
        while (secondsLeft > 0)
        {
            const step = Math.min(SUB_STEP_SECONDS, secondsLeft);
            secondsLeft -= step;

            const push = PhysicsManager.getPush(roomID, {center: pos,
                halfSize: {x: CANNON_BALL_RADIUS, y: CANNON_BALL_RADIUS, z: CANNON_BALL_RADIUS}});
            if (push.x != 0 || push.y != 0 || push.z != 0)
            {
                Object.assign(vel, Vector3DUtil.add(vel, Vector3DUtil.scale(push, CANNON_BALL_WIND_SHARE * step)));
                const speed = Vector3DUtil.length(vel);
                if (speed > CANNON_BALL_MAX_SPEED)
                    Object.assign(vel, Vector3DUtil.scale(vel, CANNON_BALL_MAX_SPEED / speed));
            }

            const to = Vector3DUtil.add(pos, Vector3DUtil.scale(vel, step));
            const hit = PhysicsManager.castSphere(roomID, pos, to, CANNON_BALL_RADIUS, ignoredObjectIds);
            Object.assign(pos, hit?.center ?? to);
            if (hit != undefined)
                return {hit, secondsLeft: secondsLeft + (1 - hit.rayScale) * step};
        }
        return {hit: undefined, secondsLeft: 0};
    },
    // Whether a ball has flown far enough past the room to be gone.
    isGone: (pos: Vec3): boolean =>
    {
        const past = (coordinate: number, max: number) => Math.max(0, -coordinate, coordinate - max);
        return Math.hypot(past(pos.x, MAX_ROOM_X), past(pos.y, MAX_ROOM_Y), past(pos.z, MAX_ROOM_Z))
            >= CANNON_BALL_VANISH_DISTANCE;
    },
    // Two balls bouncing off each other as billiard balls do, their velocities changed in place: each takes what the
    // other carried along the line between their middles. Nothing for two already coming apart; whether they bounced.
    bounce: (posA: Vec3, velA: Vec3, posB: Vec3, velB: Vec3): boolean =>
    {
        const apart = Vector3DUtil.normalize(Vector3DUtil.subtract(posA, posB));
        const closing = Vector3DUtil.dot(Vector3DUtil.subtract(velA, velB), apart);
        if (closing >= 0)
            return false;
        Object.assign(velA, Vector3DUtil.subtract(velA, Vector3DUtil.scale(apart, closing)));
        Object.assign(velB, Vector3DUtil.add(velB, Vector3DUtil.scale(apart, closing)));
        return true;
    },
}

export default CannonBallMotionUtil;
