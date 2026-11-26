import Vec3 from "../../math/types/vec3";
import ColorUtil from "../../math/util/colorUtil";
import NumUtil from "../../math/util/numUtil";
import StringUtil from "../../math/util/stringUtil";
import AddObjectSignal from "../types/addObjectSignal";
import { ObjectMetadataKeyEnumMap } from "../types/objectMetadataKey";
import PetIdentity from "../types/petIdentity";
import PetTraits from "../types/petTraits";
import { PET_RUST_LEVELS } from "./petShownStateUtil";
import { NUM_ZODIAC_SIGNS } from "./petZodiacUtil";

// In code points, of any script.
export const PET_NAME_MAX_LENGTH = 16;
// How many levels a trait its owner sets has: low, medium and high.
export const PET_TRAIT_LEVELS = 3;
export const PET_TRAIT_LEVEL_LABELS = ["Low", "Medium", "High"];
const DEFAULT_TRAIT_LEVEL = 1;
// The shares of full health a pet's can be fixed at (see PetIdentity.fixedHealthLevel), each showing one step of rust
// less than the last, as a pet run down to it does (see PetShownStateUtil.getRust); and of a full charge its
// battery's, each lighting one cell of its indicator more than the last (see PetShownStateUtil.getBatteryLevel).
export const PET_FIXED_HEALTHS = Array.from({length: PET_RUST_LEVELS}, (_, i) => (i + 1) / PET_RUST_LEVELS);
export const PET_FIXED_ENERGIES = [1 / 6, 0.5, 1];
// What a pet's body is painted from (see PetIdentity.colorIndex).
export const PET_COLOR_PALETTE_NAME = "Pet";

// Character positions in the stored string, one base-94 character each (see StringUtil), ahead of the name, which is
// the rest. Never reorder: a setting added later goes into the head's spare characters.
const DEPENDENCE_CHAR_INDEX = 0;
const SOCIABILITY_CHAR_INDEX = 1;
const AGGRESSIVENESS_CHAR_INDEX = 2;
const BRAVERY_CHAR_INDEX = 3;
const ZODIAC_CHAR_INDEX = 4;
const FIXED_HEALTH_CHAR_INDEX = 5;
const CURIOSITY_CHAR_INDEX = 6;
const FIXED_ENERGY_CHAR_INDEX = 7;
const COLOR_CHAR_INDEX = 8;
// (9 to 11 are spare.)
const HEAD_LENGTH = 12;
const SPARE_CHAR = StringUtil.convertRawNumberToVisibleASCII(0);

