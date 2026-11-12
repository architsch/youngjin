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
    // The one of them the ball itself struck, if it struck one, and the way that throws them across the room, as the
    // server had the two meet (see CannonBlastUtil.getHeading).
    struck?: {objectId: string, heading: number};
    // How many times it has bounced off something, counted round (see CannonBallStateUtil.countBounce), which tells a
    // browser of a bounce it hasn't shown. Nothing once it has burst.
    bounces: number;
}
