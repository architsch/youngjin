import { NpcPersonality } from "../types/npcPersonality";

const MODE_SWITCH = `<control name="modeSwitch"/>`;

// The characters an NPC can be played as (see HelperBehaviorUtil), in the order an admin is offered them for one. Its
// BehaviorPrefs store one by its place here, so a new one goes at the end, and none is ever moved or taken out. Each
// talks in a manner of its own and likes its own subjects best, as the server has Claude play it (see
// helperPersonalities.ts), greets people inviting them to something (saying what it is, its role, when it has no
// name), and tells anyone never told how to walk and build, in words of its own that need no keyboard, showing the
// switch to build with rather than saying where it is (see ScreenControlMap). The first is what an NPC with none is
// played as. One with no role isn't played at all: it stands where it was put, and only its room's script moves it or
// gives it words.
const entries: {id: NpcPersonality, label: string, description: string, role?: string, invitation?: string,
    basics?: string}[] = [
    {id: "guide", label: "Guide", description: "Friendly and clear. Helps newcomers get started.",
        role: "guide", invitation: "Ask me anything, or just look around!",
        basics: `Here's how to start: drag on the screen to walk, and switch to Edit with ${MODE_SWITCH} to build.`},
    {id: "builder", label: "Builder", description: "Energetic. Loves building, and full of tips.",
        role: "builder", invitation: "Want to build something? Ask me how!",
        basics: `To build, switch to Edit with ${MODE_SWITCH}, then click a block. To walk, drag on the screen!`},
    {id: "explorer", label: "Explorer", description: "Curious. Loves doors, hubs and hidden corners.",
        role: "explorer", invitation: "Ask me where to go, or anything else!",
        basics: "Drag on the screen to walk, and click a door to see where it leads. To build, switch to Edit with "
            + `${MODE_SWITCH}!`},
    {id: "storyteller", label: "Storyteller", description: "Loves stories. Tells of books, legends and history.",
        role: "storyteller", invitation: "Ask me anything, or ask me for a tale!",
        basics: `First, how to play: drag on the screen to walk, and switch to Edit with ${MODE_SWITCH} to build.`},
    {id: "jester", label: "Jester", description: "Playful. Funny facts and friendly jokes.",
        role: "jester", invitation: "Ask me anything. Some of my answers are even serious!",
        basics: `Two tips, no jokes: drag on the screen to walk, and switch to Edit with ${MODE_SWITCH} to build.`},
    {id: "sage", label: "Sage", description: "Calm and thoughtful. Talks of great thinkers.",
        role: "sage", invitation: "Ask me anything, or let us simply talk.",
        basics: `Drag on the screen to walk. When you wish to build, switch to Edit with ${MODE_SWITCH}.`},
    {id: "caretaker", label: "Caretaker", description: "Gruff but kind. Grumbles about stray blocks.",
        role: "caretaker", invitation: "Ask away, and mind the blocks!",
        basics: `Two things to know: drag on the screen to walk, and switch to Edit with ${MODE_SWITCH} to build.`},
    {id: "curator", label: "Curator", description: "Art-loving. Talks paintings, colors and light.",
        role: "curator", invitation: "Ask me anything, especially about art!",
        basics: `Drag on the screen to walk around, and switch to Edit with ${MODE_SWITCH} to build or hang a `
            + "painting."},
    {id: "idle", label: "Idle", description: "Not played. Stands still, and says only what its room's script gives it."},
];

const NpcPersonalityMap =
{
    getEntries: (): {id: NpcPersonality, label: string, description: string}[] =>
    {
        return entries;
    },
    // One by its id, as a browser names it (see HelperRouter) and as NPCs kept it before BehaviorPrefs; the first for
    // any other.
    read: (id: string): NpcPersonality =>
    {
        return getEntry(id.trim())?.id ?? entries[0].id;
    },
    // Its place here, as BehaviorPrefs store it (see BehaviorPrefsUtil), and back; the first for any other.
    toCode: (personality: NpcPersonality): number =>
    {
        return Math.max(0, entries.findIndex(entry => entry.id == personality));
    },
    fromCode: (code: number): NpcPersonality =>
    {
        return entries[code]?.id ?? entries[0].id;
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
    getBasics: (personality: NpcPersonality): string =>
    {
        return getEntry(personality)?.basics ?? "";
    },
}

function getEntry(id: string): {id: NpcPersonality, label: string, description: string, role?: string,
    invitation?: string, basics?: string} | undefined
{
    return entries.find(entry => entry.id == id);
}

export default NpcPersonalityMap;
