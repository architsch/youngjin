# Game Mode

Reference: @src/client/system/types/gameMode.ts , @src/client/system/util/gameModeUtil.ts , @src/client/graphics/util/worldSpaceSelectionUtil.ts , @src/client/graphics/types/gizmo/objectSelection.ts , @src/client/graphics/types/gizmo/voxelQuadSelection.ts , @src/client/object/types/objectTypeClientConfig/objectTypeClientConfig.ts , @src/client/ui/components/hud/mode/gameModeToggleSwitch.tsx , @src/client/ui/components/hud/topBar/topBarMenu.tsx , @src/client/ui/components/panel/scrollPanel.tsx , @src/client/ui/util/closablePanelUtil.ts

## What a game mode is

A game mode is the whole arrangement the user is working under — what the camera does, whether the player may walk, and which controls are on screen — rather than any one of those things. There are two, `GameMode` names them, and `GameModeUtil` owns which one the user is in:

- **Play mode** — the ordinary state. The user walks the room in the first-person view, and nothing in it is picked out: a click on the scenery is a click on the room and nothing more — a door is walked through — and the tools for changing things stay away.
- **Edit mode** — where things are picked out and changed. The camera orbits whatever is currently selected, the player stands still, and the tools for changing that selection are on screen.

Everything that differs between the two follows from this single published value, so whoever answers to the mode does so by watching it. World-space selection is the largest such follower, but selection is not what a mode *is*, which is why the two are kept apart: `WorldSpaceSelectionUtil` decides what is picked out and where the camera stands in answer, and reads the mode to know what a selection is currently worth.

The mode is held in its own right rather than read back out of the camera, because the two are not the same statement. The camera says where it is looking from, which a selection being swapped for another leaves momentarily unanswered — an edit drops the current selection on its way to picking out what it just produced — while the mode says what the user is doing, and that does not waver in between.

## Entering and leaving edit mode

**There is one way in: the game-mode switch** (`GameModeToggleSwitch`) in the top bar. It shows both modes with the current one lit, and flipping it is the whole of how edit mode is entered. The mode opens on the user's own character: the one thing in the room that is his wherever he is standing, and the one he is most likely to want to change first. The character is therefore the mode's first selection, and the customization panel appears with it.

