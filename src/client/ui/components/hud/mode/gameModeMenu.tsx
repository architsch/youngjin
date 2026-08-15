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
import { MINUTE_IN_MS } from "../../../../../shared/system/sharedConstants";
import User from "../../../../../shared/user/types/user";
import { UserTypeEnumMap } from "../../../../../shared/user/types/userType";
import Button from "../../input/button";
import CameraZoomSlider from "./cameraZoomSlider";
import PopupUtil from "../../../util/popupUtil";
import FTUEUtil from "../../../util/ftueUtil";
import { FTUEElementCodeEnumMap } from "../../../types/ftueElementCode";

// Feature flags whose toggling changes whether the way out is offered at all.
const exitFeatureFlags = [
    FeatureFlag.DisableAllSelectionChange,
    FeatureFlag.DisableVoxelQuadSelectionChange,
    FeatureFlag.DisableObjectSelectionChange,
    FeatureFlag.DisablePlayerSelectionChange,
    FeatureFlag.DisableGameModeTransition,
];

//------------------------------------------------------------------------
// A couple of the things the user can do are not panels but modes: the screen is given over to
// them, and the user stays inside one until he/she leaves it. Edit mode is one — the camera goes
// into an orbit around whatever is selected and the player stops answering — and a selection made
// during play mode is a lesser one, which takes the camera's attention if not its place. What they
// have in common is the thing that matters here: ordinary play is suspended, and there has to be a
// way back to it that no one can miss.
//
// This menu is that way back, and it holds what belongs to the mode rather than to anything inside
// it. For as long as a mode is up it takes the top edge of the screen in place of the identity and
// room controls that normally live there, and it puts the button that ends the mode at the
// right-hand end of that edge, where those controls sit and where the eye already goes looking for
// them. Beside it, on its left, sits the zoom control — about the mode itself rather than about
// anything in it, and only ever wanted while one is up. Below both, for the user standing in his
// own room, is the way into that room's settings: what the room is, as against what is in it.
//
// It draws no band of its own behind them. The top edge is shared with the headline, which carries
// the single-player tutorial's instructions and takes the full width whenever it has something to
// say, so a band up there would be covered by the instruction or cover it. The menu keeps nothing
// but its controls, each carrying its own surface, and hangs them below whatever height the
// headline currently reaches — which is what lets a step tell the user something and offer the way
// out of the mode at once.
//------------------------------------------------------------------------

