import App from "../../app";
import GameMode from "../types/gameMode";
import GameObject from "../../object/types/gameObject";
import PlayerSelection from "../../graphics/types/gizmo/playerSelection";
import RoomRuntimeMemory from "../../../shared/room/types/roomRuntimeMemory";
import RoomValidationUtil from "../../../shared/room/util/roomValidationUtil";
import WorldSpaceSelectionUtil from "../../graphics/util/worldSpaceSelectionUtil";
import { clientFeatureFlagsObservable, gameModeObservable, roomChangedObservable,
    userRoleObservable } from "../clientObservables";
import { FeatureFlag } from "../../../shared/system/types/featureFlag";

//------------------------------------------------------------------------
// The two modes the game is played in, and the line between them.
//
// In **play mode** the user walks the room in the first-person view. Clicking a block or an object
// there is a way of looking at it and reading about it, nothing more: the camera stays where it is
// and the tools for changing what was clicked stay away. This is what a visitor has always got, and
// it is what everyone gets, because a click on the scenery is not by itself a statement that the
// user meant to start rearranging the room.
//
// **Edit mode** is entered deliberately, by a button that says so, and it begins on something picked
// out: the user's own character where the mode is opened from a standing start (see enterEditMode),
// and whatever he had already selected where it is opened from that selection instead (see
// enterEditModeOnCurrentSelection). While it lasts, the camera orbits whatever is currently selected,
// the player stands still, and the tools for changing that selection are on screen; clicking
// something else moves the whole arrangement onto it, and clicking the very thing already picked out
// is taken as being done with the mode, which then ends along with the selection.
//
// The mode is open to everyone, because the user's own character is his to change in any room he can
// stand in. What the *room* is made of is another matter: a click on a block or a picture is turned
// away where the user has no business editing that room, and says so rather than doing nothing.
//
// This module owns which mode the user is in, and nothing beyond it: whoever answers to the mode
// does so by watching gameModeObservable, rather than being driven from here. World-space selection
// is the largest such follower, but it is not what a mode *is* — which is why the two are kept
// apart.
//
// Every way across the line between the two modes goes through here, and every one of them asks the
// same question first (see canChangeGameMode): a scripted single-player step may be holding the user
// in the mode he is in. That the controls offering those ways are hidden at the same time is not
// what stops him — the back gesture and a second click on what is being edited go through no button
// at all — so the answer is given here, where the crossing itself is made, and the controls merely
// read it back.
//------------------------------------------------------------------------

const GameModeUtil =
{
    getGameMode: (): GameMode =>
    {
        return gameModeObservable.peek();
    },

    isInEditMode: (): boolean =>
    {
        return gameModeObservable.peek() == "edit";
    },

    // Whether the user is currently free to cross from one mode to the other, in either direction.
    // A scripted step may be holding him where he is — walking him through what is inside the mode,
    // or keeping the way out to itself until the moment it means to teach it — and what that step
    // holds is the crossing rather than the button: a mode the user could still leave by pressing
    // Escape is one he was only asked politely to stay in.
    canChangeGameMode: (): boolean =>
    {
        return !clientFeatureFlagsObservable.has(FeatureFlag.DisableGameModeTransition);
    },

    // Enters edit mode, on the user's own character — the one thing in the room that is his wherever
    // he is standing, and the one he is most likely to want to change first.
    enterEditMode: (myPlayer: GameObject): void =>
    {
        if (!GameModeUtil.canChangeGameMode())
            return;

        gameModeObservable.set("edit");
        // Nothing to be in the mode for if the character cannot even be picked (a scripted step may
        // be holding every selection down), so the mode is given up again rather than left standing
        // with no selection under it.
        if (!PlayerSelection.trySelect(myPlayer))
            gameModeObservable.set("play");
    },

    // Whether the mode can be opened on what the user already has picked out. Two things beyond the
    // crossing itself are wanted. There has to be a selection to open on, since this way in is the
    // one that opens on nothing else, and a mode standing over nothing has no camera to speak of and
    // no tools under it. And that selection has to be the user's to work on: what is picked out
    // before the mode begins is always a part of the room — the character can only be picked out
    // from inside the mode, the first-person view he plays in having no body on show to click — and
    // a click on a block or a picture during play mode is a way of looking at it that says nothing
    // about who may change it. So the way in asks what a click inside the mode is turned away by.
    canEnterEditModeOnCurrentSelection: (): boolean =>
    {
        return !GameModeUtil.isInEditMode() && GameModeUtil.canChangeGameMode() &&
            WorldSpaceSelectionUtil.isAnythingSelected() && canEditCurrentRoom();
    },

    // Enters edit mode on what the user already has picked out — the other way in, offered while a
    // play-mode selection is up. He clicked a block or a picture, read what there was to read about
    // it, and this is the way on to changing that very thing, so what he picked out is left standing
    // rather than handed over to his character as the way in above does.
    enterEditModeOnCurrentSelection: (): void =>
    {
        if (!GameModeUtil.canEnterEditModeOnCurrentSelection())
            return;

        gameModeObservable.set("edit");
    },

    // Leaves edit mode, giving the camera and the run of the room back to the user. The selection
    // goes with it, held in place by a scripted step or not: a step pins a selection for the sake of
    // what is being taught *inside* the mode, and once the mode itself is being left there is
    // nothing left for that hold to be protecting. Whether the mode may be left at all is the
    // question asked above, and the only one.
    exitEditMode: (): void =>
    {
        if (!GameModeUtil.canChangeGameMode())
            return;

        WorldSpaceSelectionUtil.unselectAll(true);
        gameModeObservable.set("play");
    },
}

// Whether the room the user is currently in is one he may edit. This governs what the room is made
// of, not whether the mode may be entered: the character the mode opens on is the user's own
// wherever he is standing.
function canEditCurrentRoom(): boolean
{
    const room = App.getCurrentRoom();
    return room != undefined && RoomValidationUtil.canUserEditRoom(userRoleObservable.peek(), room);
}

// A room the user is no longer in is not a room he can be editing, so every arrival starts in play
// mode. (The selections he made in the room he left are dropped by each kind for itself.)
roomChangedObservable.addListener("gameMode", (_roomRuntimeMemory: RoomRuntimeMemory) => {
    gameModeObservable.set("play");
});

// The user's standing in a room can change under him while he is in it — an owner may take an
// editor's rights back — and whatever of that room he had picked out is no longer his to work on.
// It is taken from him rather than given up, which is why the mode is ended here rather than
// through the way out: a scripted step's hold is on what the user may do, and has no say over what
// is done to him.
userRoleObservable.addListener("gameMode", () => {
    if (!GameModeUtil.isInEditMode() || canEditCurrentRoom())
        return;

    WorldSpaceSelectionUtil.unselectAll(true);
    // Nothing is left for the mode to be kept up for, and the mode is not a thing the user can be
    // left holding: it keeps the camera in an orbit and the player standing still, while the tools
    // on screen are for changing a selection that is no longer there. So it goes with what it was
    // arranged around.
    gameModeObservable.set("play");
});

export default GameModeUtil;
