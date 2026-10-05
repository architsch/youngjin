import ObjectSelection from "../../graphics/types/gizmo/objectSelection";
import { EditPanel } from "./editPanel";

export default interface EditOptionsProps
{
    selection: ObjectSelection;
    // The one of the type's sub-panels shown beneath the tools, or null for a type that declares none (see
    // ObjectTypeClientConfig). Held by ObjectSelectionMenu rather than the tools, so it stays up while the selection
    // moves to any object whose type declares the same panel.
    openPanel: EditPanel | null;
    setOpenPanel: (panel: EditPanel) => void;
    // The object was just added from the chooser the open panel shows (see VoxelQuadPlacementOptions), which the panel
    // carries on from where it was left. Ends once the tools show another panel, or another object is selected.
    installing: boolean;
}
