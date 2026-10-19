// What register gives an agent: its key (shown only this once), or why it got none.
type AgentRegistrationResult = {key: string, userName: string} | {error: string};

export default AgentRegistrationResult;
