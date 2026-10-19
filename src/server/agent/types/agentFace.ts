import { AgentSide } from "./agentSide";

// One side of the block in a cell, which something hangs on. Layer -1's up side is the room's own floor, and layer
// 16's down side its ceiling.
export default interface AgentFace
{
    row: number;
    column: number;
    layer: number;
    side: AgentSide;
}
