# The Admin Privilege

Reference: @src/shared/room/util/roomValidationUtil.ts , @src/shared/object/types/objectTypeConfig/doorObjectTypeConfig.ts , @src/server/user/util/userIdentificationUtil.ts

Admin is a user type that is granted manually in the database. Admins decide by hand how rooms connect through doors, which forms the world's room graph.

## Admin-only abilities
- Adding, moving, removing, labeling and linking doors. This is **Hub rooms only**; a Regular room keeps its generated door. The dev sandbox is the exception, so the tools can be tried without a hub (see [sandbox.md](../testing/playtest/sandbox.md)).
- Setting door colors (see [door_design.md](../geometry/door_design.md)).
- Creating a new hub. The server otherwise creates one only when every hub is full.
- Ordering the hubs, by setting each one's join priority (see [room_population.md](../networking/room_population.md)).
- Acting as a hub's superuser, which covers its texture pack, room settings and restricted zones.

In all other respects an admin edits like any user.

## Enforcement
- `RoomValidationUtil` answers both "is this user an admin" and "may this user edit this room's doors". Door operations run that check on the client and the server.
- Admin HTTP routes re-read the user type from the database on every request (`UserIdentificationUtil`), so the client's claims are never trusted.

## Door semantics
See [room_entrance.md](../geometry/room_entrance.md). A door's label is the name that the destination room looks up on arrival. A door with no destination, or one that points at its own room, is locked.

## UI
There is no separate admin mode. Admins see extra tools: adding a door to a selected wall, selecting doors in edit mode, and room settings in hubs. Locally, a dev admin is available through `?devuser=` or `?sandboxadmin=` (see [local_dev.md](../devOps/local_dev.md)).
