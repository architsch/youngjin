import { useEffect, useReducer } from "react";
import ObjectSelection from "../../../../graphics/types/gizmo/objectSelection";
import PlayerSelection from "../../../../graphics/types/gizmo/playerSelection";
import VoxelQuadSelection from "../../../../graphics/types/gizmo/voxelQuadSelection";
import WorldSpaceSelectionUtil from "../../../../graphics/util/worldSpaceSelectionUtil";
import GameModeUtil from "../../../../system/util/gameModeUtil";
import { cameraModeObservable, clientFeatureFlagsObservable, gameModeObservable,
    objectSelectionObservable, playerSelectionObservable,
    voxelQuadSelectionObservable } from "../../../../system/clientObservables";
import { FeatureFlag } from "../../../../../shared/system/types/featureFlag";
import Button from "../../input/button";
import CameraZoomSlider from "./cameraZoomSlider";

// Feature flags whose toggling changes whether the way out is offered at all.
const exitFeatureFlags = [
    FeatureFlag.DisableAllSelectionChange,
    FeatureFlag.DisableVoxelQuadSelectionChange,
    FeatureFlag.DisableObjectSelectionChange,
    FeatureFlag.DisablePlayerSelectionChange,
    FeatureFlag.HideModeExitButton,
];

//------------------------------------------------------------------------
// A couple of the things the user can do are not panels but modes: the screen is given over to
// them, and the user stays inside one until he/she leaves it. Edit mode is one — the camera goes
// into an orbit around whatever is selected and the player stops answering — and a selection made
// during play mode is a lesser one, which takes the camera's attention if not its place. What they
// have in common is the thing that matters here: ordinary play is suspended, and there has to be a
// way back to it that no one can miss.
//
// This bar is that way back. For as long as a mode is up it holds the top edge of the screen in
// place of the identity and room controls that normally live there, and it puts the button that
// ends the mode at the right-hand end of that edge, where those controls sit and where the eye
// already goes looking for them. Beside it, on its left, sits the zoom control — which belongs
// here for the same reason: both are about the mode itself rather than about anything in it, and
// both are only ever wanted while one is up.
//
// It draws no band of its own behind them. The top edge is shared with the headline, which carries
// the single-player tutorial's instructions and takes the full width whenever it has something to
// say, so a band up there would be covered by the instruction or cover it. The bar keeps nothing
// but its controls, each carrying its own surface, and hangs them below whatever height the
// headline currently reaches — which is what lets a step tell the user something and offer the way
// out of the mode at once.
//------------------------------------------------------------------------

export default function ModeExitBar()
{
    const [, forceRefresh] = useReducer((x: number) => x + 1, 0);

    useEffect(() => {
        voxelQuadSelectionObservable.addListener("ui.modeExitBar", forceRefresh);
        objectSelectionObservable.addListener("ui.modeExitBar", forceRefresh);
        playerSelectionObservable.addListener("ui.modeExitBar", forceRefresh);
        gameModeObservable.addListener("ui.modeExitBar", forceRefresh);
        cameraModeObservable.addListener("ui.modeExitBar", forceRefresh);
        for (const flag of exitFeatureFlags)
            clientFeatureFlagsObservable.addElementListener("ui.modeExitBar", flag, forceRefresh);
        return () => {
            voxelQuadSelectionObservable.removeListener("ui.modeExitBar");
            objectSelectionObservable.removeListener("ui.modeExitBar");
            playerSelectionObservable.removeListener("ui.modeExitBar");
            gameModeObservable.removeListener("ui.modeExitBar");
            cameraModeObservable.removeListener("ui.modeExitBar");
            for (const flag of exitFeatureFlags)
                clientFeatureFlagsObservable.removeElementListener("ui.modeExitBar", flag);
        };
    }, []);

    // The way out is named for what is being left: a mode the user deliberately entered, or merely
    // the selection he made in passing during play mode.
    const inEditMode = GameModeUtil.isInEditMode();
    const exit = exitIsOffered()
        ? {
            name: inEditMode ? "Exit Edit Mode" : "Exit Selection",
            onClick: inEditMode
                ? () => GameModeUtil.exitEditMode()
                : () => WorldSpaceSelectionUtil.unselectAll(),
        }
        : undefined;

    // Either control on its own is reason enough for the bar to be up, and each decides for itself
    // whether it has anything to offer: a single-player step that holds a selection in place leaves
    // nothing to exit, and the camera is orbiting that selection all the same — so the zoom stays.
    if (exit == undefined && cameraModeObservable.peek().type !== "orbit")
        return null;

    // Each control also claims the pointer for itself, which leaves the empty width between and
    // around them to the 3D scene: this row spans the screen, and a strip that swallowed drags is a
    // strip the user cannot orbit from.
    //
    // The two of them stay on one line at every width, portrait screens included. Wrapping to a
    // second line would push the row down over the scene and move the exit button out from under
    // wherever the user last found it, and the zoom has a way of giving room that the button does
    // not: its track can be short and still be a track, while a button whose name is cut is a button
    // that no longer says what it does. So the button keeps its full width and the slider yields the
    // rest.
    return <div className="absolute top-(--yj-headline-height,0px) left-0 w-full flex flex-row flex-nowrap items-center justify-end gap-2 p-2 pointer-events-none">
        <CameraZoomSlider/>
        {exit != undefined && <Button id="modeExitButton" name={exit.name} size="md" color="green"
            onClick={exit.onClick} additionalClassNames="shrink-0"/>}
    </div>;
}

// Whether there is something to leave and the user is free to leave it. A single-player step may be
// holding a selection in place on purpose, or keeping the way out to itself until the moment it
// means to teach it, and a button that would do nothing when pressed is worse than no button at all.
function exitIsOffered(): boolean
{
    if (clientFeatureFlagsObservable.has(FeatureFlag.HideModeExitButton) ||
        clientFeatureFlagsObservable.has(FeatureFlag.DisableAllSelectionChange))
    {
        return false;
    }
    if (VoxelQuadSelection.isSelected() &&
        !clientFeatureFlagsObservable.has(FeatureFlag.DisableVoxelQuadSelectionChange))
    {
        return true;
    }
    if (ObjectSelection.isSelected() &&
        !clientFeatureFlagsObservable.has(FeatureFlag.DisableObjectSelectionChange))
    {
        return true;
    }
    return PlayerSelection.isSelected() &&
        !clientFeatureFlagsObservable.has(FeatureFlag.DisablePlayerSelectionChange);
}
