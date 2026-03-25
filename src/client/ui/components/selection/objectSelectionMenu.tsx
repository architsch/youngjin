import { useEffect, useState } from "react";
import { objectSelectionObservable } from "../../../system/clientObservables";
import ObjectSelection from "../../../graphics/types/gizmo/objectSelection";
import CanvasSelectionOptions from "./canvasSelectionOptions";
import ObjectTypeConfigMap from "../../../../shared/object/maps/objectTypeConfigMap";

const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");

export default function ObjectSelectionMenu()
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
        return <div className={className}>
            {typeIndex === canvasTypeIndex && <CanvasSelectionOptions key={objectId} selection={state.selection}/>}
        </div>;
    }
    else
        return null;
}

const className = "flex flex-col gap-1 p-2 max-w-full h-fit overflow-hidden";

interface ObjectSelectionState
{
    selection: ObjectSelection | null;
}
