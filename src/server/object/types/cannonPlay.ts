import EncodableByteString from "../../../shared/networking/types/encodableByteString";
import CannonState from "../../../shared/object/types/cannonState";

// A cannon as the server is playing it (see CannonUtil), beside what its room keeps of it.
export default interface CannonPlay
{
    // Its state at full precision, which the stored one is rounded from.
    state: CannonState;
    // The player it is turning toward, by their object's id, while it aims.
    targetObjectId: string | undefined;
    // How long it has had them in its sights without a break, in seconds, while it has.
    inSightsSeconds: number | undefined;
    // What of its stored state the room was last told (see CannonStateUtil.getShownPart).
    told: string;
    // The value it last stored under its key, which any word of its switch replaces with one of its own (see
    // ObjectUpdateUtil.setObjectMetadata), even one leaving it as it was.
    kept: EncodableByteString | undefined;
}
