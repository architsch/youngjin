import GameMode from "../types/gameMode";
import GameObject from "../../object/types/gameObject";
import ObjectSelection from "../../graphics/types/gizmo/objectSelection";
import RoomRuntimeMemory from "../../../shared/room/types/roomRuntimeMemory";
import WorldSpaceSelectionUtil from "../../graphics/util/worldSpaceSelectionUtil";
import { clientFeatureFlagsObservable, gameModeObservable, roomChangedObservable } from "../clientObservables";
import { FeatureFlag } from "../../../shared/system/types/featureFlag";

//------------------------------------------------------------------------
// The two modes the game is played in, and the line between them.
//
// In **play mode** the user walks the room in the first-person view, and nothing in it is picked out:
// a click on the scenery is a click on the room and nothing more — a door is walked through — and the
// tools for changing things stay away. This is where everyone starts, because walking about and
// looking is what most of a visit is.
//
// **Edit mode** is where things are picked out and changed. It begins on the user's own character —
// the one thing in the room that is his wherever he is standing, and the one he is most likely to
// want to change first — and from then on the camera orbits whatever is currently selected, the
// player stands still, and the tools for changing that selection are on screen. Clicking something
// else moves the whole arrangement onto it; clicking the very thing already picked out leaves it
// exactly where it is. Leaving the mode drops the selection along with it.
//
// There is one way in: the game-mode switch in the top bar, which is also the plainest way out. The
// back gesture (Escape, or the device's Back) is the other way out, once there is no popup or panel
// left on screen for it to put away first. Nothing else crosses the line — not a click on the
// scenery, and not a selection — so the mode the user is in is always one he chose, and the switch
// always says which.
//
// The mode is open to everyone, because the character it opens on is the user's own in any room he
// can stand in. What may be changed once inside is asked of each thing as it is changed (a restricted
// zone, say — see RestrictedZoneUtil), never of the mode.
//
// This module owns which mode the user is in, and nothing beyond it: whoever answers to the mode
// does so by watching gameModeObservable, rather than being driven from here. World-space selection
// is the largest such follower, but it is not what a mode *is* — which is why the two are kept
// apart.
//
// Every way across the line asks the same question first (see canChangeGameMode): a scripted
// single-player step may be holding the user in the mode he is in. The switch greying out at the same
// time is not what stops him — the back gesture goes through no control at all — so the answer is
// given here, where the crossing itself is made, and the switch merely reads it back.
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
    // holds is the crossing rather than the switch: a mode the user could still leave by pressing
    // Escape is one he was only asked politely to stay in.
    canChangeGameMode: (): boolean =>
    {
        return !clientFeatureFlagsObservable.has(FeatureFlag.DisableGameModeTransition);
    },

    // Enters edit mode, on the user's own character.
    enterEditMode: (myPlayer: GameObject): void =>
    {
        if (!GameModeUtil.canChangeGameMode())
            return;

        gameModeObservable.set("edit");
        // Nothing to be in the mode for if the character cannot even be picked (a scripted step may
        // be holding every selection down), so the mode is given up again rather than left standing
        // with no selection under it.
        if (!ObjectSelection.trySelect(myPlayer))
            gameModeObservable.set("play");
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

// A room the user is no longer in is not a room he can be editing, so every arrival starts in play
// mode. (The selections he made in the room he left are dropped by each kind for itself.)
roomChangedObservable.addListener("gameMode", (_roomRuntimeMemory: RoomRuntimeMemory) => {
    gameModeObservable.set("play");
});

export default GameModeUtil;
