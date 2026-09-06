import NumUtil from "../../../math/util/numUtil";
import { MAX_ROOM_PREFS_STEP } from "../../../room/util/roomPrefsUtil";

// A point light takes three numbers, and they are not three separate things a room gets to set. How
// bright a lamp is, how far it carries and how quickly it falls off are one description of one lamp,
// and picked apart into three sliders they mostly describe lamps that do not exist — a fierce light
// that stops dead a pace away, or a faint one that reaches the far wall undimmed. So what a room
// actually chooses is a single **power**, and each step of it is one coherent lamp.
//
// The two ends are what the step runs between:
//
//   - **At full power the head lamp is exactly what it has always been.** That is what makes an
//     unconfigured room look untouched, since full power is the default (see RoomPrefsUtil), and it
//     is why the top of the range is today's lamp rather than something brighter — there was never
//     a complaint that the head lamp was too dim.
//   - **At no power there is no head lamp**, which is the setting a room that lights itself wants:
//     a white lamp riding on the camera is what washes a room's own colored light out from up close,
//     and no amount of dimming removes a white cast entirely.
//
// Between the two, the reach comes down along with the strength rather than staying put. A lamp
// held to a quarter of its light over its full range reads as a room dimmed by a dial; the same
// light over a shorter range reads as a smaller lamp, which is the thing actually being described.
const HeadLightPowerUtil =
{
    getIntensity: (powerStep: number): number =>
    {
        return interpolate(powerStep, 0, FULL_POWER_INTENSITY);
    },
    // Doubles as the reach the intensity above was tuned against, which is what anything scaling
    // the lamp for a camera taken further back has to scale relative to.
    getDistance: (powerStep: number): number =>
    {
        return interpolate(powerStep, MIN_POWER_DISTANCE, FULL_POWER_DISTANCE);
    },
    getDecay: (_powerStep: number): number =>
    {
        return POWER_DECAY;
    },
}

// The lamp at the top of the range: what the head lamp was before a room could say anything about
// it. These three are load-bearing for "an unconfigured room is unchanged" and are not to be
// adjusted without meaning to change every existing room.
const FULL_POWER_INTENSITY = 4.0;
const FULL_POWER_DISTANCE = 16;

// How far a step at the bottom of the range would carry if it carried anything. It does not — the
// intensity is zero there — but the reach has to come down to something on the way, and a lamp
// halfway down the range should be a lamp of half the room rather than a dim wash over all of it.
const MIN_POWER_DISTANCE = 8;

// How the lamp falls off over its range, at every step. Gentler than the inverse square real light
// obeys, because this lamp is not modelling a bulb: it is the near-field depth cue that tells the
// player how far off the wall in front of him is, and a square law spends almost the whole of that
// cue in the first pace.
const POWER_DECAY = 0.5;

function interpolate(powerStep: number, atNoPower: number, atFullPower: number): number
{
    const t = NumUtil.normalizeInRange(powerStep, 0, MAX_ROOM_PREFS_STEP);
    return atNoPower + (atFullPower - atNoPower) * t;
}

export default HeadLightPowerUtil;
