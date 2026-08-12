# Game Mode

Reference: @src/client/system/types/gameMode.ts , @src/client/system/util/gameModeUtil.ts , @src/client/graphics/util/worldSpaceSelectionUtil.ts , @src/client/graphics/types/gizmo/playerSelection.ts , @src/client/ui/components/hud/mode/modeExitBar.tsx , @src/client/ui/components/hud/user/userRoomIdentity.tsx , @src/shared/room/util/roomValidationUtil.ts

## What a game mode is

A game mode is the whole arrangement the user is working under — what the camera does, whether the player may walk, and which controls are on screen — rather than any one of those things. There are two, `GameMode` names them, and `GameModeUtil` owns which one the user is in:

- **Play mode** — the ordinary state. The user walks the room in the first-person view. Clicking a block or an object is a way of looking at it and reading about it, nothing more: the camera stays at the player's eye and the tools for changing what was clicked stay away. A click on the scenery is not by itself a statement that the user meant to start rearranging the room.
- **Edit mode** — entered deliberately, and left the same way. The camera orbits whatever is currently selected, the player stands still, and the tools for changing that selection are on screen.

Everything that differs between the two follows from this single published value, so whoever answers to the mode does so by watching it. World-space selection is the largest such follower, but selection is not what a mode *is*, which is why the two are kept apart: `WorldSpaceSelectionUtil` decides what is picked out and where the camera stands in answer, and reads the mode to know what a selection is currently worth.

The mode is held in its own right rather than read back out of the camera, because the two are not the same statement. The camera says where it is looking from, which a selection being swapped for another leaves momentarily unanswered — an edit drops the current selection on its way to picking out what it just produced — while the mode says what the user is doing, and that does not waver in between.

## Entering and leaving edit mode

The way in is the edit-mode button in the top bar. It opens the mode on the user's own character: the one thing in the room that is his wherever he is standing, and the one he is most likely to want to change first. The character is therefore the mode's first selection, and the customization form appears with it.

The way out is the button that says so, in the same top bar (see `ModeExitBar`), or the platform's back gesture. Leaving drops the selection and hands the camera back to the first-person view.

Two things can keep the mode from opening or closing:

- **Permission.** Edit mode is only ever open to a user who may actually edit the room he is in (`RoomValidationUtil`) — for anyone else the price of it, the camera and the player both given over to the selection, would buy nothing. The button is not offered to them at all, and a role taken away mid-room takes the mode with it.
- **A scripted step.** A single-player tutorial step may be holding a selection in place, or holding the way out off screen until the moment it means to teach it (see [single_player_mode.md](../networking/single_player_mode.md)). A selection the user is not free to give up holds the mode open along with it.

## Selection inside and outside the mode

Only one thing is ever selected — a voxel-quad, an object, or the user's own character — and picking anything replaces whatever was picked before. What that selection *does* is what the mode decides:

| | Play mode | Edit mode |
|---|---|---|
| Camera | stays at the player's eye, pitching toward the selection | orbits the selection (see [camera_control.md](../graphics/camera_control.md)) |
| Player | free to walk | stands still |
| On screen | what the selection *is* (e.g. a canvas's description) | the tools for changing it |
| Clicking the current selection again | drops it | keeps it |

That last row is the one rule that reads oddly out of context. In edit mode the user clicks the thing he is working on over and over — dragging the camera around it, reaching past the menu that covers half the screen — so a click that emptied the mode out from under him would be a trap rather than a shortcut. The mode always has something selected, and is left by the button that says so.

## Related docs

- [Camera Control](../graphics/camera_control.md) — what the camera does in each mode, and how an orbit is framed.
- [Player Customization System](../geometry/player_customization.md) — the form that the character being selected puts on screen.
- [Single-Player Mode](../networking/single_player_mode.md) — how a scripted tutorial step constrains what the user may do in a mode.
