import NumUtil from "../../../math/util/numUtil";
import { MAX_ROOM_PREFS_STEP } from "../../../room/util/roomPrefsUtil";

// What the lamp riding on the camera gives off, as two settings rather than one or three — the same
// division a lamp somebody installed is given, and for the same reason (see LampLightUtil).
//
// **Three would be wrong.** A point light takes brightness, reach and falloff, and offered as three
// free dials they mostly describe lamps that do not exist: a fierce light that stops dead a pace
// away, or a faint one that reaches the far wall undimmed. Reach and falloff are one question.
//
// **One was wrong too, which is what changed here.** This module used to fuse all three into a single
// "power", with the reach coming down along with the strength — the argument being that a light held
// to a quarter of its brightness over its full range reads as a room dimmed by a dial, where the same
// light over a shorter range reads as a smaller lamp. That is true as far as it goes, and it is also
// only one of the lamps somebody might want. Fused, a dim lamp is always a small one and a bright
// lamp always a far-reaching one, so a soft wash filling the room and a fierce pool a pace across are
// opposite ends of one dial and neither of the two crossings can be asked for at all.
//
//   - **Power** — how much light there is. Nothing about where it goes.
//   - **Range** — how far it carries and how sharply it falls off on the way, which are one question
//     for the reason above.
//
// Three points on the power range matter rather than two:
//
//   - **At no power there is no head lamp**, which is the setting a room that lights itself wants:
//     a white lamp riding on the camera is what washes a room's own colored light out from up close,
//     and no amount of dimming removes a white cast entirely.
//   - **At the default step the head lamp is exactly what it has always been.** That is what makes
//     an unconfigured room look untouched, and it is why both defaults sit two thirds of the way up
//     rather than at the top: a default at the top is the same thing as saying there is nothing above
//     it. What has to stay fixed is the lamp an unconfigured room gets, not which number names it.
//   - **Above that the lamp goes on getting brighter**, well past the ordinary one, for the rooms
//     that want a lamp as an effect rather than as a way of seeing.
const HeadLightUtil =
{
    // Cubed, for the reason the ambient is (see RoomPrefsUtil): the judgement about how brightly to
    // light a room lives in the bottom of the range, and the top is an effect that would otherwise
    // swallow the travel. It has to reach nothing at the bottom, which is why this is a cube rather
    // than the geometric curve a lamp's brightness runs on — a lamp is furniture and is never off,
    // where a head lamp being off is the whole point of a room that lights itself.
    getIntensity: (powerStep: number): number =>
    {
        const t = NumUtil.normalizeInRange(powerStep, 0, MAX_ROOM_PREFS_STEP);
        return MAX_POWER_INTENSITY * t * t * t;
    },
    // Doubles as the reach the intensity above was tuned against, which is what anything scaling
    // the lamp for a camera taken further back has to scale relative to (see GraphicsManager).
    getDistance: (rangeStep: number): number =>
    {
        return interpolate(rangeStep, MIN_RANGE_DISTANCE, MAX_RANGE_DISTANCE);
    },
    // Runs the other way from the reach, because the two are halves of one description: a lamp given
    // a long reach with a steep falloff is a lamp whose range does nothing.
    getDecay: (rangeStep: number): number =>
    {
        return interpolate(rangeStep, MIN_RANGE_DECAY, MAX_RANGE_DECAY);
    },
}

// The lamp at the top of the range: far past what it takes to see by, which is what it is for. A
// lamp this strong is a flash rather than a torch, and everything close to the player goes to white
// under it.
//
// Neither number is chosen freely. Both are what the curves above have to reach at the top for the
// *ordinary* lamp — the one below, which every unconfigured room still gets — to land exactly on the
// default step. Change one and the default step changes with it, or every room already stored is
// re-lit.
const MAX_POWER_INTENSITY = 13.5;

// At the tight end, a pool a few paces across going to nothing quickly — a lamp that says where the
// player is standing and nothing about the room. At the wide end a wash carrying the length of a
// room and falling off gently enough to still be putting light on the far wall.
//
// The falloff is gentler at every step than the inverse square a real light obeys, because this lamp
// is not modelling a bulb: it is the near-field depth cue that tells the player how far off the wall
// in front of him is, and a square law spends almost the whole of that cue in the first pace.
const MIN_RANGE_DISTANCE = 4;
const MAX_RANGE_DISTANCE = 22;
const MIN_RANGE_DECAY = 1.1;
const MAX_RANGE_DECAY = 0.2;

// What the head lamp was before a room could say anything about it, and what an unconfigured room
// still gets. Load-bearing for "an unconfigured room is unchanged": these are the values the default
// steps have to keep arriving at, and they are why both sit two thirds of the way up rather than at
// the top (see RoomPrefsUtil, which holds the steps themselves).
export const ORDINARY_POWER_INTENSITY = 4.0;
export const ORDINARY_RANGE_DISTANCE = 16;
export const ORDINARY_RANGE_DECAY = 0.5;

function interpolate(powerStep: number, atNoPower: number, atFullPower: number): number
{
    const t = NumUtil.normalizeInRange(powerStep, 0, MAX_ROOM_PREFS_STEP);
    return atNoPower + (atFullPower - atNoPower) * t;
}

export default HeadLightUtil;
