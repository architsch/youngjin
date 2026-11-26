import Vec3 from "../../math/types/vec3";

// A pet that a line someone says may be for (see PetListenerUtil): its object, its name, and where its middle is.
type PetListener = {
    objectId: string,
    name: string,
    at: Vec3,
};

export default PetListener;