**There are two ways out:** flipping the switch back, or the platform's back gesture (Escape, or the device's Back). The back gesture reaches the mode only once there is nothing else on screen for it to put away — a popup is closed first, then any panel that can be put away (see [Panels](#panels)). Leaving drops the selection and hands the camera back to the first-person view.

Nothing else crosses the line — not a click on the scenery, and not a selection being made or dropped — so the mode the user is in is always one he chose, and the switch always says which.

The mode is open to everyone, because the character it opens on is the user's own in any room he can stand in. What may be changed once inside is asked of each thing as it is changed — above all, whether it stands in a restricted zone (see [restricted_zone.md](restricted_zone.md)) — and never of the mode.

One thing can keep the mode from opening or closing: **a scripted step**. A single-player tutorial step may hold the user in the mode he is in — walking him through what is inside it, or keeping the way out to itself until the moment it means to teach it (see [single_player_mode.md](../networking/single_player_mode.md)). What such a step holds is the crossing itself, asked at `GameModeUtil` by every way across, rather than the switch that offers one: the back gesture goes through no control at all, so a mode whose switch was merely disabled would still be a mode the user could leave by pressing Escape. The switch reads that same answer back, and is greyed out rather than hidden while the step holds it, so the user can still see which mode he is in.

Leaving the mode takes the selection standing in it along, whether or not that selection was itself pinned by a step: the step pinned it for the sake of what was being taught *inside* the mode, and the mode is what is being left. A mode that cannot pick out even the character it opens on is likewise given up again rather than left standing empty.

## The top bar

The top edge of the screen holds what is about the session rather than about anything in the room, and it is the same in both modes (`TopBarMenu`): the game-mode switch, the way into the room's own settings for the person the room answers to, and the way out of the app. It draws no band of its own — only a fade from black behind its controls — and it hangs below whatever height the tutorial's headline currently reaches, so an instruction and the control it names can be on screen at once.

The room's settings — what the room *is*, as against what is in it: its texture pack, its restricted zones, its lighting — open as a panel along the bottom of the screen rather than as a popup, so the room stays in view while they are adjusted. They are offered in either mode to the room's superuser (a Regular room's owner, or an admin in a hub), but not in a single-player room, which is generated afresh each time and has nowhere for its settings to be kept. Laid out whole, the settings would stand as a wall of controls over the very room they adjust, so that panel only names them, in a single low row; each setting's controls come up in a panel of their own, one at a time, hung from the toggle beside its name (see [Panels](#panels)).

While the room's settings are open they hold the bottom edge, so the tools for whatever is selected stand down meanwhile, and come back — onto whatever is selected by then — once the settings are put away. Entering edit mode puts them away itself: the mode opens on the user's own character, and the panel that selection brings out needs that same edge.

The camera's zoom slider stands apart from the bar, upright against the right-hand edge of the screen, and only while the camera orbits (see [camera_control.md](../graphics/camera_control.md)).

## Panels

A panel is a strip of controls along the bottom of the screen that scrolls sideways when it holds more than fits — a character's parts, a door's colours, a room's settings. Unlike a popup it covers nothing but itself, which is the point of it: what a panel holds is judged by watching the room change behind it.

A panel raised by a toggle inside another panel — one of the room's settings, say — hangs from that toggle instead of taking a place in the layout: its foot sits just clear of the toggle's top edge, it is only as wide as what it holds, and it stands over the entry it was raised from, drawn over whatever of the panel below it reaches until it is put away. Stacked above that panel instead, the pair would leave a band of the room covered by nothing but the gap between them.

A panel that can be put away carries a close button, and the toggle that opened it closes it again too. The back gesture puts away the most recently opened such panel before it does anything else (`ClosablePanelUtil`), just as it closes the topmost popup. A panel that is part of a selection rather than opened by a toggle — the character's parts, which are what the character being selected looks like — has neither, since putting it away would mean dropping the only selection there is.

## Selection inside and outside the mode

Only two things can be picked out — a voxel-quad, or an object of the room — and picking either replaces whatever was picked before. The user's own character is an object like any other here: it is selected, outlined, framed and edited through the same path as a picture or a door, and what differs between one kind of object and the next is only what its selection brings out on screen (see below).

**Nothing is picked out in play mode.** Taking hold of a thing is the beginning of changing it, and changing things is what edit mode is for. Outside it a click is a click on the room; and a selection the game asks for by itself — one re-picked after an edit whose answer arrives only after the mode was left — is refused all the same.

**Inside the mode, something is always picked out.** The mode opens on the character; a click on a block, or on an object the user may take hold of, moves the selection onto it; and an edit that takes away what was selected moves the selection on to something nearby rather than leaving nothing. Should that ever find nothing, the camera keeps the view it had rather than swinging away.

While the mode lasts the camera orbits whatever is selected (see [camera_control.md](../graphics/camera_control.md)), the player stands still, and the tools for changing what is picked out are on screen.

A selection is given up by leaving the mode, and never by a click. Clicking what is already picked out leaves it exactly where it is, so that the user reaching for a tool and catching the object underneath it still finds the object there, and so that opening the mode on the character can go through the very same call that a click on the character does. A request that finds nothing to pick out — a face nobody can see — likewise leaves the current selection standing.

## What a kind of object brings out when it is picked out

There is no separate notion of selecting a character, a picture or a door. A click on an object is answered by `GameObject` itself, in one place and the same way for every kind of object; each type declares its own selection-related characteristics in its `ObjectTypeClientConfig`, and both the click and everything that follows it read them rather than knowing one type from another. A type that declares nothing of the sort is simply not selectable as an object — which is how a voxel is answered by the face that was clicked instead.

What a type declares is small: who may take hold of one, the panel of tools its selection raises, and whether it is one of the kinds slid along a wall by arrows. Everything else is derived.

- **Who may take hold of one** is the type's own rule, written whole and in one place. Only two conditions are asked of every click alike, whatever it lands on — the user has to be in edit mode, and the thing has to be within his reach — and each type says the rest for itself: a picture belongs to anybody, a door to whoever lays out the world, a lamp to an admin wherever it stands, and a character to its owner in any room at all. Keeping the whole rule in one place is what lets those differ honestly, rather than each type carrying an exception to a shared condition that does not really apply to it.
- **A refusal is silent**, since what it refuses was never offered to that user: a click passes through the object the way a click on a wall does.
- **How it is outlined and framed** follows from the box the object is collided with. An object fixed to the room's fabric is outlined on the face it presents to the room and framed among its surroundings, since the wall it hangs on is what an edit to it is judged against; a body standing in the room is outlined on the ground beneath it and framed by its own size alone, being looked at for its own sake.
- **How big the move arrows are** is that same collider, and **who may use them** is nobody's separate question: a user who may take hold of an object may move it, and every individual step is checked against the room regardless.

## Related docs

- [Camera Control](../graphics/camera_control.md) — what the camera does in each mode, and how an orbit is framed.
- [Player Customization System](../geometry/player_customization.md) — the panel that the character being selected puts on screen.
- [Restricted Zones](restricted_zone.md) — what may and may not be changed inside the mode, and where.
- [Single-Player Mode](../networking/single_player_mode.md) — how a scripted tutorial step constrains what the user may do in a mode.
