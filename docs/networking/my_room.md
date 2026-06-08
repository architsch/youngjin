# "My Room" Flows

Reference: @src/client/ui/components/form/roomListForm.tsx , @src/client/ui/components/form/configureMyRoomForm.tsx , @src/server/networking/router/api/roomRouter.ts , @src/server/room/serverRoomManager.ts , @src/server/db/types/row/dbRoom.ts , @src/server/user/serverUserManager.ts

## Editor storage model
A room's editor list lives directly on `DBRoom` as a denormalized list of editor identities. Because the product invariant is that a user's name/email never change after account creation, this snapshot is safe — listing editors does not require a separate per-user lookup.

The DB-internal editor shape (`DBRoomEditor`) carries the user id; the client only ever receives a trimmed projection (`RoomEditor`) without it, and the room router maps between the two at the API boundary. While a room is loaded, `ServerRoomManager` keeps an in-memory mirror of the editor list in sync with `DBRoom`.

A room may have at most a fixed maximum number of editors — an anti-abuse bound, so an owner cannot inflate database cost by stuffing the list.

## Create / Visit My Room
1. The user opens the Rooms popup and clicks Visit on the pinned "My Room" entry.
2. The client checks whether the user already owns a room. If not, it asks the server to create one (with an empty editor list) and associates it with the user; if so, it uses the existing room.
3. The client requests a room change to move the user into their room.

## Copy Room URL
The client computes the room URL locally and copies it to the clipboard. No server request is made.

## Change Texture Pack
The client sends the new texture pack to the server, which verifies the user owns a room and persists the change.

## Add Editor
1. The client sends the target username and the Editor role to the server.
2. The server verifies the requester owns the room, looks up the target user, and records the new editor on `DBRoom` (refreshing the in-memory mirror if the room is loaded).
3. If the room is already at the editor limit and the target is not already an editor, the request is rejected and the client shows a "maximum number of editors" notice. (Re-adding an already-present editor is never blocked by the limit.)
4. On success, the server updates the runtime role map and notifies everyone in the room of the new role.

## Remove Editor
1. The client sends the target username with the Visitor role.
2. The server strips the entry from `DBRoom` and the in-memory mirror.
3. The server updates the runtime role map and notifies everyone in the room of the change to Visitor.

## Get Room Editors
1. The client requests the editor list for the user's owned room.
2. The server verifies the requester is a registered user who owns a room, then returns the editors as the trimmed client-facing projection (serving the in-memory mirror when available, otherwise reading `DBRoom`). It responds with an error if the user is not found or does not own a room.

## User Role Resolution at Room Join
When a user joins a room, the server derives their role rather than reading it from a separate table:
1. **Owner** if they own the room.
2. **Editor** if they appear in the room's editor list.
3. **Visitor** otherwise.

If a user is not in the room when their role changes, they won't be notified in real time, but the change still takes effect on their next join because the editor entry already lives on `DBRoom`.
