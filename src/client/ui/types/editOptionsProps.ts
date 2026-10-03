import ObjectSelection from "../../graphics/types/gizmo/objectSelection";
import { EditPanel } from "./editPanel";

export default interface EditOptionsProps
{
    selection: ObjectSelection;
    // Held by ObjectSelectionMenu rather than the tools, so it stays open while the selection moves to any
    // object whose type declares the same panel (see ObjectTypeClientConfig).
    openPanel: EditPanel | null;
    setOpenPanel: (panel: EditPanel | null) => void;
    // The open panel is the one the object was just added with (see ObjectTypeClientConfig.installPanel): nothing in
    // it shows as picked yet, and a pick closes it and moves the selection to a face near the object (unless
    // DISABLE_AUTO_SELECTION_ON_OBJECT_INSTALLATION).
    installing: boolean;
}
