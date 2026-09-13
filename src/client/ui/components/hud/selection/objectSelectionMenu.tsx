import { useEffect, useState } from "react";
import { objectSelectionObservable } from "../../../../system/clientObservables";
import ObjectSelection from "../../../../graphics/types/gizmo/objectSelection";
import ObjectTypeClientConfigMap from "../../../../object/maps/objectTypeClientConfigMap";

// Raises the tool panel declared by the selected object's type (see ObjectTypeClientConfig).
export default function ObjectSelectionMenu({ inEditMode }: Props)
{
    // Read the selection on mount (it may have changed while hidden behind room settings, see
    // UIRoot), in the initial state so tools appear without a one-frame delay.
    const [selection, setSelection] = useState<ObjectSelection | null>(
        () => objectSelectionObservable.peek());

    useEffect(() => {
        objectSelectionObservable.addListener("ui.objectSelection", setSelection);
        return () => {
            objectSelectionObservable.removeListener("ui.objectSelection");
        };
    }, []);

    // Edit mode only.
    if (!selection || !inEditMode)
        return null;

    const EditOptions = ObjectTypeClientConfigMap.getConfigByIndex(
        selection.gameObject.params.objectTypeIndex).selection?.editOptions;
    if (!EditOptions)
        return null;

    return <div className="flex flex-col gap-1 p-2 max-w-full h-fit overflow-hidden relative z-10">
        {/* Keyed by object, so switching between objects of one type remounts the panel with fresh state. */}
        <EditOptions key={selection.gameObject.params.objectId} selection={selection}/>
    </div>;
}

interface Props
{
    inEditMode: boolean;
}
