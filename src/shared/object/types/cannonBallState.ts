import Vec3 from "../../math/types/vec3";

// All a cannon ball keeps of itself, stored as its CannonState metadata (see CannonBallStateUtil), which the server
// alone writes (see CannonBallUtil).
export default interface CannonBallState
{
    // Where its middle is and how fast it goes, in world units a second; or, exploded, where its middle was as it struck.
    pos: Vec3;
    vel: Vec3;
    // Whether it has burst, which it says just before it is removed: one removed without saying so only left.
    exploded: boolean;
    // The players its blast threw, by their objects' ids.
    hitObjectIds: string[];
}
