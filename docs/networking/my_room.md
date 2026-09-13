# "My Room" Flows

Reference: @src/server/networking/router/api/roomRouter.ts , @src/server/room/serverRoomManager.ts , @src/server/db/types/row/dbRoom.ts , @src/client/ui/components/panel/customizeRoomPanel.tsx , @src/client/ui/components/form/destinationChooserForm.tsx

## Ownership
- Each Member gets exactly one Regular room at sign-up (see [authentication.md](authentication.md)). The create request is refused if the user already owns one.
- Ownership is recorded on both the room and the user. Permission checks read the user's side through `RoomValidationUtil`.
- Owning a room does not control who may build in it. Anyone may build in a Regular room outside its restricted zones. The owner is the room's superuser: they choose its texture pack and lighting, and draw its restricted zones.

## Room settings
- **Texture pack and lighting** share one HTTP route, and every request names its target room. Allowed callers are the room's owner, or an admin targeting a hub. Everyone else is refused.
- **Restricted zones** are part of the room's contents, so they sync over sockets like voxel edits (see [voxel_grid_update.md](voxel_grid_update.md)).

## Room list
The room list (`DestinationChooserForm`) is for admins choosing a door destination (see [admin.md](../gameplay/admin.md)), not for travel. It lists only hubs, so doors can never lead strangers into private rooms. Entering a specific room either succeeds or is refused with a reason (see [room_population.md](room_population.md)).
