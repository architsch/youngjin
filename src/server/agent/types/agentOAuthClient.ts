// A host that signs agents in through the agents' OAuth (see AgentOAuthClientUtil): Claude, ChatGPT, an editor.
export default interface AgentOAuthClient
{
    // The URL of its metadata document, or the id it was given on registering itself.
    clientID: string;
    name: string;
    // Where it may be sent back to with a code.
    redirectURIs: string[];
}
