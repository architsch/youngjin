import CannonAim from "./cannonAim";
import { CannonPhase } from "./cannonPhase";

// All a cannon keeps of itself, stored as its CannonState metadata (see CannonStateUtil): its switch is its user's
// to set, or the server's as it ends a row of shots, and the rest the server's as it plays it (see CannonUtil).
export default interface CannonState
{
    on: boolean;
    phase: CannonPhase;
    ballsLeft: number;
    aim: CannonAim;
    // Seconds left of its phase.
    timeLeft: number;
    // Balls fired since it was switched on, which switch it off once there are CANNON_SHOTS_IN_A_ROW.
    shotsInARow: number;
}
