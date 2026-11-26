import Vec3 from "../../math/types/vec3";
import PetIdentity from "./petIdentity";
import PetShownState from "./petShownState";

// Another pet as one sees it (see PetSurroundings): where its feet are, who it is, and what it shows of itself.
type PetSighting = {
    objectId: string,
    ownerUserID: string,
    at: Vec3,
    identity: PetIdentity,
    shown: PetShownState,
};

export default PetSighting;
