export type PetInjection = number;

// What someone can put into a pet (see PetInjectionUtil): a battery, which charges it, or a wrench, which mends it. Sent
// between browsers and the server (see InjectPetSignal), so never renumbered.
export const PetInjectionEnumMap: Record<string, PetInjection> =
{
    Battery: 0,
    Wrench: 1,
}
