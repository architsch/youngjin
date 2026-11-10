import CannonState from "../../../shared/object/types/cannonState";

// A cannon as the server is playing it (see CannonUtil), beside what its room keeps of it.
export default interface CannonPlay
{
    // Its state at full precision, which the stored one is rounded from.
    state: CannonState;
    // The player it is turning toward, by their object's id, while it aims.
    targetObjectId: string | undefined;
    // How long its barrel has stayed on them without a break, in seconds, while it is on them.
    onTargetSeconds: number | undefined;
    // What of its stored state the room was last told (see CannonStateUtil.getShownPart).
    told: string;
}
