import PetTraits from "./petTraits";

// Who a pet is, for as long as it lives (see PetIdentityUtil): the name printed on it, its personality, and, for one a
// room keeps, the health and the charge it is kept at.
export default interface PetIdentity
{
    name: string;
    traits: PetTraits;
    // Which of PET_FIXED_HEALTHS its health stays at whatever happens to it, counted from 1; 0 for a pet whose health
    // runs down, as every pet's does that follows its owner.
    fixedHealthLevel: number;
    // Likewise, which of PET_FIXED_ENERGIES its charge stays at; 0 for a pet whose battery runs down.
    fixedEnergyLevel: number;
    // The color of its body, a position in PET_COLOR_PALETTE_NAME's palette.
    colorIndex: number;
}
