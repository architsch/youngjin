# Restricted Zones

Reference: @src/shared/voxel/util/restrictedZoneUtil.ts , @src/shared/object/types/objectTypeConfig/volumeObjectTypeConfig.ts , @src/shared/room/util/roomValidationUtil.ts , @src/client/voxel/util/restrictedZoneOutlineUtil.ts , @src/client/object/types/gameObject/volumeGameObject.ts

A restricted zone is a **volume kept for a user**: a box of the room's blocks (see [voxel_grid.md](../geometry/voxel_grid.md)) in which only that user and the room's **superuser** may edit, or the superuser alone. Zones keep a hub's walls intact, and they let an owner reserve part of a room, for themselves or for somebody else, while leaving the rest open to visitors.

## Volumes
- A volume (`VolumeObjectTypeConfig`) is an object with no body: a named box on the block grid, which draws nothing and stops nobody. It counts against its category's cap as any object does.
- A volume is laid, resized, named and removed by the room's superuser, or by an admin in any room (see [game_mode.md](game_mode.md#selection)).
- A volume whose `ZoneUserName` metadata names a user is a restricted zone kept for that user. The name is matched against a user's name as it stands.
- `*` in place of a name (`ZONE_USER_NAME_FOR_NOBODY`) keeps the zone from every user but the superuser, whatever anyone is called.
- A volume with neither restricts nothing: it only marks a stretch of the room (see [single_player_mode.md](../networking/single_player_mode.md#rooms)).
- Zones may overlap. Each holds on its own, so where two lie over a block, only a user both let in may edit it.

## Superuser
- In a Hub, admins are the superusers (see [admin.md](admin.md)).
- In a Regular room, the owner is the superuser.
- In the dev sandbox and the room editor, the player is the superuser. Other single-player rooms have none.
- The superuser also manages the room's doors and labels (see [room_entrance.md](../geometry/room_entrance.md)).

## Rules for everyone else
Inside a zone, anyone but its user and the superuser may not:
- add, remove or move voxel blocks;
- repaint faces, except the faces the zone ends at, on any of its six sides;
- add, move (into or out of the zone) or remove persistent objects, or change what they show. Objects attached to the faces the zone ends at are outside the zone.

A zone that reaches the bottom or the top of the room takes in the room's own floor or ceiling there. Volumes are never held by a zone: who may edit one is their own type's rule.

Selecting things, entering edit mode and walking around are all still allowed. Anything already present when a zone is laid stays.

`VoxelUpdateUtil` and `ObjectUpdateUtil` enforce these rules through `RestrictedZoneUtil`, on both the client and the server. On the client, tools that a zone forbids are disabled. Because the selection is re-announced whenever a zone changes, the tools re-check their state after each change.

## Display
- In edit mode, every user sees a red border on the faces of the blocks inside a zone, whomever the zone is kept for. The border is drawn by the voxel face material through a per-face flag.
- Whoever may edit volumes also sees each one as the outline of its box, under its name and, for a zone, its user (see [game_mode.md](game_mode.md#selection)).

## Sync and storage
- A zone is an object, so it is synced, stored and carried in room files as objects are (see [object_update.md](../networking/object_update.md)).
- `restrictedZonesChangedObservable` fires whenever a volume changes, for whatever draws or reads the zones.
- The zones an older room's voxel grid held become volumes as the room is read, each from the room's floor to its ceiling and kept for nobody, so they hold as they did (see [voxel_grid.md](../geometry/voxel_grid.md#stored-format)).
- Generated rooms start with no zones, because a zone is a per-room owner decision that generation cannot make.
