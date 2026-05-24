import { useEffect, useState } from "react";
import { objectSelectionObservable } from "../../../system/clientObservables";
import ObjectSelection from "../../../graphics/types/gizmo/objectSelection";
import CanvasEditOptions from "./canvasEditOptions";
import ObjectTypeConfigMap from "../../../../shared/object/maps/objectTypeConfigMap";
import CanvasDesc from "./canvasDesc";

const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");

export default function ObjectSelectionMenu({ canModifyRoom }: Props)
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
        return <div className="flex flex-col gap-1 p-2 max-w-full h-fit overflow-hidden">
            {typeIndex === canvasTypeIndex && canModifyRoom &&
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
    canModifyRoom: boolean;
}