import { objectSelectionObservable, voxelQuadSelectionObservable } from "../../system/clientObservables";
import ObjectSelection from "../types/gizmo/objectSelection";
import VoxelQuadSelection from "../types/gizmo/voxelQuadSelection";

export default class WorldSpaceSelectionUtil
{
    private static delayedUnselectTimeout: NodeJS.Timeout | undefined;

    static isAnythingSelected(): boolean
    {
        return VoxelQuadSelection.isSelected() || ObjectSelection.isSelected();
    }

    static unselectAll()
    {
        VoxelQuadSelection.unselect();
        ObjectSelection.unselect();
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

// If the previous selection was about to be unselected but then a new selection was made,
// discard the pending unselection routine (because the previous selection became irrelevant).
voxelQuadSelectionObservable.addListener("worldSpaceSelectionUtil", (selection: VoxelQuadSelection | null) => {
    if (selection)
    {
        WorldSpaceSelectionUtil.cancelDelayedUnselectTimeout();
    }
});
objectSelectionObservable.addListener("worldSpaceSelectionUtil", (selection: ObjectSelection | null) => {
    if (selection)
    {
        WorldSpaceSelectionUtil.cancelDelayedUnselectTimeout();
    }
});