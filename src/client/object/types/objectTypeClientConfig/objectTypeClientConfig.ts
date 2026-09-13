import { ComponentType } from "react";
import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import Room from "../../../../shared/room/types/room";
import User from "../../../../shared/user/types/user";
import GameObject from "../gameObject";
import ObjectSelection from "../../../graphics/types/gizmo/objectSelection";

// Client-only per-type config (construction and selection behavior). Kept out of the shared
// ObjectTypeConfig so the server doesn't compile React/three.js.
export default interface ObjectTypeClientConfig
{
    construct: (params: AddObjectSignal) => GameObject;

    selection?: { // If this field is present, the object must be selectable (as long as the necessary conditions are met).
        canBeSelectedByUserInEditMode: (gameObject: GameObject, user: User, room: Room) => boolean;
        editOptions?: ComponentType<{selection: ObjectSelection}>;
        showMoveGizmos?: boolean;
    };
}
