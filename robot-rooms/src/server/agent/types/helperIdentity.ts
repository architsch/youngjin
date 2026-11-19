import { NpcPersonality } from "../../../shared/object/types/npcPersonality";

// Who a helper is, for what it is asked to say (see HelperChatUtil): its key, its name ("" if it has none), where it
// stands, in words, and the character it is played as.
type HelperIdentity = {key: string, name: string, place: string, personality: NpcPersonality};

export default HelperIdentity;
