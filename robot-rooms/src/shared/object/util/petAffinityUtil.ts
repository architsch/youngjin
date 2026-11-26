import StringUtil from "../../math/util/stringUtil";
import PetTraits from "../types/petTraits";
import { PET_TRAIT_LEVELS } from "./petIdentityUtil";
import PetZodiacUtil from "./petZodiacUtil";

// How much each thing weighs in how one pet takes to another: their signs first, then what each is like, then luck. A
// score past LOVE either way is a liking or a dislike; in between, it is nothing in particular.
const SIGN_WEIGHT = 2;
const LOVE = 1.5;
const OWN_SOCIABILITY_WEIGHT = 0.5;
const THEIR_SOCIABILITY_WEIGHT = 0.25;
const OWN_AGGRESSIVENESS_WEIGHT = 0.75;
const CLASH_WEIGHT = 0.5;
const BULLY_WEIGHT = 0.75;
const KINDRED_WEIGHT = 0.25;
const LUCK_WEIGHT = 0.75;
const MIDDLE_LEVEL = 0.5 * (PET_TRAIT_LEVELS - 1);
const TOP_LEVEL = PET_TRAIT_LEVELS - 1;

// How one pet takes to another: decided by who the two are, the same every time, and not mutual. Their signs weigh
// most (see PetZodiacUtil); then a sociable pet takes to others, and to sociable ones, an aggressive one against
// them, two aggressive ones clash, a timid one shrinks from an aggressive one, and two alike in how they cling to
// their owners get on; and each pair has some luck of its own, for no reason at all.
const PetAffinityUtil =
{
    getScore: (selfId: string, self: PetTraits, otherId: string, other: PetTraits): number =>
    {
        let score = SIGN_WEIGHT * PetZodiacUtil.getPull(self.zodiac, other.zodiac);
        score += OWN_SOCIABILITY_WEIGHT * (self.sociability - MIDDLE_LEVEL);
        score += THEIR_SOCIABILITY_WEIGHT * (other.sociability - MIDDLE_LEVEL);
        score -= OWN_AGGRESSIVENESS_WEIGHT * (self.aggressiveness - MIDDLE_LEVEL);
        if (self.aggressiveness == TOP_LEVEL && other.aggressiveness == TOP_LEVEL)
            score -= CLASH_WEIGHT;
        if (self.bravery == 0 && other.aggressiveness == TOP_LEVEL)
            score -= BULLY_WEIGHT;
        if (self.dependence == other.dependence)
            score += KINDRED_WEIGHT;
        // From -1 to 1, by the pair, in this order.
        const luck = (((StringUtil.getHashCode(`${selfId}>${otherId}`) % 2001) + 2001) % 2001) / 1000 - 1;
        return score + LUCK_WEIGHT * luck;
    },
    loves: (selfId: string, self: PetTraits, otherId: string, other: PetTraits): boolean =>
    {
        return PetAffinityUtil.getScore(selfId, self, otherId, other) >= LOVE;
    },
    hates: (selfId: string, self: PetTraits, otherId: string, other: PetTraits): boolean =>
    {
        return PetAffinityUtil.getScore(selfId, self, otherId, other) <= -LOVE;
    },
}

export default PetAffinityUtil;
