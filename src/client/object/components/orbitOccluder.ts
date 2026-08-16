import GameObjectComponent from "./gameObjectComponent";

// Declares that the object carrying this belongs to the room's fabric as far as the orbit camera is
// concerned: something the camera may take out of sight for as long as it stands between itself and
// what it is framing, and put back once it no longer does (see OrbitOcclusionHider).
//
// The declaration is what makes an opening in the room read as an opening. A wall, a door, or a
// picture on a wall is scenery — take a piece of it away and the user sees the room being opened up
// for him, which is the whole of what the mode promises. A character is not scenery: he is somebody,
// standing where he chose to stand, and taking him away reads as the person having left rather than
// as the view having cleared — all the more so for the user's own body, which would vanish from
// under the very camera framing the room around it. So a character stays where he is and is seen
// through instead, by whatever the room gives up around him. His body answers to rules of his own in
// any case (the view he is seen in, another player standing too close), and those are the only
// rules deciding whether he is on show.
//
// The component carries no behaviour of its own: what it is for is to be found on an object, or not
// found there, which is all the orbit needs in order to tell the two apart.
export default class OrbitOccluder extends GameObjectComponent
{
}
