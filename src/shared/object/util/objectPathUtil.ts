import Vec3 from "../../math/types/vec3";
import Vector3DUtil from "../../math/util/vector3DUtil";
import ObjectWaypoint from "../types/objectWaypoint";

// How an object goes along a path (see SetObjectPathSignal), the same for the server, which keeps where it is, as for the
// browsers, which draw it.
const ObjectPathUtil =
{
    // Moves a position on along a path by a stretch of time, in place. next: the waypoint it is going to. Returns the one
    // it is going to then, past the last once it has got there.
    advance: (waypoints: ObjectWaypoint[], next: number, pos: Vec3, seconds: number): number =>
    {
        let secondsLeft = seconds;
        while (next < waypoints.length && secondsLeft > 0)
        {
            const {pos: to, speed} = waypoints[next];
            const toGo = Math.sqrt(Vector3DUtil.distSqr(pos, to));
            if (speed * secondsLeft < toGo)
            {
                const share = speed * secondsLeft / toGo;
                pos.x += (to.x - pos.x) * share;
                pos.y += (to.y - pos.y) * share;
                pos.z += (to.z - pos.z) * share;
                break;
            }
            pos.x = to.x;
            pos.y = to.y;
            pos.z = to.z;
            secondsLeft -= toGo / speed;
            ++next;
        }
        return next;
    },
    // How long a path takes from a position.
    getSeconds: (waypoints: ObjectWaypoint[], from: Vec3): number =>
    {
        let seconds = 0;
        let at = from;
        for (const {pos, speed} of waypoints)
        {
            seconds += Math.sqrt(Vector3DUtil.distSqr(at, pos)) / speed;
            at = pos;
        }
        return seconds;
    },
}

export default ObjectPathUtil;
