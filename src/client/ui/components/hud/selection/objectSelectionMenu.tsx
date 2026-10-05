import { useEffect, useState } from "react";
import { objectInstalledObservable, objectSelectionObservable } from "../../../../system/clientObservables";
import ObjectSelection from "../../../../graphics/types/gizmo/objectSelection";
import ObjectTypeClientConfigMap from "../../../../object/maps/objectTypeClientConfigMap";
import { EditPanel } from "../../../types/editPanel";

// Raises the tool panel declared by the selected object's type (see ObjectTypeClientConfig).
export default function ObjectSelectionMenu({ inEditMode }: Props)
{
    // Read the selection on mount (it may have changed while hidden behind room settings, see
    // UIRoot), in the initial state so tools appear without a one-frame delay.
    const [state, setState] = useState<{selection: ObjectSelection | null, openPanel: EditPanel | null,
        installing: boolean}>(() => {
            const selection = objectSelectionObservable.peek();
            return {selection, openPanel: getOpenPanel(selection, null), installing: false};
        });

    useEffect(() => {
        objectSelectionObservable.addListener("ui.objectSelection", selection => setState(prev => ({
            selection,
            openPanel: getOpenPanel(selection, prev.openPanel),
            installing: prev.installing && selection?.gameObject === prev.selection?.gameObject,
        })));
        objectInstalledObservable.addListener("ui.objectSelection", objectId => setState(prev =>
            (prev.selection?.gameObject.params.objectId == objectId) ? {...prev, installing: true} : prev));
        return () => {
            objectSelectionObservable.removeListener("ui.objectSelection");
            objectInstalledObservable.removeListener("ui.objectSelection");
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
        {/* Keyed by object, so each object's tools start fresh; only the sub-panel shown carries over. */}
        <EditOptions key={selection.gameObject.params.objectId} selection={selection}
            openPanel={state.openPanel}
            // The tools' own choice of another panel ends what the object just added carried on from.
            setOpenPanel={openPanel => setState(prev => (openPanel == prev.openPanel) ? prev
                : {...prev, openPanel, installing: false})}
            installing={state.installing}
        />
    </div>;
}

// The sub-panel an object's tools show: the one already up if its type offers that too, or else its type's first.
function getOpenPanel(selection: ObjectSelection | null, shown: EditPanel | null): EditPanel | null
{
    if (!selection)
        return null;
    const editPanels = ObjectTypeClientConfigMap.getConfigByIndex(
        selection.gameObject.params.objectTypeIndex).selection?.editPanels ?? [];
    return (shown != null && editPanels.includes(shown)) ? shown : editPanels[0] ?? null;
}

interface Props
{
    inEditMode: boolean;
}
