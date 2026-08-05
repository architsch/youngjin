import { useEffect, useReducer } from "react";
import ObjectSelection from "../../../../graphics/types/gizmo/objectSelection";
import VoxelQuadSelection from "../../../../graphics/types/gizmo/voxelQuadSelection";
import WorldSpaceSelectionUtil from "../../../../graphics/util/worldSpaceSelectionUtil";
import { clientFeatureFlagsObservable, objectSelectionObservable,
    voxelQuadSelectionObservable } from "../../../../system/clientObservables";
import { FeatureFlag } from "../../../../../shared/system/types/featureFlag";

// Feature flags whose toggling changes whether the current selection can be dropped at all.
const selectionFeatureFlags = [
    FeatureFlag.DisableAllSelectionChange,
    FeatureFlag.DisableVoxelQuadSelectionChange,
    FeatureFlag.DisableObjectSelectionChange,
];

//------------------------------------------------------------------------
// Lets the user put the current selection down — which, for a user who may edit the room, is also
// what gives him back the first-person view and the run of the room, since the camera orbits
// whatever is selected for as long as something is.
//
// It takes over the whole top bar for as long as it is up, in place of the identity and room
// controls that normally live there: a selection is a mode the user is in, and a bar spanning the
// screen says so — and gives the way out of it a target no one can miss on a small screen.
//------------------------------------------------------------------------

export default function SelectionCloseButton({ canModifyRoom }: Props)
{
    const [, forceRefresh] = useReducer((x: number) => x + 1, 0);

    useEffect(() => {
        voxelQuadSelectionObservable.addListener("ui.selectionCloseButton", forceRefresh);
        objectSelectionObservable.addListener("ui.selectionCloseButton", forceRefresh);
        for (const flag of selectionFeatureFlags)
            clientFeatureFlagsObservable.addElementListener("ui.selectionCloseButton", flag, forceRefresh);
        return () => {
            voxelQuadSelectionObservable.removeListener("ui.selectionCloseButton");
            objectSelectionObservable.removeListener("ui.selectionCloseButton");
            for (const flag of selectionFeatureFlags)
                clientFeatureFlagsObservable.removeElementListener("ui.selectionCloseButton", flag);
        };
    }, []);

    if (!selectionCanBeDropped())
        return null;

    // Editing is what a selection means to a user who may edit the room — the camera has gone into
    // an orbit and the player has stopped answering — so the way out is named for the mode being
    // left, not for the selection that stands behind it. To everyone else it is only a selection.
    return <div id="closeSelectionButton" className={className}
        onClick={() => WorldSpaceSelectionUtil.unselectAll()}
    >
        {canModifyRoom ? "Exit Edit-Mode" : "Exit Selection"}
    </div>;
}

// Whether there is a selection to drop and the user is free to drop it. A single-player step may be
// holding a selection in place on purpose, and a button that would do nothing when pressed is worse
// than no button at all.
function selectionCanBeDropped(): boolean
{
    if (clientFeatureFlagsObservable.has(FeatureFlag.DisableAllSelectionChange))
        return false;
    if (VoxelQuadSelection.isSelected() &&
        !clientFeatureFlagsObservable.has(FeatureFlag.DisableVoxelQuadSelectionChange))
    {
        return true;
    }
    return ObjectSelection.isSelected() &&
        !clientFeatureFlagsObservable.has(FeatureFlag.DisableObjectSelectionChange);
}

// Spans the top edge of the screen, wearing the raised look kept for a button of that shape (see
// `yj-bar-convex`), since a bar of text across the top of a screen is otherwise read as a caption
// and never pressed. Its height is a comfortable target for a thumb, and about what the top bar it
// stands in for occupied. No stacking order is claimed here, which leaves the bar behind both the
// things that share the top edge with it: the headline, which raises itself above everything and
// lets clicks through to whatever it covers, and the debugger, which is simply drawn after it.
const className = "absolute top-0 left-0 w-full h-11 flex items-center justify-center " +
    "text-base font-semibold yj-bar-convex cursor-pointer select-none touch-manipulation";

interface Props
{
    canModifyRoom: boolean;
}
