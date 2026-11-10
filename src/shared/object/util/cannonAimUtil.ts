import Vec3 from "../../math/types/vec3";
import Geometry3DUtil from "../../math/util/geometry3DUtil";
import NumUtil from "../../math/util/numUtil";
import Vector3DUtil from "../../math/util/vector3DUtil";
import CannonCompositionConstants from "../../graphics/mesh/composition/types/compositionConstants/cannonCompositionConstants";
import CannonAim from "../types/cannonAim";
import { CANNON_MAX_PITCH, CANNON_MIN_PITCH, CANNON_SLEEP_PITCH } from "../types/objectTypeConfig/cannonObjectTypeConfig";

const FULL_TURN = 2 * Math.PI;
const DOWN: Vec3 = {x: 0, y: -1, z: 0};

// Where a cannon's barrel points and what that puts where. A cannon stands on a face at pos, facing dir (the face's
// normal), and its aim is told in the face's own frame (see Geometry3DUtil.getAxisFacingBasis): a yaw of 0 points along
// the face's up, turning toward its right, and a pitch of 0 lies along the face. So a cannon moved to another face
// keeps its pose.
const CannonAimUtil =
{
    // The way an aim points, in the face's frame: x and y across it, z out of it.
    getLocalDirection: (aim: CannonAim): Vec3 =>
    {
        const across = Math.cos(aim.pitch);
        return {x: across * Math.sin(aim.yaw), y: across * Math.cos(aim.yaw), z: Math.sin(aim.pitch)};
    },
    // The way an aim points in the room.
    getDirection: (dir: Vec3, aim: CannonAim): Vec3 =>
    {
        const {normal, right, up} = Geometry3DUtil.getAxisFacingBasis(dir);
        const local = CannonAimUtil.getLocalDirection(aim);
        return {
            x: right.x * local.x + up.x * local.y + normal.x * local.z,
            y: right.y * local.x + up.y * local.y + normal.y * local.z,
            z: right.z * local.x + up.z * local.y + normal.z * local.z,
        };
    },
    // The aim nearest a direction of the room, and whether the barrel tilts far enough to point that way.
    getAim: (dir: Vec3, direction: Vec3): {aim: CannonAim, reachable: boolean} =>
    {
        const {normal, right, up} = Geometry3DUtil.getAxisFacingBasis(dir);
        const toward = Vector3DUtil.normalize(direction);
        const pitch = Math.asin(NumUtil.clampInRange(Vector3DUtil.dot(toward, normal), -1, 1));
        const yaw = Math.atan2(Vector3DUtil.dot(toward, right), Vector3DUtil.dot(toward, up));
        return {
            aim: {yaw: wrap(yaw), pitch: NumUtil.clampInRange(pitch, CANNON_MIN_PITCH, CANNON_MAX_PITCH)},
            reachable: pitch >= CANNON_MIN_PITCH && pitch <= CANNON_MAX_PITCH,
        };
    },
    // What the barrel turns about.
    getPivot: (pos: Vec3, dir: Vec3): Vec3 =>
    {
        const {normal} = Geometry3DUtil.getAxisFacingBasis(dir);
        return Vector3DUtil.add(pos, Vector3DUtil.scale(normal, CannonCompositionConstants.pivotHeight));
    },
    // The middle of the barrel's mouth, where a ball comes out.
    getMuzzle: (pos: Vec3, dir: Vec3, aim: CannonAim): Vec3 =>
    {
        return Vector3DUtil.add(CannonAimUtil.getPivot(pos, dir), Vector3DUtil.scale(
            CannonAimUtil.getDirection(dir, aim), 0.5 * CannonCompositionConstants.barrelLength));
    },
    // An aim brought toward another by no more than an angle either way, as a turret is: its yaw the shorter way
    // round, its pitch straight. Each ends on the other's exactly, so that one that has arrived equals it.
    turnToward: (aim: CannonAim, target: CannonAim, maxAngle: number): CannonAim =>
    {
        const yawOff = getYawOff(aim.yaw, target.yaw);
        const pitchOff = target.pitch - aim.pitch;
        return {
            yaw: (Math.abs(yawOff) <= maxAngle) ? target.yaw : wrap(aim.yaw + Math.sign(yawOff) * maxAngle),
            pitch: (Math.abs(pitchOff) <= maxAngle) ? target.pitch : aim.pitch + Math.sign(pitchOff) * maxAngle,
        };
    },
    // How a barrel hangs while its cannon is switched off: on a wall, straight down along it; on a floor, tipped
    // down toward it, the way it was turned.
    getSleepAim: (dir: Vec3, aim: CannonAim): CannonAim =>
    {
        const {normal} = Geometry3DUtil.getAxisFacingBasis(dir);
        return (normal.y != 0) ? {yaw: aim.yaw, pitch: CANNON_SLEEP_PITCH} : CannonAimUtil.getAim(dir, DOWN).aim;
    },
    // How far apart two aims point, in radians.
    getAngleBetween: (a: CannonAim, b: CannonAim): number =>
    {
        const dot = Vector3DUtil.dot(CannonAimUtil.getLocalDirection(a), CannonAimUtil.getLocalDirection(b));
        return Math.acos(NumUtil.clampInRange(dot, -1, 1));
    },
}

// Into [0, a full turn).
function wrap(angle: number): number
{
    return angle - FULL_TURN * Math.floor(angle / FULL_TURN);
}

// The shorter way round from one yaw to another, in [-half a turn, half a turn).
function getYawOff(from: number, to: number): number
{
    return wrap(to - from + Math.PI) - Math.PI;
}

export default CannonAimUtil;
