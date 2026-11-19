import { ComponentType } from "react";
import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import Room from "../../../../shared/room/types/room";
import User from "../../../../shared/user/types/user";
import GameObject from "../gameObject/gameObject";
import EditOptionsProps from "../../../ui/types/editOptionsProps";
import { EditPanel } from "../../../ui/types/editPanel";

// Client-only per-type config (construction and selection behavior). Kept out of the shared
// ObjectTypeConfig so the server doesn't compile React/three.js.
export default interface ObjectTypeClientConfig
{
    construct: (params: AddObjectSignal) => GameObject;

    selection?: { // If this field is present, the object must be selectable (as long as the necessary conditions are met).
        canBeSelectedByUserInEditMode: (gameObject: GameObject, user: User, room: Room) => boolean;
        editOptions?: ComponentType<EditOptionsProps>;
        // The sub-panels editOptions can raise, one at a time. Shown beneath its tools, they open on the first (see
        // SUB_PANELS_BENEATH_SELECTION_TOOLS).
        editPanels?: EditPanel[];
        // One of editPanels, which the tools of an object just added from a selected face open on: what is left to
        // pick of its look after what was picked before adding it (see VoxelQuadPlacementOptions). It keeps the object
        // selected until that pick only where a sub-panel takes the tools' place: otherwise, as with none, the object
        // is complete as added, and isn't selected (unless DISABLE_AUTO_SELECTION_ON_OBJECT_INSTALLATION).
        installPanel?: EditPanel;
        // Whether the type outlines itself, and is selected only by a control it shows for that (see
        // VolumeGameObject): the selection's outline is left off it, and no key step leads onto it. Absent, it isn't.
        selectedByOwnControl?: boolean;
    };
}
