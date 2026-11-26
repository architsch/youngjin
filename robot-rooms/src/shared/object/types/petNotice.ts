import Vec3 from "../../math/types/vec3";

// Something that has happened to a pet, which it reacts to only once that is due (see PetBehaviorUtil), by whoever
// plays it's clock: a start (a blast or a push), a fright near it, with what it rouses in it and the pets fighting
// there, or something put into it (a battery, or else a wrench).
type PetNotice =
    | {kind: "start", due: number}
    | {kind: "fright", due: number, at: Vec3, anger: number, horror: number, fighterIds: string[]}
    | {kind: "injection", due: number, charged: boolean};

export default PetNotice;
