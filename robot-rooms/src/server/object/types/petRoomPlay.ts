import Vec3 from "../../../shared/math/types/vec3";
import PetEntrance from "../../../shared/object/types/petEntrance";
import PetPlay from "./petPlay";

// The pets the server plays in one room (see PetPlayUtil), kept as long as the room is loaded.
export default interface PetRoomPlay
{
    // By object id.
    pets: Map<string, PetPlay>;
    // By agent's user id: their pets still coming in after them, for the arrival their player of that id made.
    entrances: Map<string, {playerObjectId: string, entrance: PetEntrance}>;
    // By pet's object id: the way one just brought in behind a door is to walk out of it, once it is played.
    waysIn: Map<string, Vec3[]>;
    // When each body's being caught in a fan's wind last frightened (see PetFrightUtil), and when that was last looked for.
    gustFrightAt: Map<string, number>;
    gustsCheckedAt: number;
}
