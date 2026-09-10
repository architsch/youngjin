# Game Mode

Reference: @src/client/system/types/gameMode.ts , @src/client/system/util/gameModeUtil.ts , @src/client/graphics/util/worldSpaceSelectionUtil.ts , @src/client/graphics/types/gizmo/objectSelection.ts , @src/client/object/types/objectTypeClientConfig/objectTypeClientConfig.ts , @src/client/ui/components/hud/mode/gameModeMenu.tsx , @src/client/ui/components/hud/user/userRoomIdentity.tsx , @src/shared/room/util/roomValidationUtil.ts

## What a game mode is

A game mode is the whole arrangement the user is working under — what the camera does, whether the player may walk, and which controls are on screen — rather than any one of those things. There are two, `GameMode` names them, and `GameModeUtil` owns which one the user is in:

- **Play mode** — the ordinary state. The user walks the room in the first-person view. Clicking a block or an object is a way of looking at it and reading about it, nothing more: the camera stays at the player's eye and the tools for changing what was clicked stay away. A click on the scenery is not by itself a statement that the user meant to start rearranging the room.
- **Edit mode** — entered deliberately, and left the same way. The camera orbits whatever is currently selected, the player stands still, and the tools for changing that selection are on screen.

Everything that differs between the two follows from this single published value, so whoever answers to the mode does so by watching it. World-space selection is the largest such follower, but selection is not what a mode *is*, which is why the two are kept apart: `WorldSpaceSelectionUtil` decides what is picked out and where the camera stands in answer, and reads the mode to know what a selection is currently worth.

The mode is held in its own right rather than read back out of the camera, because the two are not the same statement. The camera says where it is looking from, which a selection being swapped for another leaves momentarily unanswered — an edit drops the current selection on its way to picking out what it just produced — while the mode says what the user is doing, and that does not waver in between.

## Entering and leaving edit mode

There are two ways in, and each opens the mode on something already picked out. The edit-mode button in the top bar opens it on the user's own character: the one thing in the room that is his wherever he is standing, and the one he is most likely to want to change first. The character is therefore the mode's first selection, and the customization form appears with it.

The other is offered from the game-mode menu while a play-mode selection is standing, and opens the mode on that selection rather than replacing it: the user has just picked a face of the room out and looked at it, and going on to change that very thing is the next step. Only a voxel-quad can be standing there, objects being picked out from inside the mode alone (see below). Since it opens on what belongs to the room, it is offered only where that room is the user's to edit — the same question a click inside the mode is turned away by.

The way out is the button that says so, or the platform's back gesture. Leaving drops the selection and hands the camera back to the first-person view.

The mode itself is open to everyone, because the character it opens on is the user's own in whatever room he is standing in. What the *room* is made of is another matter: a click meant to pick a block or a picture out of a room the user may not edit (`RoomValidationUtil`) is turned away where it lands, and tells him why rather than doing nothing.

That button belongs to the **game-mode menu** (`GameModeMenu`), which takes the top edge of the screen for as long as a mode is up and holds what belongs to the mode rather than to anything selected inside it. The way out is drawn in red, as the one control there that undoes rather than does; beside it sits whichever control the mode at hand leaves wanting — the way up into edit mode under a play-mode selection, the camera's zoom under edit mode itself. Below them, for a user editing his own room, is the way into that room's settings — what the room *is*, as against what is in it — which is why it keeps to edit mode and does not by itself raise the menu. The identity and room controls that normally hold that corner step aside meanwhile. Both sit below whatever height the tutorial's headline currently reaches, so an instruction and the control it names can be on screen at once.

One thing can keep the mode from opening or closing: **a scripted step**. A single-player tutorial step may hold the user in the mode he is in — walking him through what is inside it, or keeping the way out to itself until the moment it means to teach it (see [single_player_mode.md](../networking/single_player_mode.md)). What such a step holds is the crossing itself, asked at `GameModeUtil` by every way across, rather than the button that offers one: two of the three ways out go through no button at all, so a mode whose exit button was merely hidden would still be a mode the user could leave by pressing Escape. The controls read that same answer back, and are on screen exactly when there is a crossing to make.

Leaving the mode takes the selection standing in it along, whether or not that selection was itself pinned by a step: the step pinned it for the sake of what was being taught *inside* the mode, and the mode is what is being left. A mode that cannot pick out even the character it opens on is likewise given up again rather than left standing empty.

## Selection inside and outside the mode

Only two things can be picked out — a voxel-quad, or an object of the room — and picking either replaces whatever was picked before. The user's own character is an object like any other here: it is selected, outlined, framed and edited through the same path as a picture or a door, and what differs between one kind of object and the next is only what its selection brings out on screen (see below).

**An object is picked out from inside edit mode and nowhere else.** Taking hold of a thing is the beginning of changing it, and changing things is what the mode is for; outside it a click on an object is a click on the room and nothing more — a door is walked through, and everything else is scenery. A voxel-quad is the exception, and can still be picked out during play mode, which is what the way up into edit mode from a standing selection is offered for.

While the mode lasts the camera orbits whatever is selected (see [camera_control.md](../graphics/camera_control.md)), the player stands still, and the tools for changing what is picked out are on screen.

A selection is given up by saying so — the way out of the mode, or the back gesture — and never by a click. Clicking what is already picked out leaves it exactly where it is, so that the user reaching for a tool and catching the object underneath it still finds the object there, and so that opening the mode on the character can go through the very same call that a click on the character does.

## What a kind of object brings out when it is picked out

There is no separate notion of selecting a character, a picture or a door. A click on an object is answered by `GameObject` itself, in one place and the same way for every kind of object; each type declares its own selection-related characteristics in its `ObjectTypeClientConfig`, and both the click and everything that follows it read them rather than knowing one type from another. A type that declares nothing of the sort is simply not selectable as an object — which is how a voxel is answered by the face that was clicked instead.

What a type declares is small: who may take hold of one, the panel of tools its selection raises, and whether it is one of the kinds slid along a wall by arrows. Everything else is derived.

- **Who may take hold of one** is the type's own rule, written whole and in one place. Only a single condition is asked of every object alike — the user has to be in edit mode — and each type says the rest for itself: a picture belongs to whoever may edit the room it hangs in, a door to whoever lays out the world, a lamp to an admin wherever it stands, and a character to its owner in any room at all. Keeping the whole rule in one place is what lets those differ honestly, rather than each type carrying an exception to a shared condition that does not really apply to it.
- **A refusal is ordinarily silent**, since what it refuses was never offered to that user: a click passes through the object the way a click on a wall does. A type whose refusal would puzzle the user explains it instead — a picture is offered to everybody who walks past it, so a user in a room he may not edit is told why his click did nothing.
- **How it is outlined and framed** follows from the box the object is collided with. An object fixed to the room's fabric is outlined on the face it presents to the room and framed among its surroundings, since the wall it hangs on is what an edit to it is judged against; a body standing in the room is outlined on the ground beneath it and framed by its own size alone, being looked at for its own sake.
- **How big the move arrows are** is that same collider, and **who may use them** is nobody's separate question: a user who may take hold of an object may move it, and every individual step is checked against the room regardless.

## Related docs

- [Camera Control](../graphics/camera_control.md) — what the camera does in each mode, and how an orbit is framed.
- [Player Customization System](../geometry/player_customization.md) — the form that the character being selected puts on screen.
- [Single-Player Mode](../networking/single_player_mode.md) — how a scripted tutorial step constrains what the user may do in a mode.