// Encodes and decodes who a pet is (its PetIdentity metadata, and the same in its owner's record of it, see
// PetRecordUtil). Decoding is total, so any string is a value: by default a nameless pet of medium traits.
const PetIdentityUtil =
{
    decode: (str: string): PetIdentity =>
    {
        const read = (charIndex: number, fallback: number) => StringUtil.convertVisibleASCIIToRawNumber(str, charIndex,
            fallback);
        const readLevel = (charIndex: number) => Math.min(PET_TRAIT_LEVELS - 1, read(charIndex, DEFAULT_TRAIT_LEVEL));
        return {
            name: PetIdentityUtil.sanitizeName(str.slice(HEAD_LENGTH)),
            traits: {
                dependence: readLevel(DEPENDENCE_CHAR_INDEX),
                sociability: readLevel(SOCIABILITY_CHAR_INDEX),
                aggressiveness: readLevel(AGGRESSIVENESS_CHAR_INDEX),
                bravery: readLevel(BRAVERY_CHAR_INDEX),
                curiosity: readLevel(CURIOSITY_CHAR_INDEX),
                zodiac: Math.min(NUM_ZODIAC_SIGNS - 1, read(ZODIAC_CHAR_INDEX, 0)),
            },
            fixedHealthLevel: Math.min(PET_FIXED_HEALTHS.length, read(FIXED_HEALTH_CHAR_INDEX, 0)),
            fixedEnergyLevel: Math.min(PET_FIXED_ENERGIES.length, read(FIXED_ENERGY_CHAR_INDEX, 0)),
            colorIndex: Math.min(ColorUtil.getPaletteSize(PET_COLOR_PALETTE_NAME) - 1, read(COLOR_CHAR_INDEX, 0)),
        };
    },
    encode: (identity: PetIdentity): string =>
    {
        const write = (value: number, most: number, fallback: number) => StringUtil.convertRawNumberToVisibleASCII(
            Number.isFinite(value) ? Math.round(NumUtil.clampInRange(value, 0, most)) : fallback);
        const level = (value: number) => write(value, PET_TRAIT_LEVELS - 1, DEFAULT_TRAIT_LEVEL);
        const {traits} = identity;
        const chars: string[] = new Array(HEAD_LENGTH).fill(SPARE_CHAR);
        chars[DEPENDENCE_CHAR_INDEX] = level(traits.dependence);
        chars[SOCIABILITY_CHAR_INDEX] = level(traits.sociability);
        chars[AGGRESSIVENESS_CHAR_INDEX] = level(traits.aggressiveness);
        chars[BRAVERY_CHAR_INDEX] = level(traits.bravery);
        chars[CURIOSITY_CHAR_INDEX] = level(traits.curiosity);
        chars[ZODIAC_CHAR_INDEX] = write(traits.zodiac, NUM_ZODIAC_SIGNS - 1, 0);
        chars[FIXED_HEALTH_CHAR_INDEX] = write(identity.fixedHealthLevel, PET_FIXED_HEALTHS.length, 0);
        chars[FIXED_ENERGY_CHAR_INDEX] = write(identity.fixedEnergyLevel, PET_FIXED_ENERGIES.length, 0);
        chars[COLOR_CHAR_INDEX] = write(identity.colorIndex, ColorUtil.getPaletteSize(PET_COLOR_PALETTE_NAME) - 1, 0);
        return chars.join("") + PetIdentityUtil.sanitizeName(identity.name);
    },
    canonicalize: (str: string): string =>
    {
        return PetIdentityUtil.encode(PetIdentityUtil.decode(str));
    },
    // A name as it is kept: on one line, with nothing but single spaces between its words and none around it, and no
    // longer than a name may be.
    sanitizeName: (name: string): string =>
    {
        const oneLine = name.replace(/[\s\p{Cc}]+/gu, " ").trim();
        return StringUtil.truncateByCodePoints(oneLine, PET_NAME_MAX_LENGTH).trim();
    },
    // Whether a value is one a pet may be generated with: named, and stored as it would be read.
    isComplete: (str: string): boolean =>
    {
        return PetIdentityUtil.decode(str).name.length > 0 && PetIdentityUtil.canonicalize(str) == str;
    },
    getObjectIdentity: (obj: AddObjectSignal): PetIdentity =>
    {
        return PetIdentityUtil.decode(obj.metadata[ObjectMetadataKeyEnumMap.PetIdentity]?.str ?? "");
    },
    // The traits its owner sets, in the order the form that generates one lists them (see GeneratePetForm).
    getTraitLevels: (traits: PetTraits): number[] =>
    {
        return [traits.dependence, traits.sociability, traits.aggressiveness, traits.bravery, traits.curiosity];
    },
    // The health a pet is kept at, from 0 to 1; undefined for one whose health runs down.
    getFixedHealth: (identity: PetIdentity): number | undefined =>
    {
        return PET_FIXED_HEALTHS[identity.fixedHealthLevel - 1];
    },
    // Likewise its charge; undefined for one whose battery runs down.
    getFixedEnergy: (identity: PetIdentity): number | undefined =>
    {
        return PET_FIXED_ENERGIES[identity.fixedEnergyLevel - 1];
    },
    // Its body's color, as [0,255] RGB.
    getBodyColor: (identity: PetIdentity): Vec3 =>
    {
        return ColorUtil.paletteIndexToRGB(PET_COLOR_PALETTE_NAME, identity.colorIndex);
    },
}

export default PetIdentityUtil;
