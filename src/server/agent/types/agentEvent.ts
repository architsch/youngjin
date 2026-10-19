// Something that happened around an agent, as whats_new reports it. Names and text come from other players.
export default interface AgentEvent
{
    // Milliseconds since the epoch.
    at: number;
    kind: "speech" | "arrival" | "departure" | "roomEntered" | "roomChangeRefused" | "roomReloading"
        | "blocksChanged" | "objectAdded" | "objectRemoved" | "objectChanged";
    // The player it concerns (speech, arrival, departure), or who added an object.
    who?: string;
    whoIsAgent?: boolean;
    // What they said (speech).
    text?: string;
    // The room entered.
    roomID?: string;
    // Why a room change was refused.
    reason?: string;
    // How many blocks others placed, removed, moved and repainted, one after another, and the box they did it in.
    placed?: number;
    removed?: number;
    moved?: number;
    painted?: number;
    rows?: number[];
    columns?: number[];
    layers?: number[];
    // The object added, removed or changed, and its type.
    id?: string;
    type?: string;
}
