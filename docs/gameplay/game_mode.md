# Game Mode

Reference: @src/client/system/types/gameMode.ts , @src/client/system/util/gameModeUtil.ts , @src/client/graphics/util/worldSpaceSelectionUtil.ts , @src/client/graphics/types/gizmo/playerSelection.ts , @src/client/ui/components/hud/mode/gameModeMenu.tsx , @src/client/ui/components/hud/user/userRoomIdentity.tsx , @src/shared/room/util/roomValidationUtil.ts

## What a game mode is

A game mode is the whole arrangement the user is working under — what the camera does, whether the player may walk, and which controls are on screen — rather than any one of those things. There are two, `GameMode` names them, and `GameModeUtil` owns which one the user is in:

- **Play mode** — the ordinary state. The user walks the room in the first-person view. Clicking a block or an object is a way of looking at it and reading about it, nothing more: the camera stays at the player's eye and the tools for changing what was clicked stay away. A click on the scenery is not by itself a statement that the user meant to start rearranging the room.
- **Edit mode** — entered deliberately, and left the same way. The camera orbits whatever is currently selected, the player stands still, and the tools for changing that selection are on screen.

Everything that differs between the two follows from this single published value, so whoever answers to the mode does so by watching it. World-space selection is the largest such follower, but selection is not what a mode *is*, which is why the two are kept apart: `WorldSpaceSelectionUtil` decides what is picked out and where the camera stands in answer, and reads the mode to know what a selection is currently worth.

The mode is held in its own right rather than read back out of the camera, because the two are not the same statement. The camera says where it is looking from, which a selection being swapped for another leaves momentarily unanswered — an edit drops the current selection on its way to picking out what it just produced — while the mode says what the user is doing, and that does not waver in between.

## Entering and leaving edit mode

The way in is the edit-mode button in the top bar. It opens the mode on the user's own character: the one thing in the room that is his wherever he is standing, and the one he is most likely to want to change first. The character is therefore the mode's first selection, and the customization form appears with it.

The way out is the button that says so, the platform's back gesture, or a second click on the very thing being edited. Leaving drops the selection and hands the camera back to the first-person view.

The mode itself is open to everyone, because the character it opens on is the user's own in whatever room he is standing in. What the *room* is made of is another matter: a click meant to pick a block or a picture out of a room the user may not edit (`RoomValidationUtil`) is turned away where it lands, and tells him why rather than doing nothing. A role taken back from him mid-room drops whatever of that room he had picked out, on the same grounds, and the mode goes with it: what was taken from him is not his to hold on to, so a scripted step's hold on that selection has no say either.

That button belongs to the **game-mode menu** (`GameModeMenu`), which takes the top edge of the screen for as long as a mode is up and holds what belongs to the mode rather than to anything selected inside it: the way out and the camera's zoom. Below them, for a user editing his own room, is the way into that room's settings — what the room *is*, as against what is in it — which is why it keeps to edit mode and does not by itself raise the menu. The identity and room controls that normally hold that corner step aside meanwhile. Both sit below whatever height the tutorial's headline currently reaches, so an instruction and the control it names can be on screen at once.

One thing can keep the mode from opening or closing: **a scripted step**. A single-player tutorial step may hold the user in the mode he is in — walking him through what is inside it, or keeping the way out to itself until the moment it means to teach it (see [single_player_mode.md](../networking/single_player_mode.md)). What such a step holds is the crossing itself, asked at `GameModeUtil` by every way across, rather than the button that offers one: two of the three ways out go through no button at all, so a mode whose exit button was merely hidden would still be a mode the user could leave by pressing Escape. The controls read that same answer back, and are on screen exactly when there is a crossing to make.

Leaving the mode takes the selection standing in it along, whether or not that selection was itself pinned by a step: the step pinned it for the sake of what was being taught *inside* the mode, and the mode is what is being left. A mode that cannot pick out even the character it opens on is likewise given up again rather than left standing empty.

## Selection inside and outside the mode

Only one thing is ever selected — a voxel-quad, an object, or the user's own character — and picking anything replaces whatever was picked before. What that selection *does* is what the mode decides:

| | Play mode | Edit mode |
|---|---|---|
| Camera | stays at the player's eye, pitching toward the selection | orbits the selection (see [camera_control.md](../graphics/camera_control.md)) |
| Player | free to walk | stands still |
| On screen | what the selection *is* (e.g. a canvas's description) | the tools for changing it |
| Clicking the current selection again | drops it | drops it, and the mode with it |

Clicking what is already picked out is how it is let go of, in either mode. Inside edit mode the mode goes with it, because the mode *is* that selection — the camera orbiting it, the player standing still for it — and there is nothing left for that arrangement to be kept up for once the selection is gone. That also makes the click a way out of the mode, so a step holding the user in the mode turns the whole click away rather than half of it: dropping the selection alone would leave exactly the empty mode just described. The user's own character is the exception: opening the mode is itself a selection of the character, so a click on it always leaves it picked out.

## Related docs

- [Camera Control](../graphics/camera_control.md) — what the camera does in each mode, and how an orbit is framed.
- [Player Customization System](../geometry/player_customization.md) — the form that the character being selected puts on screen.
- [Single-Player Mode](../networking/single_player_mode.md) — how a scripted tutorial step constrains what the user may do in a mode.
