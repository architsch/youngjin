import { useEffect, useState } from "react";
import { objectSelectionObservable } from "../../../../system/clientObservables";
import ObjectSelection from "../../../../graphics/types/gizmo/objectSelection";
import ObjectTypeClientConfigMap from "../../../../object/maps/objectTypeClientConfigMap";

// Raises the tool panel declared by the selected object's type (see ObjectTypeClientConfig).
export default function ObjectSelectionMenu({ inEditMode }: Props)
{
    // Read the selection on mount (it may have changed while hidden behind room settings, see
    // UIRoot), in the initial state so tools appear without a one-frame delay.
    const [state, setState] = useState<{selection: ObjectSelection | null, openPanel: string | null}>(
        () => ({selection: objectSelectionObservable.peek(), openPanel: null}));

    useEffect(() => {
        objectSelectionObservable.addListener("ui.objectSelection", selection => setState(prev => ({
            selection,
            // Moving to another object of the same type keeps its sub-panel open; any other change closes it.
            openPanel: isSameObjectType(prev.selection, selection) ? prev.openPanel : null,
        })));
        return () => {
            objectSelectionObservable.removeListener("ui.objectSelection");
        };
    }, []);

    // Edit mode only.
    const selection = state.selection;
    if (!selection || !inEditMode)
        return null;

    const EditOptions = ObjectTypeClientConfigMap.getConfigByIndex(
        selection.gameObject.params.objectTypeIndex).selection?.editOptions;
    if (!EditOptions)
        return null;

    return <div className="flex flex-col gap-1 p-2 max-w-full h-fit overflow-hidden relative z-10">
        {/* Keyed by object, so each object's tools start fresh; only the open sub-panel carries over. */}
        <EditOptions key={selection.gameObject.params.objectId} selection={selection}
            openPanel={state.openPanel}
            setOpenPanel={openPanel => setState(prev => ({...prev, openPanel}))}
        />
    </div>;
}

function isSameObjectType(a: ObjectSelection | null, b: ObjectSelection | null): boolean
{
    return a != null && b != null &&
        a.gameObject.params.objectTypeIndex == b.gameObject.params.objectTypeIndex;
}

interface Props
{
    inEditMode: boolean;
}
