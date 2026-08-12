// Which of the game's modes the user is currently in. A mode is the whole arrangement the user is
// working under — what the camera does, what the player does, and which controls are on screen —
// rather than any one of those things, so everything that differs between them is decided from this
// one value (see GameModeUtil).
//
// "play": the ordinary state. The user walks the room in the first-person view, and clicking a block
//      or an object is a way of looking at it and reading about it, nothing more.
// "edit": entered deliberately, and left the same way. The camera orbits whatever is selected, the
//      player stands still, and the controls for changing that selection are on screen.
type GameMode = "play" | "edit";

export default GameMode;
