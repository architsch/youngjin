// Grid square size; parts are authored in whole grid units (see PlayerCompositionBuilder).
export const UNIT_PLAYER_PART_LENGTH = 0.125;

// Cylinder diameter whose cross-section passes through the corners of the equivalent box (so round and
// square parts are interchangeable), and how far it extends past the box's side (see PlayerHead's eye holder).
export const SAFE_PLAYER_PART_CIRCLE_DIAMETER_IN_UNITS = 2 * Math.sqrt(5);
export const SAFE_PLAYER_PART_CIRCLE_STICK_OUT_LENGTH_IN_UNITS = Math.sqrt(5) - 2;

const PlayerCompositionConstants: PlayerCompositionConstantsType = {
    numTypes: {
        "head": 6,
        "ear": 6,
        "hat": 6,
        "torso": 6,
        "arm": 6,
        "bottom": 6,
    },
}

interface PlayerCompositionConstantsType
{
    numTypes: {[partTypeName: string]: number};
}

export default PlayerCompositionConstants;