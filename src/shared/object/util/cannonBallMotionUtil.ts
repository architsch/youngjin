import Vec3 from "../../math/types/vec3";
import Vector3DUtil from "../../math/util/vector3DUtil";
import PhysicsManager from "../../physics/physicsManager";
import PhysicsSphereHit from "../../physics/types/physicsSphereHit";
import { MAX_ROOM_X, MAX_ROOM_Y, MAX_ROOM_Z } from "../../system/sharedConstants";
import { CANNON_BALL_BOUNCE_BOOST, CANNON_BALL_MAX_SPEED, CANNON_BALL_MAX_WIND_SPEED, CANNON_BALL_RADIUS,
    CANNON_BALL_VANISH_DISTANCE, CANNON_BALL_WIND_SHARE } from "../types/objectTypeConfig/cannonBallObjectTypeConfig";

// The longest stretch a ball flies between two looks at what pushes it and what is in its way, in seconds.
const SUB_STEP_SECONDS = 1 / 30;

// How a cannon ball flies, the same for the server, which decides what becomes of it, as for the browsers, which draw
// it between the server's words (see CannonBallUtil, CannonBallGameObject).
const CannonBallMotionUtil =
{
    // Flies a ball on for a while, its place and velocity changed in place: straight, with no weight, but for the
    // share it takes of what each fan's stream it passes through pushes with, which speeds it up no further than a
    // wind takes a ball, and not at all once bounces have it going faster. It stops at the first thing it strikes,
    // which is returned with the time it had left to fly. A velocity nothing pushed is left exactly as it was.
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
                const most = Math.max(CANNON_BALL_MAX_WIND_SPEED, Vector3DUtil.length(vel));
                Object.assign(vel, Vector3DUtil.add(vel, Vector3DUtil.scale(push, CANNON_BALL_WIND_SHARE * step)));
                const speed = Vector3DUtil.length(vel);
                if (speed > most)
                    Object.assign(vel, Vector3DUtil.scale(vel, most / speed));
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
    // A ball bouncing off something that stands where it is (see PhysicsSphereUtil.bounces), its velocity changed in
    // place: what it carried into the thing, along the way out of it, it now carries out, and it goes on the way that
    // sends it faster by what a bounce adds, never past the most a ball goes.
    rebound: (vel: Vec3, normal: Vec3): void =>
    {
        Object.assign(vel, Vector3DUtil.subtract(vel, Vector3DUtil.scale(normal, 2 * Vector3DUtil.dot(vel, normal))));
        const speed = Vector3DUtil.length(vel);
        const boosted = Math.max(speed, Math.min(speed + CANNON_BALL_BOUNCE_BOOST, CANNON_BALL_MAX_SPEED));
        if (speed > 0)
            Object.assign(vel, Vector3DUtil.scale(vel, boosted / speed));
    },
    // Two balls bouncing off each other as billiard balls do, their velocities changed in place: each takes what the
    // other carried along the line between their middles, and is pushed off the other along it (see pushOff). Nothing
    // for two already coming apart; whether they bounced.
    bounce: (posA: Vec3, velA: Vec3, posB: Vec3, velB: Vec3): boolean =>
    {
        const apart = Vector3DUtil.normalize(Vector3DUtil.subtract(posA, posB));
        const closing = Vector3DUtil.dot(Vector3DUtil.subtract(velA, velB), apart);
        if (closing >= 0)
            return false;
        Object.assign(velA, Vector3DUtil.subtract(velA, Vector3DUtil.scale(apart, closing)));
        Object.assign(velB, Vector3DUtil.add(velB, Vector3DUtil.scale(apart, closing)));
        pushOff(velA, apart);
        pushOff(velB, Vector3DUtil.scale(apart, -1));
        return true;
    },
}

// What a bounce adds to what a ball carries the way off another ball, its velocity changed in place: as much as leaves
// it no faster than a ball goes at most, whatever the other gave it. What it carries across that way is left as it
// is, so the two always come apart.
function pushOff(vel: Vec3, wayOff: Vec3): void
{
    const off = Vector3DUtil.dot(vel, wayOff);
    const acrossSqr = Vector3DUtil.lengthSqr(vel) - off * off;
    const most = Math.sqrt(Math.max(0, CANNON_BALL_MAX_SPEED * CANNON_BALL_MAX_SPEED - acrossSqr));
    const pushed = Math.min(off + CANNON_BALL_BOUNCE_BOOST, most);
    Object.assign(vel, Vector3DUtil.add(vel, Vector3DUtil.scale(wayOff, pushed - off)));
}

export default CannonBallMotionUtil;
