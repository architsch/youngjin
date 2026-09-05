# "My Room" Flows

Reference: @src/client/ui/components/form/roomListForm.tsx , @src/client/ui/components/form/configureMyRoomForm.tsx , @src/server/networking/router/api/roomRouter.ts , @src/server/room/serverRoomManager.ts , @src/server/db/types/row/dbRoom.ts , @src/server/user/serverUserManager.ts

## Who a room answers to
A member is given exactly one room of his own when he signs up, and that room is the only one in the game that answers to a particular person. Ownership is recorded on both sides of the link — the room names its owner, and the owner names his room — and every permission check reads the second of the two, so being allowed to build in a room is a question with the same answer wherever and whenever it is asked. There is no standing a room hands out and no roll it keeps: see `RoomValidationUtil`.

## Create My Room
A member's room is opened for them when they sign up, and there is at most one of them per user — the request is refused for a user who already owns one. A room named as a specific destination is entered outright or refused outright, rather than the user being diverted elsewhere; they stay in the room they were in and are shown why. See [room_population.md](room_population.md#entering-a-specific-room).

The room list is no longer a way to travel: it is where an admin points a door (see [admin.md](../gameplay/admin.md)), and a player reaches a room by walking through a door that leads to it. It lists hubs and nothing else — a hub is the world's public fabric, whereas a regular room belongs to one person, and wiring a door into one would hand strangers a way in that its owner never agreed to.

## Copy Room URL
The client computes the room URL locally and copies it to the clipboard. No server request is made.

## Change Texture Pack
A room already comes with a texture pack, drawn when it was generated along with the textures its contents are finished in (see [room_generation.md](../geometry/room_generation.md)). Changing it re-skins those contents: the client sends the new texture pack to the server, which persists the change.

One route serves two callers, since which room is being re-skinned is the only thing that differs between them. Naming no room means "my own", and the requester must own one. Naming a room means an admin re-skinning a hub — a room nobody owns, and so a room the ownership check could never reach.

## Restricted Zones
The room's settings form is also where its owner draws its **restricted zones** — the stretches of the room he keeps to himself, which nobody else may change (see [restricted_zone.md](../gameplay/restricted_zone.md)). Unlike everything above, these do not travel over an HTTP route: they are part of the room's contents rather than of its record, and they are synced the way a voxel edit is (see [voxel_grid_update.md](voxel_grid_update.md)).
