// A pet's personality (see PetIdentityUtil). Its owner sets each trait but the sign as the pet is generated, to one of
// PET_TRAIT_LEVELS levels from low (0) up; the sign is drawn at random (see PetZodiacUtil), and shown to nobody.
export default interface PetTraits
{
    // How much it keeps near its owner and takes notice of what they do.
    dependence: number;
    // How much it would rather talk with other pets than to itself.
    sociability: number;
    // How easily it gets angry, and how readily it fights.
    aggressiveness: number;
    // How little frightens it.
    bravery: number;
    // How far it ventures, and how much it seeks out places it hasn't been and odd ones: up high, by a drop, in a corner,
    // by a fan.
    curiosity: number;
    // Its zodiac sign, by its place in the year (see PetZodiacUtil).
    zodiac: number;
}
