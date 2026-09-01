import AABB3 from "../../../shared/math/types/aabb3";

// "firstPerson": This is the normal mode. The camera sits at the player's eye and looks where the player
//      faces. The user's own body is hidden in this mode, so it never clips the camera.
// "orbit": An inspection mode. The camera pulls back from a target volume anywhere in the room and
//      looks right at it, orbiting around it as the user drags, so the target can be seen from any
//      angle (e.g. the user's own character while it is being customized, or whatever the user has
//      currently selected).
//      The target is carried by the mode itself rather than published on its own, so the camera can
//      never be left orbiting around something other than what it was pointed at. It is given as a
//      volume rather than a point because the camera has to frame the whole of it, and keep the
//      whole of it in sight: its center is what the camera orbits around, and its extent is what
//      decides how far back the camera sits and how wide a path is cleared toward it.
//      A caller that wants its target seen in context, rather than merely seen, can ask for a
//      minimum distance of its own: framing by size alone answers "how big does this look", which
//      is the wrong question for something small that is being edited in place, where what
//      surrounds it matters as much as it does. Left out, the size decides the distance by itself.
// "free": A special mode in which the camera is completely free to locate itself anywhere and view
//      anything in any direction. Instant teleporation is fully allowed as well, since the camera in
//      this mode is neither bound to the player nor a voxel/object selection.
//      You can use this mode to let the camera follow a cinematic cutscene or set up a unique view
//      for capturing an in-game screenshot from an unconventional angle.
type CameraMode =
    | {type: "firstPerson"}
    | {type: "orbit", target: AABB3, minDistance?: number}
    | {type: "free"};

export default CameraMode;
