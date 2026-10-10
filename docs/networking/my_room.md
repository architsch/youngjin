# "My Room" Flows

Reference: @src/server/networking/router/api/roomRouter.ts , @src/server/room/serverRoomManager.ts , @src/server/db/types/row/dbRoom.ts , @src/shared/room/types/roomFile.ts , @src/client/ui/components/panel/customizeRoomPanel.tsx , @src/client/ui/components/form/destinationChooserForm.tsx

## Ownership
- Each Member gets exactly one Regular room at sign-up (see [authentication.md](authentication.md)). The create request is refused if the user already owns one.
- Ownership is recorded on both the room and the user. Permission checks read the user's side through `RoomValidationUtil`.
- Owning a room does not control who may build in it. Anyone may build in a Regular room outside its restricted zones. The owner is the room's superuser: they choose its texture pack and lighting, lay its restricted zones, and manage its doors and labels.

## Room settings
- **Texture pack and lighting** share one HTTP route, and every request names its target room. Allowed callers are the room's owner, or an admin targeting a hub. Everyone else is refused.
- **Restricted zones** are drawn in room settings too, but are stored as volumes among the room's objects, so they go by object signals instead (see [restricted_zone.md](../gameplay/restricted_zone.md#drawing-zones)).

## Room files
An admin who is the room's superuser can save the room to a file on their own machine, and load one over it.

- **`RoomFile`** is a versioned stored format: a signature, the room's contents exactly as they are stored (voxels, then the objects that persist), then its texture pack and `RoomPrefs`. It names no room, so any room can take it.
- A file holds those bytes gzipped. One holding them plain is read as well.
- Single-player rooms ship as room files too, made in the room editor (see [single_player_mode.md](single_player_mode.md#rooms)).
- **Saving** is done by the client, from its own copy of the room.
- **Loading** is an HTTP route that takes the file as its body, and only for the room the caller is in. Anything but one whole file this build can read is refused. Older contents are converted as they are read, by the voxel and object formats' own versions.
- The server overwrites the room **in place**, one file at a time:
  - Its users are told first, by a socket event sent at once rather than with the next signal batch, and wait as they would for a lost connection. Each is then sent the whole room again, and whatever was queued for them before it is dropped.
  - Players are not part of a file. They stay in the room, and each arrives again behind a door (see [room_entrance.md](../geometry/room_entrance.md)).
  - The texture pack and atmosphere are the file's. The join priority stays the room's own, since it is the room's place among the hubs.
  - Settings are stored first, because nothing retries that write and its failure must leave the room untouched. Contents are stored next, and a failed save stays dirty for the auto-save.
- A client changes rooms one at a time, since a room sent this way can arrive while another is still loading.

## Room list
The room list (`DestinationChooserForm`) is for a room's superuser choosing a door destination (see [room_entrance.md](../geometry/room_entrance.md)), not for travel. It lists only hubs, so doors can never lead strangers into private rooms. Entering a specific room either succeeds or is refused with a reason (see [room_population.md](room_population.md)).
