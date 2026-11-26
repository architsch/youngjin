import PetBehavior from "../../../shared/object/types/petBehavior";
import PetPathSync from "../../../shared/object/types/petPathSync";

// A pet as the server is playing it (see PetPlayUtil), beside what its room keeps of it.
export default interface PetPlay
{
    behavior: PetBehavior;
    // What the room was last told of its way, of what it shows of itself, and of what it says.
    sync: PetPathSync;
    toldState: string;
    toldSaying: string;
    // Its body lies still, so that only its fall is stepped (see AgentBodyUtil); and a force had a part in its last step.
    settled: boolean;
    underForce: boolean;
    // What the room was last told it sells for (a pet the room keeps), and when how it is was last put where it is kept.
    toldPrice: number;
    keptAt: number;
}
