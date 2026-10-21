import { NpcPersonality } from "../types/npcPersonality";

// The characters an NPC can be played as (see HelperBehaviorUtil), in the order an admin is offered them for one (its
// Personality key). Each talks in a manner of its own and likes its own subjects best, as the server has Claude play it
// (see helperPersonalities.ts), and greets people inviting them to something (saying what it is, its role, when it has
// no name). The first is what an NPC with none, or one no longer offered, is played as. One with no role isn't played
// at all: it stands where it was put, and only its room's script moves it or gives it words.
const entries: {id: NpcPersonality, label: string, description: string, role?: string, invitation?: string}[] = [
    {id: "guide", label: "Guide", description: "Friendly and clear. Helps newcomers get started.",
        role: "guide", invitation: "Ask me anything, or just look around!"},
    {id: "builder", label: "Builder", description: "Energetic. Loves building, and full of tips.",
        role: "builder", invitation: "Want to build something? Ask me how!"},
    {id: "explorer", label: "Explorer", description: "Curious. Loves doors, hubs and hidden corners.",
        role: "explorer", invitation: "Ask me where to go, or anything else!"},
    {id: "storyteller", label: "Storyteller", description: "Whimsical. Spins little legends.",
        role: "storyteller", invitation: "Ask me anything, or ask me for a tale!"},
    {id: "jester", label: "Jester", description: "Playful. Puns and friendly jokes.",
        role: "jester", invitation: "Ask me anything. Some of my answers are even serious!"},
    {id: "sage", label: "Sage", description: "Calm and thoughtful. Ponders big ideas.",
        role: "sage", invitation: "Ask me anything, or let us simply talk."},
    {id: "caretaker", label: "Caretaker", description: "Gruff but kind. Grumbles about stray blocks.",
        role: "caretaker", invitation: "Ask away, and mind the blocks!"},
    {id: "curator", label: "Curator", description: "Art-loving. Talks paintings, colors and light.",
        role: "curator", invitation: "Ask me anything, especially about art!"},
    {id: "idle", label: "Idle", description: "Not played. Stands still, and says only what its room's script gives it."},
];

const NpcPersonalityMap =
{
    getEntries: (): {id: NpcPersonality, label: string, description: string}[] =>
    {
        return entries;
    },
    read: (stored: string): NpcPersonality =>
    {
        return getEntry(stored.trim())?.id ?? entries[0].id;
    },
    // A known id, else none.
    canonicalize: (rawValue: string): string =>
    {
        return (getEntry(rawValue.trim()) != undefined) ? rawValue.trim() : "";
    },
    // Whether an NPC of this personality is played at all (see above).
    isPlayed: (personality: NpcPersonality): boolean =>
    {
        return getEntry(personality)?.role != undefined;
    },
    // What one with no name greets people as, and what each invites them to (see HelperBehaviorUtil.getGreeting).
    getRole: (personality: NpcPersonality): string =>
    {
        return getEntry(personality)?.role ?? "";
    },
    getInvitation: (personality: NpcPersonality): string =>
    {
        return getEntry(personality)?.invitation ?? "";
    },
}

function getEntry(id: string): {id: NpcPersonality, label: string, description: string, role?: string,
    invitation?: string} | undefined
{
    return entries.find(entry => entry.id == id);
}

export default NpcPersonalityMap;
