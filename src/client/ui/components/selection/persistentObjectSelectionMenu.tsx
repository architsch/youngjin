import { useEffect, useState } from "react";
import { persistentObjectSelectionObservable } from "../../../system/clientObservables";
import PersistentObjectSelection from "../../../graphics/types/gizmo/persistentObjectSelection";
import CanvasSelectionOptions from "./canvasSelectionOptions";
import DoorSelectionOptions from "./doorSelectionOptions";
import ObjectTypeConfigMap from "../../../../shared/object/maps/objectTypeConfigMap";

const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");
const doorTypeIndex = ObjectTypeConfigMap.getIndexByType("Door");

export default function PersistentObjectSelectionMenu()
{
    const [state, setState] = useState<PersistentObjectSelectionState>({
        selection: null,
    });

    useEffect(() => {
        persistentObjectSelectionObservable.addListener("ui.persistentObjectSelection", selection => setState({selection}));
        return () => {
            persistentObjectSelectionObservable.removeListener("ui.persistentObjectSelection");
        };
    }, []);

    if (state.selection)
    {
        const typeIndex = state.selection.gameObject.params.objectTypeIndex;
        const objectId = state.selection.gameObject.params.objectId;
        return <div className={className}>
            {typeIndex === canvasTypeIndex && <CanvasSelectionOptions key={objectId} selection={state.selection}/>}
            {typeIndex === doorTypeIndex && <DoorSelectionOptions key={objectId} selection={state.selection}/>}
        </div>;
    }
    else
        return null;
}

const className = "flex flex-col gap-1 p-2 max-w-full h-fit overflow-hidden";

interface PersistentObjectSelectionState
{
    selection: PersistentObjectSelection | null;
}
