import Vec3 from "../../math/types/vec3";

// A player as a pet sees them (see PetSurroundings): whose, by what name, their player's object, and where their feet
// are.
type PetPersonSighting = {
    userID: string,
    name: string,
    objectId: string,
    at: Vec3,
};

export default PetPersonSighting;
