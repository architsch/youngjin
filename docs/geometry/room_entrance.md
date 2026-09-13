# Room Entrances

Reference: @src/shared/object/types/objectTypeConfig/doorObjectTypeConfig.ts , @src/server/room/util/spawnHotspotUtil.ts

A room's only entrances are its **doors**. A door is a wall-attached object (see [wall_attached_object.md](wall_attached_object.md)) that is stored with the room and used by clicking it. No hole is cut behind a door: an attachment needs a solid wall, so room boundaries stay solid all the way round.

Every multiplayer room is generated with exactly one door on a boundary wall. Regular rooms keep that single door. Hub doors are added and linked by admins (see [admin.md](../gameplay/admin.md)).

## Door metadata
Besides its appearance ([door_design.md](door_design.md)), a door stores:
- **Label** (and label color): the text on its plate, which is also the name other doors look it up by. Labels may repeat.
- **Destination room**: a door with no destination, or one that points at its own room, is locked. A reserved id means "the hubs", and the hub balancer picks one at travel time (see [room_population.md](../networking/room_population.md)). Generated doors use this id, so every room can be left.
- **Destination door label**: which door of the destination room the traveler arrives behind.
- **Door type**: whether the door counts as one of the room's default entrances.

## Spawning
Players have no saved position. Every room entry places the player behind a door, chosen by `SpawnHotspotUtil` in this order:
1. a door whose label matches the requested one (random among matches);
2. a default-entrance door (random);
3. any door;
4. the room center.

The player starts inside the wall behind the door, facing the room, and `PlayerController` walks them forward until they are clear of it. The walk is limited by both distance and time.

## Door behavior
- **Collider**: a thin pass-through collider, since the wall behind it already blocks movement.
- **Enter prompt**: shown only when the player is close, looking toward the door, in front of its face and has line of sight. The cheap checks run first. The line-of-sight check is needed because users may have built in front of the door.
- **Click**: travels to the destination, or shows a "locked" notice. A door that points at the hubs hands the player to the balancer, which is also how the tutorial ends. For an admin in a Hub, a click selects the door in edit mode instead.
- **Protection**: no cells are reserved around a door. Its wall block cannot be removed while the door hangs on it, and only admins may remove the door. Generation keeps its own block work off the floor in front of the entrance.
