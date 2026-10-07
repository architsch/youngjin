import { useEffect, useState } from "react";
import { objectInstalledObservable, objectSelectionObservable } from "../../../../system/clientObservables";
import { SUB_PANELS_BENEATH_SELECTION_TOOLS } from "../../../../system/clientConstants";
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
        objectSelectionObservable.addListener("ui.objectSelection", selection => setState(prev => {
            const sameObject = selection?.gameObject === prev.selection?.gameObject;
            // A panel raised in the tools' place for the object just added doesn't go on to another object.
            const shown = (SUB_PANELS_BENEATH_SELECTION_TOOLS || !prev.installing || sameObject)
                ? prev.openPanel : null;
            return {selection, openPanel: getOpenPanel(selection, shown), installing: prev.installing && sameObject};
        }));
        objectInstalledObservable.addListener("ui.objectSelection", objectId => setState(prev => {
            const params = prev.selection?.gameObject.params;
            if (params?.objectId != objectId)
                return prev;
            // The type's install panel is raised, if it has one: beneath the tools as any other of its panels. With
            // none, the panel already showing there carries on from the chooser.
            const installPanel = ObjectTypeClientConfigMap.getConfigByIndex(params.objectTypeIndex)
                .selection?.installPanel;
            if (SUB_PANELS_BENEATH_SELECTION_TOOLS)
                return installPanel ? {...prev, openPanel: installPanel} : {...prev, installing: true};
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
            // The tools' own choice of another panel ends what was raised, or carried on, for the object just added.
            setOpenPanel={openPanel => setState(prev => (openPanel == prev.openPanel) ? prev
                : {...prev, openPanel, installing: false})}
            installing={!SUB_PANELS_BENEATH_SELECTION_TOOLS && state.installing}
            resumed={SUB_PANELS_BENEATH_SELECTION_TOOLS && state.installing}
        />
    </div>;
}

// The sub-panel an object's tools show: the one already open if its type offers that too. Failing that, its type's
// first where panels show beneath the tools, and none where they take the tools' place.
function getOpenPanel(selection: ObjectSelection | null, shown: EditPanel | null): EditPanel | null
{
    if (!selection)
        return null;
    const editPanels = ObjectTypeClientConfigMap.getConfigByIndex(
        selection.gameObject.params.objectTypeIndex).selection?.editPanels ?? [];
    if (shown != null && editPanels.includes(shown))
        return shown;
    return SUB_PANELS_BENEATH_SELECTION_TOOLS ? editPanels[0] ?? null : null;
}

interface Props
{
    inEditMode: boolean;
}
