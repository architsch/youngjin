import { useEffect, useState } from "react";
import { voxelQuadSelectionObservable } from "../../../system/observables";
import VoxelQuadSelection from "../../../graphics/types/gizmo/voxelQuadSelection";

export default function VoxelQuadSelectionMenu()
{
    const [selection, setSelection] = useState<VoxelQuadSelection | null>(null);

    useEffect(() => {
        voxelQuadSelectionObservable.addListener("ui.voxelQuadSelection", v => setSelection(v));
        return () => {
            voxelQuadSelectionObservable.removeListener("ui.voxelQuadSelection");
        };
    }, []);

    if (selection)
    {
        return <div style={{position:"absolute", zIndex:9999, width:"2rem", height:"2rem", right:0, top:0, backgroundColor:"magenta"}}>
        </div>;
    }
    else
    {
        return null;
    }
}

interface LoadingState
{
    loading: boolean;
}