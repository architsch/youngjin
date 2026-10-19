import AgentWalk from "./agentWalk";

// How an agent's body is moving, as the server walks it (see AgentBodyUtil).
export default interface AgentMotion
{
    // The player this moves: arriving anywhere, the same room again included, spawns another, and starts it over
    // with the walk out of the doorway.
    playerObjectId: string;
    // Which way the agent faces about +Y: (sin, cos) on (x, z).
    yaw: number;
    entering?: {dirX: number, dirZ: number, fromX: number, fromZ: number, timeLeft: number};
    walk?: AgentWalk;
    // At rest with nothing to move it, so probed with a single step per flush rather than stepped throughout.
    settled: boolean;
    // Held still for the flush after it arrived, which sends the others its player: a browser applies a move at
    // once but spawns a player when the room is ready, so a move in the same batch would find no one to move.
    heldForArrival: boolean;
}
