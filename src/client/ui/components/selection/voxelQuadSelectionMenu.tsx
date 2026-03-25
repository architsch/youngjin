import { useEffect, useState } from "react";
import { voxelQuadSelectionObservable } from "../../../system/clientObservables";
import VoxelQuadSelection from "../../../graphics/types/gizmo/voxelQuadSelection";
import VoxelQuadTextureOptions from "./voxelQuadTextureOptions";
import VoxelQuadTransformOptions from "./voxelQuadTransformOptions";
import VoxelQuadObjectOptions from "./voxelQuadObjectOptions";

export default function VoxelQuadSelectionMenu()
{
    const [state, setState] = useState<VoxelQuadSelectionState>({
        selection: null,
    });

    useEffect(() => {
        voxelQuadSelectionObservable.addListener("ui.voxelQuadSelection", selection => setState({selection}));
        return () => {
            voxelQuadSelectionObservable.removeListener("ui.voxelQuadSelection");
        };
    }, []);

    if (state.selection)
    {
        return <div className={className}>
            <VoxelQuadTransformOptions selection={state.selection}/>
            <VoxelQuadObjectOptions selection={state.selection}/>
            <VoxelQuadTextureOptions selection={state.selection}/>
        </div>;
    }
    else
        return null;
}

const className = "flex flex-col gap-1 p-2 max-w-full h-fit overflow-hidden";

interface VoxelQuadSelectionState
{
    selection: VoxelQuadSelection | null;
}