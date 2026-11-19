import ObjectWaypoint from "../../../shared/object/types/objectWaypoint";

// How a bill in a room is getting about (see DollarBillUtil).
export default interface DollarBillFlight
{
    // Where it is on its way to, and the one it is going to next; none while it lies still.
    waypoints: ObjectWaypoint[];
    next: number;
    // Whether a stream carries it, which lets go of it only where its path ends, so that it never shudders at the end of
    // one.
    blown: boolean;
    nextGustAt: number;
}
