import NumUtil from "../../../math/util/numUtil";
import { MAX_ROOM_PREFS_STEP } from "../../../room/util/roomPrefsUtil";

// Head light settings: power (amount) and range (reach plus falloff, one question), as with lamps
// (see LampLightUtil). Power 0 = off (for self-lit rooms). The default steps (two thirds up)
// reproduce the ordinary head light; higher steps go well beyond it for effect.
const HeadLightUtil =
{
    // Cubed (like ambient; see RoomPrefsUtil): fine control at the low end, and reaches zero.
    getIntensity: (powerStep: number): number =>
    {
        const t = NumUtil.normalizeInRange(powerStep, 0, MAX_ROOM_PREFS_STEP);
        return MAX_POWER_INTENSITY * t * t * t;
    },
    getDistance: (rangeStep: number): number =>
    {
        return interpolate(rangeStep, MIN_RANGE_DISTANCE, MAX_RANGE_DISTANCE);
    },
    // Falloff runs opposite to reach (long reach with steep falloff would be pointless).
    getDecay: (rangeStep: number): number =>
    {
        return interpolate(rangeStep, MIN_RANGE_DECAY, MAX_RANGE_DECAY);
    },
}

// Maximum power: a flash rather than a torch. Constrained so the ordinary intensity lands exactly on
// the default step; changing it re-lights every stored room.
const MAX_POWER_INTENSITY = 13.5;

// Range from a tight pool to a room-length wash. Falloff stays gentler than inverse-square, since this
// is a near-field depth cue.
const MIN_RANGE_DISTANCE = 4;
const MAX_RANGE_DISTANCE = 22;
const MIN_RANGE_DECAY = 1.1;
const MAX_RANGE_DECAY = 0.2;

// The ordinary head light that the default steps must reproduce (see RoomPrefsUtil).
export const ORDINARY_POWER_INTENSITY = 4.0;
export const ORDINARY_RANGE_DISTANCE = 16;
export const ORDINARY_RANGE_DECAY = 0.5;

function interpolate(powerStep: number, atNoPower: number, atFullPower: number): number
{
    const t = NumUtil.normalizeInRange(powerStep, 0, MAX_ROOM_PREFS_STEP);
    return atNoPower + (atFullPower - atNoPower) * t;
}

export default HeadLightUtil;
