import App from "../../app";
import GameMode from "../types/gameMode";
import GameObject from "../../object/types/gameObject";
import PlayerSelection from "../../graphics/types/gizmo/playerSelection";
import RoomRuntimeMemory from "../../../shared/room/types/roomRuntimeMemory";
import RoomValidationUtil from "../../../shared/room/util/roomValidationUtil";
import WorldSpaceSelectionUtil from "../../graphics/util/worldSpaceSelectionUtil";
import { gameModeObservable, roomChangedObservable, userRoleObservable } from "../clientObservables";

//------------------------------------------------------------------------
// The two modes the game is played in, and the line between them.
//
// In **play mode** the user walks the room in the first-person view. Clicking a block or an object
// there is a way of looking at it and reading about it, nothing more: the camera stays where it is
// and the tools for changing what was clicked stay away. This is what a visitor has always got, and
// it is what everyone gets, because a click on the scenery is not by itself a statement that the
// user meant to start rearranging the room.
//
// **Edit mode** is entered deliberately, by the button that says so, and it begins on the user's own
// character (see enterEditMode). While it lasts, the camera orbits whatever is currently selected,
// the player stands still, and the tools for changing that selection are on screen; clicking
// something else moves the whole arrangement onto it. Leaving the mode is the one way a selection
// made inside it is given up, which is why clicking the same thing twice does not drop it there.
//
// This module owns which mode the user is in, and nothing beyond it: whoever answers to the mode
// does so by watching gameModeObservable, rather than being driven from here. World-space selection
// is the largest such follower, but it is not what a mode *is* — which is why the two are kept
// apart.
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

    // Enters edit mode, on the user's own character — the one thing in the room that is his wherever
    // he is standing, and the one he is most likely to want to change first. The character is handed
    // in rather than looked up, since this module sits underneath the object manager that would have
    // to be asked for it.
    enterEditMode: (myPlayer: GameObject): void =>
    {
        if (!canEditCurrentRoom())
            return;

        gameModeObservable.set("edit");
        // Nothing to be in the mode for if the character cannot even be picked (a scripted step may
        // be holding every selection down), so the mode is given up again rather than left standing
        // with no selection under it.
        if (!PlayerSelection.trySelect(myPlayer))
            gameModeObservable.set("play");
    },

    // Leaves edit mode, giving the camera and the run of the room back to the user. The selection
    // goes with it — but only if the user is free to give it up: a scripted step holding one in
    // place is holding the mode open along with it.
    exitEditMode: (): void =>
    {
        WorldSpaceSelectionUtil.unselectAll();
        if (WorldSpaceSelectionUtil.isAnythingSelected())
            return;
        gameModeObservable.set("play");
    },
}

// Whether the room the user is currently in is one he may edit. Edit mode is never open to anyone
// else: the price of it — the camera and the player both given over to the selection — would buy
// them nothing.
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
// editor's rights back — and the mode he is in has to go with it.
userRoleObservable.addListener("gameMode", () => {
    if (GameModeUtil.isInEditMode() && !canEditCurrentRoom())
    {
        WorldSpaceSelectionUtil.unselectAll(true);
        gameModeObservable.set("play");
    }
});

export default GameModeUtil;
