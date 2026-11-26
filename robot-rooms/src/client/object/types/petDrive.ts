import PetBehavior from "../../../shared/object/types/petBehavior";
import PetPathSync from "../../../shared/object/types/petPathSync";

// A pet as this browser plays it (see PetDriverUtil), beside what its room keeps of it.
export default interface PetDrive
{
    behavior: PetBehavior;
    // What the room was last told of its way, of what it shows of itself, and of what it says.
    sync: PetPathSync;
    toldState: string;
    toldSaying: string;
    // Whether a force of the room's had a part in its last move.
    underForce: boolean;
    // When its body was last steered, by the clock, and how much of the clock's time its frames have left out since (see
    // PetDriverUtil.drive).
    steeredAt: number | undefined;
    secondsBehind: number;
}
