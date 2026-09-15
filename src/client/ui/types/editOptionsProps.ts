import ObjectSelection from "../../graphics/types/gizmo/objectSelection";

export default interface EditOptionsProps
{
    selection: ObjectSelection;
    // Held by ObjectSelectionMenu rather than the tools, so it stays open while the selection moves
    // between objects of one type.
    openPanel: string | null;
    setOpenPanel: (panel: string | null) => void;
}
