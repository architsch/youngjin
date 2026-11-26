import { useEffect, useMemo, useState } from "react";
import { playModeSelectionObservable } from "../../../../system/clientObservables";
import ObjectSelection from "../../../../graphics/types/gizmo/objectSelection";
import GameObject from "../../../../object/types/gameObject/gameObject";
import ObjectTypeClientConfigMap from "../../../../object/maps/objectTypeClientConfigMap";

const LISTENER_KEY = "ui.playModeSelection";

// The tools of the object selected in play mode (see PlayModeSelectionUtil), where the chat input otherwise is: its
// type's own, as edit mode shows them, without their sub-panels.
export default function PlayModeSelectionMenu()
{
    const [gameObject, setGameObject] = useState<GameObject | null>(() => playModeSelectionObservable.peek());

    useEffect(() => {
        playModeSelectionObservable.addListener(LISTENER_KEY, selected => setGameObject(selected));
        return () => playModeSelectionObservable.removeListener(LISTENER_KEY);
    }, []);

    // The tools take a selection, as edit mode's are given.
    const selection = useMemo(() => (gameObject == null) ? null : new ObjectSelection(gameObject), [gameObject]);
    const EditOptions = (gameObject == null) ? undefined : ObjectTypeClientConfigMap.getConfigByIndex(
        gameObject.params.objectTypeIndex).selection?.editOptions;
    if (selection == null || EditOptions == undefined)
        return null;

    return <div className="flex flex-col gap-1 p-2 max-w-full h-fit overflow-hidden relative z-10">
        <EditOptions key={selection.gameObject.params.objectId} selection={selection} openPanel={null}
            setOpenPanel={() => {}} installing={false} resumed={false}/>
    </div>;
}
