import ObjectSelection from "../../graphics/types/gizmo/objectSelection";
import { EditPanel } from "./editPanel";

export default interface EditOptionsProps
{
    selection: ObjectSelection;
    // The sub-panel the tools show: beneath them, always one where their type declares any, or in their place until
    // it is closed (see SUB_PANELS_BENEATH_SELECTION_TOOLS). Held by ObjectSelectionMenu rather than the tools, so it
    // stays open while the selection moves to any object whose type declares the same panel (see
    // ObjectTypeClientConfig).
    openPanel: EditPanel | null;
    setOpenPanel: (panel: EditPanel | null) => void;
    // In the tools' place only. The open panel is the one the object was just added with (see
    // ObjectTypeClientConfig.installPanel): nothing in it shows as picked yet, and a pick closes it and moves the
    // selection to a face near the object (unless DISABLE_AUTO_SELECTION_ON_OBJECT_INSTALLATION).
    installing: boolean;
    // Beneath the tools only. The object was just added from the chooser the open panel shows (see
    // VoxelQuadPlacementOptions), which the panel carries on from where it was left. Ends once the tools show another
    // panel, or another object is selected.
    resumed: boolean;
}