export default function GameModeMenu({ user, currentRoomID }: Props)
{
    const [, forceRefresh] = useReducer((x: number) => x + 1, 0);

    useEffect(() => {
        voxelQuadSelectionObservable.addListener("ui.gameModeMenu", forceRefresh);
        objectSelectionObservable.addListener("ui.gameModeMenu", forceRefresh);
        playerSelectionObservable.addListener("ui.gameModeMenu", forceRefresh);
        gameModeObservable.addListener("ui.gameModeMenu", forceRefresh);
        cameraModeObservable.addListener("ui.gameModeMenu", forceRefresh);
        for (const flag of exitFeatureFlags)
            clientFeatureFlagsObservable.addElementListener("ui.gameModeMenu", flag, forceRefresh);
        return () => {
            voxelQuadSelectionObservable.removeListener("ui.gameModeMenu");
            objectSelectionObservable.removeListener("ui.gameModeMenu");
            playerSelectionObservable.removeListener("ui.gameModeMenu");
            gameModeObservable.removeListener("ui.gameModeMenu");
            cameraModeObservable.removeListener("ui.gameModeMenu");
            for (const flag of exitFeatureFlags)
                clientFeatureFlagsObservable.removeElementListener("ui.gameModeMenu", flag);
        };
    }, []);

    // The way out is named for what is being left, and each of the two is offered on its own terms.
    // Leaving edit mode is a crossing back into play mode, so what governs it is whether the user is
    // free to make that crossing at all — the same question the back gesture asks, so that the
    // button is on screen exactly when there is a way out to press it for. Outside the mode there is
    // no crossing to make: the way out is merely the selection the user made in passing, and giving
    // that up is the selection's own affair.
    const inEditMode = GameModeUtil.isInEditMode();
    const exit = inEditMode
        ? (GameModeUtil.canChangeGameMode()
            ? {name: "Exit Edit Mode", onClick: () => GameModeUtil.exitEditMode()}
            : undefined)
        : (selectionCanBeGivenUp()
            ? {name: "Exit Selection", onClick: () => WorldSpaceSelectionUtil.unselectAll()}
            : undefined);

    // A room's own settings are its owner's to change, and only while he is standing in it.
    const showRoomSettings = inEditMode && user.userType !== UserTypeEnumMap.Guest &&
        user.ownedRoomID.length > 0 && user.ownedRoomID === currentRoomID;

    // The mark below keeps to the button it points at: it is scheduled while that button is on
    // offer, and taken back down once it is not. A mark is not taken off the list merely by its
    // target leaving the screen, so one left behind by a button that has gone would return the
    // moment the button did — skipping the wait that is supposed to earn it — which is why the
    // condition that puts it up is also the one that clears it away.
    useEffect(() => {
        if (!showRoomSettings || FTUEUtil.hasFTUEElement(FTUEElementCodeEnumMap.MyRoomSettings))
            return;

        // For any member-type user who has had the button within reach for 2 minutes straight,
        // we will show a coach mark for it if the user hasn't clicked it before.
        const timeout = setTimeout(() => {
            FTUEUtil.tryShowCoachMark(FTUEElementCodeEnumMap.MyRoomSettings,
                "configureMyRoomButton", "View your room's settings here.");
        }, 2 * MINUTE_IN_MS);

        return () => {
            clearTimeout(timeout);
            FTUEUtil.hideCoachMark(FTUEElementCodeEnumMap.MyRoomSettings);
        };
    }, [showRoomSettings]);

    // Either of the mode's own controls is reason enough for the menu to be up, and each decides
    // for itself whether it has anything to offer: a single-player step that holds the user in his
    // mode, or holds a selection in place, leaves nothing to exit — and the camera is orbiting that
    // selection all the same, so the zoom stays. The room settings are not among those reasons: they belong to the room rather
    // than to the mode, and a menu raised for them alone would stand on top of the identity bar
    // that is still holding the same corner.
    if (exit == undefined && cameraModeObservable.peek().type !== "orbit")
        return null;

    // Each control claims the pointer for itself, which leaves the empty width between and around
    // them to the 3D scene: these rows span the screen, and a strip that swallowed drags is a strip
    // the user cannot orbit from.
    //
    // The zoom and the way out stay on one line at every width, portrait screens included. Wrapping
    // to a second line would push the row down over the scene and move the exit button out from
    // under wherever the user last found it, and the zoom has a way of giving room that the button
    // does not: its track can be short and still be a track, while a button whose name is cut is a
    // button that no longer says what it does. So the button keeps its full width and the slider
    // yields the rest.
    return <div className="absolute top-(--yj-headline-height,0px) left-0 w-full flex flex-col items-stretch gap-2 p-2 pointer-events-none">
        <div className="flex flex-row flex-nowrap items-center justify-end gap-2">
            <CameraZoomSlider/>
            {exit != undefined && <Button id="modeExitButton" name={exit.name} size="md" color="green"
                onClick={exit.onClick} additionalClassNames="shrink-0"/>}
        </div>
        {showRoomSettings && <div className="flex flex-row justify-end">
            <Button id="configureMyRoomButton" name="Room Settings" size="md" onClick={() => {
                PopupUtil.openPopup({popupType: "configureMyRoom"});
                FTUEUtil.tryAddFTUEElement(FTUEElementCodeEnumMap.MyRoomSettings);
            }}/>
        </div>}
    </div>;
}

// Whether something is picked out and the user is free to let it go. This is what the way out of a
// play-mode selection amounts to, so a single-player step holding that selection in place on purpose
// leaves nothing for the button to do — and a button that would do nothing when pressed is worse
// than no button at all.
function selectionCanBeGivenUp(): boolean
{
    if (clientFeatureFlagsObservable.has(FeatureFlag.DisableAllSelectionChange))
        return false;
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
    if (PlayerSelection.isSelected() &&
        !clientFeatureFlagsObservable.has(FeatureFlag.DisablePlayerSelectionChange))
    {
        return true;
    }
    return false;
}

interface Props
{
    user: User;
    currentRoomID: string;
}
