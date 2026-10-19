import Vec3 from "../../../shared/math/types/vec3";
import VoxelVertex from "../../../shared/voxel/types/voxelVertex";
import AgentWalkOutcome from "./agentWalkOutcome";

// A walk an agent is on (see AgentBodyUtil.walk).
export default interface AgentWalk
{
    // Feet positions along the path, from the vertex nearest where the walk began.
    waypoints: Vec3[];
    next: number;
    goal: VoxelVertex;
    // Arrived once this near the target (a person to meet) rather than at the last waypoint.
    arriveWithin?: number;
    target?: Vec3;
    // Turned toward on arrival (a door to go through).
    faceToward?: Vec3;
    deadline: number;
    repaths: number;
    // The nearest the walker has come to its next waypoint, and when: a walk that stops getting nearer is stuck.
    nearest: number;
    nearestAt: number;
    finish: (outcome: AgentWalkOutcome) => void;
}
