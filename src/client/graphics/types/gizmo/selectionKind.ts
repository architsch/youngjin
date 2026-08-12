// Which of the three world-space selections is meant, where one of them has to be named. Only one is
// ever active: picking anything replaces whatever was picked before (see WorldSpaceSelectionUtil).
type SelectionKind = "voxelQuad" | "object" | "player";

export default SelectionKind;
