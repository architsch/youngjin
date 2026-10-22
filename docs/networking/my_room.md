# "My Room" Flows

Reference: @src/server/networking/router/api/roomRouter.ts , @src/server/room/serverRoomManager.ts , @src/server/db/types/row/dbRoom.ts , @src/shared/room/types/roomFile.ts , @src/client/ui/components/panel/customizeRoomPanel.tsx , @src/client/graphics/preview/util/roomPreviewUtil.ts , @src/client/ui/components/form/destinationChooserForm.tsx

## Ownership
- Each Member gets exactly one Regular room at sign-up (see [authentication.md](authentication.md)), and each agent one on its first trip home, deleted along with the agent (see [agents.md](agents.md#identity)). The create request is refused if the user already owns one.
- Ownership is recorded on both the room and the user. Permission checks read the user's side through `RoomValidationUtil`.
- Owning a room does not control who may build in it. Anyone may build in a Regular room outside its restricted zones. The owner is the room's superuser: they choose its texture pack and lighting, lay its restricted zones, and manage its doors and labels.

## Room settings
- **Texture pack and lighting** go by HTTP routes that name their target room, under one rule: the room's owner, or an admin targeting a hub. Everyone else is refused. An agent changes its own room's by a tool, through the same `ServerRoomManager` calls (see [agents.md](agents.md#building)).
- **Restricted zones** are drawn in room settings too, but are stored as volumes among the room's objects, so they go by object signals instead (see [restricted_zone.md](../gameplay/restricted_zone.md#drawing-zones)).

## Room files
An admin who is the room's superuser can save the room to a file on their own machine, and load one over it.

- **`RoomFile`** is a versioned stored format: a signature, the room's contents exactly as they are stored (voxels, then the objects that persist), then its texture pack and `RoomPrefs`. It names no room, so any room can take it.
- The contents carry versions of their own; the file's version dates its settings, which carry none. An older file's settings are converted as it is read (`RoomFileVersionMigration`), as a stored room's are when it is loaded.
- A file holds those bytes gzipped. One holding them plain is read as well.
- Single-player rooms ship as room files too, made in the room editor, where the same buttons save its room and open a file in its place without the server (see [single_player_mode.md](single_player_mode.md#room-editor)).
- **Saving** is done by the client, from its own copy of the room.
- **Before loading**, the client reads the file itself and asks over a picture of the room it holds (`RoomPreviewUtil`, `RoomFilePreviewForm`), so nothing is sent until the admin has seen what would replace the room:
  - The room is drawn from outside and above, without perspective, off screen by the game's own renderer: in its own texture pack and its objects' own looks, but evenly lit rather than by its lamps.
  - A room with an upper floor is shown as two storeys apart, since the upper would hide the lower. Each is named, by a 2D canvas rather than the renderer, which would need a texture and a shader for the lettering.
  - Only faces turned toward the camera are drawn, and only the objects on them. Walls the view cuts through are capped.
  - It is an overview seen for a moment, so it is drawn cheaply rather than finely: at the layout's pixel density, not the screen's, and with unsmoothed edges.
  - Everything made for the picture is disposed of once it is read back. What it shares with the game stays the game's: the texture pack's texture, where the game has that pack loaded, and the materials of objects' parts, which keep a shader variant for it.
  - If the picture can't be drawn, the question is asked without it.
- **Loading** is an HTTP route that takes the file as its body, and only for the room the caller is in. Anything but one whole file this build can read is refused. Older contents are converted as they are read, by the voxel and object formats' own versions.
- The server overwrites the room **in place**, one file at a time:
  - Its users are told first, by a socket event sent at once rather than with the next signal batch, and wait as they would for a lost connection. Each is then sent the whole room again, and whatever was queued for them before it is dropped.
  - Players are not part of a file. They stay in the room, and each arrives again behind a door (see [room_entrance.md](../geometry/room_entrance.md)).
  - The texture pack and atmosphere are the file's. The join priority stays the room's own, since it is the room's place among the hubs.
  - Settings are stored first, because nothing retries that write and its failure must leave the room untouched. Contents are stored next, and a failed save stays dirty for the auto-save.
- A client changes rooms one at a time, since a room sent this way can arrive while another is still loading.

## Room list
The room list (`DestinationChooserForm`) is for a room's superuser choosing a door destination (see [room_entrance.md](../geometry/room_entrance.md)), not for travel. It lists only hubs, so no person's door leads strangers into a private room. An agent's door may lead to any room, and agents find rooms to visit in a directory of their own, people's rooms included (see [agents.md](agents.md#room-directory)). Entering a specific room either succeeds or is refused with a reason (see [room_population.md](room_population.md)).
