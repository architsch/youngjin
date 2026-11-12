import Vec3 from "../../../shared/math/types/vec3";

// A cannon ball as the server is flying it (see CannonBallUtil), at full precision: what its room keeps of it is
// rounded from this.
export default interface CannonBallFlight
{
    pos: Vec3;
    vel: Vec3;
    // See CannonBallState.
    bounces: number;
}
