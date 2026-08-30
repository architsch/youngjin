# Room Entrances

Reference: @src/shared/object/util/doorObjectUtil.ts , @src/server/room/util/spawnHotspotUtil.ts , @src/shared/object/types/objectTypeConfig/doorObjectTypeConfig.ts

## Overview

A room's ways in and out are its **doors**, and nothing else. A door is an ordinary wall-attached
object (see [wall_attached_object.md](wall_attached_object.md)) hung on the inner face of a wall,
stored with the room like anything else in it, and travelled through by clicking it. A room may hold
several, and which rooms a door joins is set by hand rather than derived from anything.

Nothing is cut through the wall a door hangs on. An attachment needs the wall behind it, so a cavity
there would be the one place in the room its own door could not go — and a room's boundary is
therefore solid the whole way round, with the door reading as a door because of what it looks like
and what it does rather than because there is a hole behind it.

Every multiplayer room is generated with exactly one door, at a fixed cell on one boundary wall (see
[room_generation.md](room_generation.md#the-entrance)). That is the room's own way in and out, and
for a Regular room it is the only door there will ever be. A Hub's doors are an admin's to add, move,
name and wire up — see [admin.md](../gameplay/admin.md), which is where the door semantics below come
from.

## What a Door Carries

Beyond its appearance ([door_design.md](door_design.md)), a door carries these things as object
metadata:

- **A label** — the text written on its plate, which is also the name the door is found by. Two doors
  may share one. What colour it is written in is carried beside it, since which colour reads on a
  plate depends on what that plate was painted rather than on what the door is called.
- **A destination room** — where it opens onto. A door that names none is not a way anywhere.
- **A destination door label** — which door *of that room* the traveller is meant to arrive behind,
  so that walking through a door in one room puts him behind the door that answers it in the next
  rather than wherever that room's own way in happens to be.
- **A door type** — whether the door offers itself as one of the room's ways in, which is what
  decides where a player who asked for nothing in particular is put down.

## Player Spawning

There is no per-user "last position": every entry and every room switch places the player behind one
of the destination room's doors (see [user_state_management.md](../networking/user_state_management.md)).
Which one is chosen by `SpawnHotspotUtil`, by asking for something more and more general until
something answers:

1. **The door the traveller was sent to**, if the room holds one by that label. Several may, in which
   case one of them is drawn.
2. **A door that offers itself as a way in**, otherwise — again drawn, if there are several.
3. **Any door at all**, if none of them does.
4. **The middle of the room**, if it holds no door.

Each step is there because the one before it can genuinely come up empty: a door may have been
renamed or taken down since whoever pointed at it did so, and an admin may have marked none of a
room's doors as a way in.

The player is put down a pace out from the chosen door's face, on the floor it stands on, facing away
from it — and is then walked forward briefly, so that what he sees first is the room rather than the
back of a panel and so that he never comes to rest inside the doorway he arrived through
(`PlayerController`).

## The Door as an Object

- **Collider.** A thin pass-through collider — the wall behind it already blocks the player, so the
  door itself does not need to. Being a wall attachment is what keeps anything else from being hung
  over it, and what makes a door claim a stretch of wall that nothing else may occupy.
- **Interaction.** When the player is close enough, is looking its way, stands in front of its face,
  and can actually see it, the door prompts him to enter. Each condition rules out a position a
  player genuinely ends up in. *In front of its face* is what a player who has just arrived is not:
  he stands behind the panel looking out into the room, and prompting him there would flash an
  invitation to leave over a door he is walking away from. The same condition rules out reaching a
  door from flat against the wall beside it, where the panel is edge-on. And a door is somewhere a
  room's users may have built since, so *being in view* has to be asked separately from being looked
  at. The cheap questions are asked before the costly one, since only the last of them has to search
  the room.
- **Clicking it.** For almost everybody a click is a journey: through to the destination room if the
  door names one, and otherwise a notice that the door is locked — except for a room's own way in,
  which falls back on taking the user out to a hub rather than shutting him in. That fallback is
  also how the tutorial ends, its door being a way in that leads nowhere — see
  [single_player_mode.md](../networking/single_player_mode.md#door-behavior). For an admin a click
  on a door in a Hub instead takes hold of it and opens edit mode around it, since taking hold of a
  door is the beginning of working on one; walking through it is then offered among the tools (see
  [admin.md](../gameplay/admin.md)).

## Editing Near a Door

There are no reserved cells. The floor in front of a door is somewhere to build like anywhere else,
and the wall beside one is somewhere to hang a picture like anywhere else. What protects a room's way
in is the door itself: a wall block cannot be taken down while something hangs on it, and a door is
not a non-admin's to take down first.

Generation still keeps its own block work off the floor in front of the room's entrance, so that an
arriving player is never boxed in by a room he has only just walked into — but that is a rule about
what generation places, not about what anybody may build afterwards.
