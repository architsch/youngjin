import NumUtil from "../../../math/util/numUtil";

// Lamp settings: intensity (amount) and range (reach in blocks; falloff derived from it). Two dials so
// both a dim wide wash and a bright tight pool are possible. Both are short runs of whole values that
// are the quantities themselves (intensity multiplier, block count), so the UI can show and tick them.
const LampLightUtil =
{
    // Linear from steep (short reach) to gentle (long reach).
    getDecay: (range: number): number =>
    {
        return NumUtil.convertRange(range, MIN_LAMP_RANGE, MAX_LAMP_RANGE,
            DECAY_AT_MIN_RANGE, DECAY_AT_MAX_RANGE);
    },
}

// Minimum is still a visible light (lamps are never "off"). The maximum intentionally exceeds normal
// lighting for dramatic blown-out effects (see LIGHT_BLOCK_MAP_MAX_BRIGHTNESS).
export const MIN_LAMP_INTENSITY = 1;
export const MAX_LAMP_INTENSITY = 12;

// Reach in blocks, from a small pool to a room-length wash.
export const MIN_LAMP_RANGE = 3;
export const MAX_LAMP_RANGE = 14;

// Decay runs opposite to range; both ends are gentler than inverse-square given the short reach.
const DECAY_AT_MIN_RANGE = 1.2;
const DECAY_AT_MAX_RANGE = 0.3;

export default LampLightUtil;
