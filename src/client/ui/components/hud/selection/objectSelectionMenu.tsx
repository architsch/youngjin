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
        installing: boolean}>(() => ({
            selection: objectSelectionObservable.peek(), openPanel: null, installing: false,
        }));

    useEffect(() => {
        objectSelectionObservable.addListener("ui.objectSelection", selection => setState(prev => {
            // Moving to an object whose tools offer the same sub-panel keeps it open, unless it was raised for the
            // object just added; any other change closes it.
            const sameObject = selection?.gameObject === prev.selection?.gameObject;
            const keepsPanel = prev.installing ? sameObject : offersPanel(selection, prev.openPanel);
            return {selection, openPanel: keepsPanel ? prev.openPanel : null,
                installing: prev.installing && sameObject};
        }));
        objectInstalledObservable.addListener("ui.objectSelection", objectId => setState(prev => {
            const params = prev.selection?.gameObject.params;
            const installPanel = (params?.objectId == objectId)
                ? ObjectTypeClientConfigMap.getConfigByIndex(params.objectTypeIndex).selection?.installPanel
                : undefined;
            return installPanel ? {...prev, openPanel: installPanel, installing: true} : prev;
        }));
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
        {/* Keyed by object, so each object's tools start fresh; only the open sub-panel carries over. */}
        <EditOptions key={selection.gameObject.params.objectId} selection={selection}
            openPanel={state.openPanel}
            // The tools' own choice of panel ends what was raised for the object just added.
            setOpenPanel={openPanel => setState(prev => ({...prev, openPanel, installing: false}))}
            installing={state.installing}
        />
    </div>;
}

function offersPanel(selection: ObjectSelection | null, panel: EditPanel | null): boolean
{
    if (!selection || !panel)
        return false;
    const editPanels = ObjectTypeClientConfigMap.getConfigByIndex(
        selection.gameObject.params.objectTypeIndex).selection?.editPanels;
    return editPanels != undefined && editPanels.includes(panel);
}

interface Props
{
    inEditMode: boolean;
}
