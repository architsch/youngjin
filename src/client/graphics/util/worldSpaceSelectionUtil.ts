import { voxelQuadSelectionObservable } from "../../system/clientObservables";
import VoxelQuadSelection from "../types/gizmo/voxelQuadSelection";

export default class WorldSpaceSelectionUtil
{
    private static delayedUnselectTimeout: NodeJS.Timeout | undefined;

    static unselectAll()
    {
        VoxelQuadSelection.unselect();
    }

    static unselectionPending(): boolean
    {
        return this.delayedUnselectTimeout != undefined;
    }

    static unselectAllAfterDelay(delayInMillis: number)
    {
        this.cancelDelayedUnselectTimeout();
        this.delayedUnselectTimeout = setTimeout(this.unselectAll, delayInMillis);
    }

    static cancelDelayedUnselectTimeout()
    {
        if (this.delayedUnselectTimeout)
        {
            clearTimeout(this.delayedUnselectTimeout);
            this.delayedUnselectTimeout = undefined;
        }
    }
}

voxelQuadSelectionObservable.addListener("worldSpaceSelection", (selection: VoxelQuadSelection | null) => {
    if (selection)
    {
        WorldSpaceSelectionUtil.cancelDelayedUnselectTimeout();
    }
});