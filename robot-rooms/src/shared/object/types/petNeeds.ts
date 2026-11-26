// How a pet is, each from 0 to 1 (see PetNeedsUtil): what whoever plays it changes as time passes and things happen to
// it, only while it is played.
export default interface PetNeeds
{
    // What is left of its life: it is scrap at none.
    health: number;
    // What is left of its battery.
    energy: number;
    anger: number;
    horror: number;
    fatigue: number;
}
