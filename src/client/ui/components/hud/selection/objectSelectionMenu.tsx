import { useEffect, useState } from "react";
import { objectSelectionObservable } from "../../../../system/clientObservables";
import ObjectSelection from "../../../../graphics/types/gizmo/objectSelection";
import CanvasEditOptions from "./canvasEditOptions";
import ObjectTypeConfigMap from "../../../../../shared/object/maps/objectTypeConfigMap";
import CanvasDesc from "./canvasDesc";

const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");

export default function ObjectSelectionMenu({ inEditMode }: Props)
{
    const [state, setState] = useState<ObjectSelectionState>({
        selection: null,
    });

    useEffect(() => {
        objectSelectionObservable.addListener("ui.objectSelection", selection => setState({selection}));
        return () => {
            objectSelectionObservable.removeListener("ui.objectSelection");
        };
    }, []);

    if (state.selection)
    {
        const typeIndex = state.selection.gameObject.params.objectTypeIndex;
        const objectId = state.selection.gameObject.params.objectId;
        return <div className="flex flex-col gap-1 p-2 max-w-full h-fit overflow-hidden relative z-10">
            {typeIndex === canvasTypeIndex && inEditMode &&
                <CanvasEditOptions key={`edit-${objectId}`} selection={state.selection}/>}
            {typeIndex === canvasTypeIndex &&
                <CanvasDesc key={`desc-${objectId}`} selection={state.selection}/>}
        </div>;
    }
    else
        return null;
}

interface ObjectSelectionState
{
    selection: ObjectSelection | null;
}

interface Props
{
    // Whether the user is in edit mode, which is what the tools for changing the selected object
    // belong to: in play mode a selection is a way of reading about something, not of editing it.
    inEditMode: boolean;
}