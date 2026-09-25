import ObjectSelection from "../../graphics/types/gizmo/objectSelection";
import { EditPanel } from "./editPanel";

export default interface EditOptionsProps
{
    selection: ObjectSelection;
    // Held by ObjectSelectionMenu rather than the tools, so it stays open while the selection moves to any
    // object whose type declares the same panel (see ObjectTypeClientConfig).
    openPanel: EditPanel | null;
    setOpenPanel: (panel: EditPanel | null) => void;
}
