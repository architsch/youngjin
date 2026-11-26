import NumUtil from "../../math/util/numUtil";
import StringUtil from "../../math/util/stringUtil";
import PetNeeds from "../types/petNeeds";

// Character positions in the stored string (see StringUtil): health and energy, which run down over hours, take two
// characters each, so that a short visit's share of them is never rounded away. Never reorder; append only.
const HEALTH_CHAR_INDEX = 0;
const ENERGY_CHAR_INDEX = 2;
const ANGER_CHAR_INDEX = 4;
const HORROR_CHAR_INDEX = 5;
const FATIGUE_CHAR_INDEX = 6;
export const PET_NEEDS_LENGTH = 7;

// Encodes and decodes how a pet is (see PetNeeds). Decoding is total, so any string is a value: by default a pet just
// generated, whole, charged, calm and rested.
const PetNeedsUtil =
{
    getFresh: (): PetNeeds =>
    {
        return {health: 1, energy: 1, anger: 0, horror: 0, fatigue: 0};
    },
    decode: (str: string): PetNeeds =>
    {
        return {
            health: StringUtil.convertVisibleASCIIPairToNumber(str, HEALTH_CHAR_INDEX, 0, 1, 1),
            energy: StringUtil.convertVisibleASCIIPairToNumber(str, ENERGY_CHAR_INDEX, 0, 1, 1),
            anger: readLevel(str, ANGER_CHAR_INDEX),
            horror: readLevel(str, HORROR_CHAR_INDEX),
            fatigue: readLevel(str, FATIGUE_CHAR_INDEX),
        };
    },
    encode: (needs: PetNeeds): string =>
    {
        const chars: string[] = [];
        chars[HEALTH_CHAR_INDEX] = StringUtil.convertNumberToVisibleASCIIPair(needs.health, 0, 1);
        chars[ENERGY_CHAR_INDEX] = StringUtil.convertNumberToVisibleASCIIPair(needs.energy, 0, 1);
        chars[ANGER_CHAR_INDEX] = encodeLevel(needs.anger);
        chars[HORROR_CHAR_INDEX] = encodeLevel(needs.horror);
        chars[FATIGUE_CHAR_INDEX] = encodeLevel(needs.fatigue);
        return chars.join("");
    },
    // Each back within its range.
    clamp: (needs: PetNeeds): void =>
    {
        for (const key of Object.keys(needs) as (keyof PetNeeds)[])
            needs[key] = Number.isFinite(needs[key]) ? NumUtil.clampInRange(needs[key], 0, 1) : 0;
    },
}

function readLevel(str: string, charIndex: number): number
{
    return (charIndex < str.length) ? StringUtil.convertVisibleASCIIToNumber(str, charIndex, 0, 1) : 0;
}

function encodeLevel(level: number): string
{
    return StringUtil.convertNumberToVisibleASCII(Number.isFinite(level) ? NumUtil.clampInRange(level, 0, 1) : 0, 0, 1);
}

export default PetNeedsUtil;
