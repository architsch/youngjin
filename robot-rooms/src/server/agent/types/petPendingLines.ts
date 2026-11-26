// What someone has said to a pet that it is still to answer (see PetChatUtil): who, whether they are an AI agent, their
// lines, and when they said the last of them.
type PetPendingLines = {
    roomID: string,
    petObjectId: string,
    userID: string,
    isAgent: boolean,
    lines: string[],
    lastAt: number,
};

export default PetPendingLines;
