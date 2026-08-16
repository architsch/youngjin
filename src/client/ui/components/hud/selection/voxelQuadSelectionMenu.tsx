import { useEffect, useState } from "react";
import { voxelQuadSelectionObservable } from "../../../../system/clientObservables";
import VoxelQuadSelection from "../../../../graphics/types/gizmo/voxelQuadSelection";
import VoxelQuadTextureOptions from "./voxelQuadTextureOptions";
import VoxelQuadPlacementOptions from "./voxelQuadPlacementOptions";

export default function VoxelQuadSelectionMenu()
{
    // These tools belong to edit mode and are put up only while it lasts, so this menu can come into
    // being onto a quad that was picked out before the mode began — which is what entering the mode
    // from a play-mode selection does. That selection announced itself back when it was made, long
    // before there was a menu here to hear it, so what is selected is read on the way in rather than
    // waited for: read in the first render rather than in an effect after it, so the menu arrives
    // with its contents instead of appearing empty for a frame and filling in on the next.
    const [state, setState] = useState<VoxelQuadSelectionState>(() => ({
        selection: voxelQuadSelectionObservable.peek(),
    }));

    useEffect(() => {
        voxelQuadSelectionObservable.addListener("ui.voxelQuadSelection", selection => setState({selection}));
        return () => {
            voxelQuadSelectionObservable.removeListener("ui.voxelQuadSelection");
        };
    }, []);

    if (state.selection)
    {
        return <div className="flex flex-col gap-1 p-2 max-w-full h-fit overflow-hidden">
            <VoxelQuadPlacementOptions selection={state.selection}/>
            <VoxelQuadTextureOptions selection={state.selection}/>
        </div>;
    }
    else
        return null;
}

interface VoxelQuadSelectionState
{
    selection: VoxelQuadSelection | null;
}