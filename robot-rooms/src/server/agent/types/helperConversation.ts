import { NpcPersonality } from "../../../shared/object/types/npcPersonality";
import HelperChatTurn from "./helperChatTurn";

// What one helper remembers of its talk with one person or agent (see HelperChatUtil), and the things on its mind and
// the mood it is in for it, picked for the personality it was played as.
type HelperConversation = {turns: HelperChatTurn[], lastAt: number, personality: NpcPersonality, topics: string[],
    mood: string};

export default HelperConversation;
