# The Admin Privilege

Reference: @src/shared/room/util/roomValidationUtil.ts , @src/shared/object/types/objectTypeConfig/doorObjectTypeConfig.ts , @src/shared/object/types/objectTypeConfig/labelObjectTypeConfig.ts , @src/shared/object/util/adminPrefsUtil.ts , @src/server/user/util/userIdentificationUtil.ts

Admin is a user type that is granted manually in the database. Admins decide by hand how hubs connect through doors, which forms the world's room graph.

## Admin-only abilities
- Acting as a hub's superuser (see [restricted_zone.md](restricted_zone.md)). That covers its doors — adding, moving, removing, labeling, linking and coloring them (see [door_design.md](../geometry/door_design.md)) — its labels (see [label_text.md](../graphics/label_text.md)), its texture pack, room settings and restricted zones. A Regular room's owner has the same standing in their own room, as does any player in the dev sandbox (see [sandbox.md](../testing/playtest/sandbox.md)).
- Creating a new hub. The server otherwise creates one only when every hub is full.
- Ordering the hubs, by setting each one's join priority (see [room_population.md](../networking/room_population.md)).
- Ghost mode: the admin's own character, body and speech bubble alike, is drawn for nobody, the admin included. Only drawing is affected; the character still moves and collides as usual.

In all other respects an admin edits like any user.

## Admin prefs
An object's admin-only settings live in its `AdminPrefs` metadata, one base-94 character per setting (`AdminPrefsUtil`). Ghost mode is the only one so far, and it lives on the player's character. It is saved with the rest of the player's metadata, so it carries across rooms and sessions. A single-player character has no saved metadata, so ghost mode can be changed only in multiplayer rooms.

## Enforcement
- `RoomValidationUtil` answers both "is this user an admin" and "is this user the room's superuser". Door and label operations run the superuser check on the client and the server.
- `AdminPrefs` is admin-only on any object, by its own rule in `ObjectMetadataEntryMap`; a player may change it only on their own character. A saved value is restored only if the user is still an admin, so a demotion also clears ghost mode.
- Admin HTTP routes re-read the user type from the database on every request (`UserIdentificationUtil`), so the client's claims are never trusted.

## Door semantics
See [room_entrance.md](../geometry/room_entrance.md). A door's label is the name that the destination room looks up on arrival. A door with no destination, or one that points at its own room, is locked.

## UI
There is no separate admin mode. In hubs, admins see the superuser's tools: adding a door or a label to a selected wall, selecting doors and labels in edit mode, and room settings. Only admins are offered a new hub in the door destination chooser. Ghost mode is switched with the `ghost on` and `ghost off` commands in the debug panel's command input. Locally, a dev admin is available through `?devuser=` or `?sandboxadmin=` (see [local_dev.md](../devOps/local_dev.md)).
