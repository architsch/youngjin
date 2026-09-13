# Restricted Zones

Reference: @src/shared/voxel/types/restrictedZone.ts , @src/shared/voxel/util/restrictedZoneUtil.ts , @src/shared/room/util/roomValidationUtil.ts , @src/client/voxel/util/restrictedZoneOutlineUtil.ts

A restricted zone is a rectangle on a room's floor plan that runs from floor to ceiling. Inside it, only the room's **superuser** may edit. Zones keep hub boundary walls intact, and they let an owner reserve part of a room while leaving the rest open to visitors. A room can have a small, capped number of zones.

## Superuser
- In a Hub, admins are the superusers (see [admin.md](admin.md)).
- In a Regular room, the owner is the superuser.
- In a single-player room, zones do not apply.

## Rules for everyone else
Inside a zone, other users may not:
- add, remove or move voxel blocks;
- repaint faces, except the faces on the zone's outer boundary;
- add, move (into or out of the zone) or remove persistent objects, or change what they show.

Selecting things, entering edit mode and walking around are all still allowed. Anything already present when a zone is drawn stays.

`VoxelUpdateUtil` and `ObjectUpdateUtil` enforce these rules through `RestrictedZoneUtil`, on both the client and the server. On the client, tools that a zone forbids are disabled. Because the selection is re-announced whenever the room changes, the tools re-check their state after each change.

## Display and editing
- In edit mode, every user sees a red border on the voxel faces inside a zone. The border is drawn by the voxel face material through a per-face flag.
- The superuser draws zones on a top-down grid that snaps to voxels. A change is committed on release.

## Sync and storage
- Every change sends the room's full zone list. The last writer wins, and zones need no ids.
- Zones are stored in the room's voxel blob and saved by the periodic room save (see [voxel_grid_update.md](../networking/voxel_grid_update.md)).
- Generated rooms start with no zones, because a zone is a per-room owner decision that generation cannot make.
