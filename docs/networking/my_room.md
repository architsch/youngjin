# "My Room" Flows

Reference: @src/client/ui/components/form/roomListForm.tsx , @src/client/ui/components/panel/customizeRoomPanel.tsx , @src/server/networking/router/api/roomRouter.ts , @src/server/room/serverRoomManager.ts , @src/server/db/types/row/dbRoom.ts , @src/server/user/serverUserManager.ts

## Who a room answers to
A member is given exactly one room of his own when he signs up, and that room is the only one in the game that answers to a particular person. Ownership is recorded on both sides of the link — the room names its owner, and the owner names his room — and every permission check reads the second of the two, so whether a room answers to somebody — which decides who may decorate it and draw its restricted zones — is a question with the same answer wherever and whenever it is asked. Owning a room is not what lets anybody build in it: a Regular room is open to whoever stands in it, outside the zones its owner keeps to himself. There is no standing a room hands out and no roll it keeps: see `RoomValidationUtil`.

## Create My Room
A member's room is opened for them when they sign up, and there is at most one of them per user — the request is refused for a user who already owns one. A room named as a specific destination is entered outright or refused outright, rather than the user being diverted elsewhere; they stay in the room they were in and are shown why. See [room_population.md](room_population.md#entering-a-specific-room).

The room list is no longer a way to travel: it is where an admin points a door (see [admin.md](../gameplay/admin.md)), and a player reaches a room by walking through a door that leads to it. It lists hubs and nothing else — a hub is the world's public fabric, whereas a regular room belongs to one person, and wiring a door into one would hand strangers a way in that its owner never agreed to.

## Change Texture Pack
A room already comes with a texture pack, drawn when it was generated along with the textures its contents are finished in (see [room_generation.md](../geometry/room_generation.md)). Changing it re-skins those contents: the client sends the new texture pack to the server, which persists the change.

One route serves two callers, since which room is being re-skinned is the only thing that differs between them — and re-lighting a room (see [lighting.md](../graphics/lighting.md)) is settled the same way, the two being one act of decorating.

**Every such request names the room it means**, and whether the caller may decorate it is then a question about that room rather than about how it was addressed. It has two affirmative answers: a room the caller owns, and a hub asked for by an admin — a room nobody owns, and so one the ownership check could never reach. Everything else is refused, which covers a member reaching for a hub, an admin reaching for somebody else's private room, and a guest, who owns nothing, reaching for anything at all.

## Restricted Zones
The room's settings panel is also where its owner draws its **restricted zones** — the stretches of the room he keeps to himself, which nobody else may change (see [restricted_zone.md](../gameplay/restricted_zone.md)). Unlike everything above, these do not travel over an HTTP route: they are part of the room's contents rather than of its record, and they are synced the way a voxel edit is (see [voxel_grid_update.md](voxel_grid_update.md)).
