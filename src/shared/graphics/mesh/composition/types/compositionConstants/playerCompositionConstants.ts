// A player's parts are authored on a grid rather than in world units, so that the whole character is
// laid out in whole numbers and the parts of it line up by construction. This is the size of one
// square of that grid, and PlayerCompositionBuilder is what multiplies the authored counts by it.
export const UNIT_PLAYER_PART_LENGTH = 0.125;

// The cylinder a rounded body part is drawn as, sized so that the box-shaped part of the same
// character fits inside it — its cross section passes through the corners of that box rather than
// cutting them off, which is what lets a round head and a square one be the same head. The second
// is how far that circle then reaches past the box's own side, which anything laid flat against the
// part has to be pushed out by to clear it (see PlayerHead's eye holder).
export const SAFE_PLAYER_PART_CIRCLE_DIAMETER_IN_UNITS = 2 * Math.sqrt(5);
export const SAFE_PLAYER_PART_CIRCLE_STICK_OUT_LENGTH_IN_UNITS = Math.sqrt(5) - 2;

const PlayerCompositionConstants: PlayerCompositionConstantsType = {
    numTypes: {
        "head": 3,
        "ear": 3,
        "hat": 3,
        "torso": 3,
        "arm": 3,
        "bottom": 3,
    },
}

interface PlayerCompositionConstantsType
{
    numTypes: {[partTypeName: string]: number};
}

export default PlayerCompositionConstants;