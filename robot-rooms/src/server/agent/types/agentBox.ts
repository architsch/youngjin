// A box of the room's cells as agents give and are told it: each of its spans [from, to] inclusive, or [one].
export default interface AgentBox
{
    rows: number[];
    columns: number[];
    layers: number[];
}
