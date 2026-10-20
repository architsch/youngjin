import HelperChatTurn from "./helperChatTurn";

// What one helper remembers of its talk with one person or agent (see HelperChatUtil).
type HelperConversation = {turns: HelperChatTurn[], lastAt: number};

export default HelperConversation;
