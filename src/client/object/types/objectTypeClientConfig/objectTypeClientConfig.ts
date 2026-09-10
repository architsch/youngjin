import { ComponentType } from "react";
import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import Room from "../../../../shared/room/types/room";
import User from "../../../../shared/user/types/user";
import GameObject from "../gameObject";
import ObjectSelection from "../../../graphics/types/gizmo/objectSelection";

// Everything about a kind of GameObject that only the client has any use for: how one is built, and
// what the user picking one out amounts to.
//
// The shared ObjectTypeConfig is the other half of this — what a kind of object *is*, which the
// server reads too. What is declared here is drawn, clicked and put on screen, and means nothing off
// the client, so it is kept off the shared config rather than dragged onto the server's compile path
// along with React and Three.js.
export default interface ObjectTypeClientConfig
{
    construct: (params: AddObjectSignal) => GameObject;

    selection?: { // If this field is present, the object must be selectable (as long as the necessary conditions are met).
        canBeSelectedByUser: (gameObject: GameObject, user: User, room: Room) => boolean;
        editOptions?: ComponentType<{selection: ObjectSelection}>;
        showMoveGizmos?: boolean;
    };
}
