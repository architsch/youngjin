import Vec2 from "../../../shared/math/types/vec2";
import Vec3 from "../../../shared/math/types/vec3";
import StringUtil from "../../../shared/math/util/stringUtil";

// Which way a bill may lean as it rests: over onto one half of it, standing on both, or over onto the other.
export const LEANS = [-1, 0, 1];
// A flight to the count on the screen starts no farther out than this on either axis, in the screen's own units (from -1
// to 1 across it): out of view, it comes in over the nearest edge. It bows out from the straight way by this much, toward
// the screen's middle. It comes up to its full size over this share of the flight, from how large the bill looked where
// it lay, shrinks by this share as it goes, and then all the way down from this share of the flight on, as it is sucked up.
export const MAX_FLIGHT_START = 1.2;
const FLIGHT_BOW = 0.35;
export const GROWING_SHARE = 0.4;
export const FLIGHT_SHRINK = 0.35;
export const VANISHING_SHARE = 0.8;
// Drawn in, it shrinks away from this share of the way on.
export const ABSORB_VANISHING_SHARE = 0.75;

// How a bill lies: which way it is turned, in radians, and how far it has tipped over; how it is drawn into someone else
// who collects it; and how it flies to the count on the screen of the user who does (see DollarBillGameObject).
const DollarBillPoseUtil =
{
    // Decided by nothing but what the bill is and where it stops, which every browser is told alike, however it came to
    // know of them, so that a bill lies the same way on everyone's screen with nothing more said.
    getRestPose: (objectId: string, pos: Vec3): {yaw: number, lean: number} =>
    {
        const seed = Math.abs(StringUtil.getHashCode(`${objectId}:${pos.x}:${pos.y}:${pos.z}`));
        return {yaw: 2 * Math.PI * (seed % 1024) / 1024, lean: LEANS[Math.floor(seed / 1024) % LEANS.length]};
    },
    // How far on a bill being drawn in has got at a share of the time that takes, each from 0 to 1: it leaps up at once,
    // clear of a low step on its way, comes across faster and faster, and shrinks away at the end.
    getAbsorptionStep: (share: number): {across: number, up: number, size: number} =>
    {
        const left = 1 - share;
        const vanishing = Math.max(0, (share - ABSORB_VANISHING_SHARE) / (1 - ABSORB_VANISHING_SHARE));
        return {across: share * share, up: 1 - left * left, size: 1 - vanishing * vanishing * (3 - 2 * vanishing)};
    },
    // Where on the screen a bill's flight to the count starts: where the bill is. x and y are as the camera's projection
    // leaves them, and depth how far ahead of the camera it is, none or less for behind it.
    getFlightStart: (x: number, y: number, depth: number): Vec2 =>
    {
        const ahead = depth > 0;
        const screenX = ahead ? x / depth : x, screenY = ahead ? y / depth : y;
        const largest = Math.max(Math.abs(screenX), Math.abs(screenY));
        if (largest == 0)
            return {x: 0, y: ahead ? 0 : -MAX_FLIGHT_START};
        const scale = (ahead && largest <= MAX_FLIGHT_START) ? 1 : MAX_FLIGHT_START / largest;
        return {x: screenX * scale, y: screenY * scale};
    },
    // Where on the screen it is at a share of its flight, picking up speed all the way, and its size, having set off at
    // startSize of what it flies at.
    getFlightStep: (share: number, from: Vec2, to: Vec2, startSize: number): {x: number, y: number, size: number} =>
    {
        const along = share * share;
        const wayX = to.x - from.x, wayY = to.y - from.y;
        const length = Math.max(Math.hypot(wayX, wayY), Number.EPSILON);
        const middleX = 0.5 * (from.x + to.x), middleY = 0.5 * (from.y + to.y);
        const side = (wayY * middleX - wayX * middleY > 0) ? -1 : 1;
        const bow = side * FLIGHT_BOW * Math.sin(Math.PI * along) / length;

        const grown = startSize + (1 - startSize) * Math.min(1, share / GROWING_SHARE);
        const vanishing = Math.max(0, (share - VANISHING_SHARE) / (1 - VANISHING_SHARE));
        return {x: from.x + wayX * along + wayY * bow, y: from.y + wayY * along - wayX * bow,
            size: grown * (1 - FLIGHT_SHRINK * share) * (1 - vanishing * vanishing * (3 - 2 * vanishing))};
    },
}

export default DollarBillPoseUtil;
