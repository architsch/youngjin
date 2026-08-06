import { useEffect, useReducer } from "react";
import ObjectSelection from "../../../../graphics/types/gizmo/objectSelection";
import VoxelQuadSelection from "../../../../graphics/types/gizmo/voxelQuadSelection";
import WorldSpaceSelectionUtil from "../../../../graphics/util/worldSpaceSelectionUtil";
import { clientFeatureFlagsObservable, objectSelectionObservable,
    voxelQuadSelectionObservable } from "../../../../system/clientObservables";
import { FeatureFlag } from "../../../../../shared/system/types/featureFlag";
import Button from "../../input/button";
import PopupUtil from "../../../util/popupUtil";

// Feature flags whose toggling changes whether the current selection can be dropped at all.
const selectionFeatureFlags = [
    FeatureFlag.DisableAllSelectionChange,
    FeatureFlag.DisableVoxelQuadSelectionChange,
    FeatureFlag.DisableObjectSelectionChange,
];

//------------------------------------------------------------------------
// A few of the things the user can do are not panels but modes: the screen is given over to them,
// and the user stays inside one until he/she leaves it. A world-space selection is one — the camera
// goes into an orbit around what was selected and the player stops answering — and customizing the
// player is another, which does the same in order to hold the character in frame. What they have in
// common is the thing that matters here: normal play is suspended, and there has to be a way back
// to it that no one can miss.
//
// This bar is that way back. For as long as a mode is up it holds the top edge of the screen in
// place of the identity and room controls that normally live there, and it puts its single button
// at the right-hand end of that edge, where those controls sit and where the eye already goes
// looking for them.
//
// It draws no band of its own behind that button. The top edge is shared with the headline, which
// carries the single-player tutorial's instructions and takes the full width whenever it has
// something to say, so a band up there would be covered by the instruction or cover it. The bar
// keeps nothing but the button, and hangs it below whatever height the headline currently reaches —
// which is what lets a step tell the user something and offer the way out of the mode at once.
//------------------------------------------------------------------------

export default function ModeExitBar({ canModifyRoom, isCustomizingPlayer }: Props)
{
    const [, forceRefresh] = useReducer((x: number) => x + 1, 0);

    useEffect(() => {
        voxelQuadSelectionObservable.addListener("ui.modeExitBar", forceRefresh);
        objectSelectionObservable.addListener("ui.modeExitBar", forceRefresh);
        for (const flag of selectionFeatureFlags)
            clientFeatureFlagsObservable.addElementListener("ui.modeExitBar", flag, forceRefresh);
        return () => {
            voxelQuadSelectionObservable.removeListener("ui.modeExitBar");
            objectSelectionObservable.removeListener("ui.modeExitBar");
            for (const flag of selectionFeatureFlags)
                clientFeatureFlagsObservable.removeElementListener("ui.modeExitBar", flag);
        };
    }, []);

    // Player customization is asked about first, since it drops every selection on the way in and
    // holds selection-making down for as long as it is open — so by the time it is up, there is
    // never a selection left for the branch below to find.
    //
    // "Editing" is what a selection means to a user who may edit the room, so the way out is named
    // for the mode being left rather than for the selection standing behind it. To everyone else it
    // is only a selection. Customization ends with neither: nothing is being left behind, only
    // finished with.
    const exit = isCustomizingPlayer
        ? { name: "Done", onClick: PopupUtil.closePopup }
        : selectionCanBeDropped()
            ? {
                name: canModifyRoom ? "Exit Edit-Mode" : "Exit Selection",
                onClick: () => WorldSpaceSelectionUtil.unselectAll(),
            }
            : undefined;

    if (exit == undefined)
        return null;

    return <div className={barClassName}>
        <Button id="modeExitButton" name={exit.name} size="md" color="green" onClick={exit.onClick}/>
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

// Hangs from the lower edge of the headline, via the height the headline publishes for exactly this
// purpose, and falls back to the top of the screen for the ordinary case of no headline being up.
// Nothing here is drawn or pressable but the button itself: the bar spans the full width only so
// that the button can be held against the right edge, and being invisible it must let a press
// landing beside the button reach the 3D scene underneath rather than swallow it. No stacking order
// is claimed, which leaves the bar behind both the things sharing the top of the screen with it:
// the headline, which raises itself above everything, and the debugger, which is drawn after it.
const barClassName = "absolute top-[var(--yj-headline-height,0px)] left-0 w-full flex justify-end p-2 pointer-events-none";

interface Props
{
    canModifyRoom: boolean;
    // Whether the player-customization form is the mode currently holding the screen.
    isCustomizingPlayer: boolean;
}
