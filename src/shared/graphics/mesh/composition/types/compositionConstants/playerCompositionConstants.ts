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