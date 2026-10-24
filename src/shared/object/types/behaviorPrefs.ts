import { NpcPersonality } from "./npcPersonality";

// An object's behavioral settings, stored as its BehaviorPrefs metadata (see BehaviorPrefsUtil), each read by the types
// it means something to: so far an NPC's, as it is played as a helper (see HelperBehaviorUtil).
export default interface BehaviorPrefs
{
    // The character it is played as (see NpcPersonalityMap).
    personality: NpcPersonality;
    // How far from home, in world units across the floor, a place it goes to may be. Its way there may run farther.
    wanderRadius: number;
    // Whether it may climb to other floors, or keeps to about the height of home.
    canClimb: boolean;
    // Whether it goes back home after each place it wanders to, or wanders on from one to the next.
    anchoredToHome: boolean;
    // In whole seconds, the least and the most it stands idle before it wanders off again: each time a while picked at
    // random between the two.
    minIdleTime: number;
    maxIdleTime: number;
}
