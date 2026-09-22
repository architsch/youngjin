import Vec3 from "../../math/types/vec3";

// How far a type may be resized, and in what increments. A type without one is fixed at unit scale
// (see ObjectScaleUtil, which snaps every stored scale onto this grid before anything reads it).
export type ObjectScalingConfig = {
    scaleStep: Vec3,
    minScale: Vec3,
    maxScale: Vec3,
};
