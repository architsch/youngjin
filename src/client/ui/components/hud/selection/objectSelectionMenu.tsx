import { useEffect, useState } from "react";
import { objectSelectionObservable } from "../../../../system/clientObservables";
import ObjectSelection from "../../../../graphics/types/gizmo/objectSelection";
import ObjectTypeClientConfigMap from "../../../../object/maps/objectTypeClientConfigMap";

// The tools for changing whatever the user currently has picked out. Which panel that is belongs to
// the kind of object rather than to this menu — a picture is given the tools a picture takes, a
// character the ones a character takes — so each kind names its own (see ObjectTypeClientConfig) and
// what is left here is the raising of it.
export default function ObjectSelectionMenu({ inEditMode }: Props)
{
    const [selection, setSelection] = useState<ObjectSelection | null>(null);

    useEffect(() => {
        objectSelectionObservable.addListener("ui.objectSelection", setSelection);
        return () => {
            objectSelectionObservable.removeListener("ui.objectSelection");
        };
    }, []);

    // The tools belong to edit mode alone: in play mode a selection is a way of looking at something
    // rather than of changing it.
    if (!selection || !inEditMode)
        return null;

    const EditOptions = ObjectTypeClientConfigMap.getConfigByIndex(
        selection.gameObject.params.objectTypeIndex).selection?.editOptions;
    if (!EditOptions)
        return null;

    return <div className="flex flex-col gap-1 p-2 max-w-full h-fit overflow-hidden relative z-10">
        {/* Keyed by the object, so that moving the selection from one object to another of the same
            kind builds the panel afresh rather than handing the new object to a panel still holding
            the old one's state. */}
        <EditOptions key={selection.gameObject.params.objectId} selection={selection}/>
    </div>;
}

interface Props
{
    // Whether the user is in edit mode, which is what the tools for changing the selected object
    // belong to.
    inEditMode: boolean;
}
