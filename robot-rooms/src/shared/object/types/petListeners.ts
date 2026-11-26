import PetListener from "./petListener";

// The pets of a room that a line someone says may be for (see PetListenerUtil): the one it names, if it names one, and
// those near enough to whoever says it to hear it.
type PetListeners = {
    named: PetListener | undefined,
    hearing: PetListener[],
};

export default PetListeners;
