import HelperChatTurn from "./helperChatTurn";

// What one pet remembers of its talk with one person or agent (see PetChatUtil), and when they last spoke.
type PetConversation = {turns: HelperChatTurn[], lastAt: number};

export default PetConversation;
