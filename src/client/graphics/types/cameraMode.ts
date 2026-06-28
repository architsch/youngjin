// "firstPerson": This is the normal mode. The camera sits at the player's eye and looks where the player
//      faces. The user's own body is hidden in this mode, so it never clips the camera.
// "selfView": The camera pulls up and out in front of the player and looks back at it, so the
//      user can see their own character (e.g. while customizing it).
type CameraMode = "firstPerson" | "selfView";

export default CameraMode;
