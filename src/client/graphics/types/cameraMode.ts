import AABB3 from "../../../shared/math/types/aabb3";

// "firstPerson": camera at the player's eye (own body hidden).
// "orbit": camera orbits a target volume; its center is the pivot and its extent sets framing
//      distance and how much must be cleared from view. The target travels with the mode so the
//      camera can't orbit something stale. minDistance frames small in-place edits with context.
// "free": unbound camera that may teleport anywhere (cutscenes, the sandbox).
type CameraMode =
    | {type: "firstPerson"}
    | {type: "orbit", target: AABB3, minDistance?: number}
    | {type: "free"};

export default CameraMode;
