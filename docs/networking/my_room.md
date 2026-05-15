# "My Room" Flows

Reference: @src/client/ui/components/form/roomListForm.tsx , @src/client/ui/components/form/configureMyRoomForm.tsx , @src/server/networking/router/api/roomRouter.ts , @src/server/room/serverRoomManager.ts , @src/server/db/types/row/dbRoom.ts , @src/server/user/serverUserManager.ts

## Editor storage model
A room's editor list lives directly on `DBRoom` as a denormalized array of `{userID, userName, email}` entries (the `DBRoomEditor` type — see `DBRoom.editors`). Because the product invariant is that a user's `userName`/`email` never change after account creation, the denormalized snapshot is safe — listing editors does not need to follow up with N `DBUser` lookups.

`DBRoomEditor` is the server/DB-internal shape (it carries `userID` plus an index signature for `DBColumnType` compatibility). The client-facing projection is the separate, trimmed `RoomEditor` type (`{userName, email}`) in `shared/user/types`; the room router maps `DBRoomEditor` → `RoomEditor` at the API boundary.

The in-memory cache `ServerRoomManager.editorsByRoomID` mirrors the DB list while the room is loaded; mutations go through `ServerRoomManager.setRoomEditor` / `removeRoomEditor`, which keep DB and cache in sync.

A room may have at most `MAX_ROOM_EDITORS` (`serverConstants.ts`) editors. This is an anti-abuse bound: without it, an owner could inflate DB read/write cost by stuffing the list.

## Create/Visit My Room
1. The user opens the Rooms popup and clicks Visit on the "My Room" pinned entry.
2. The client checks whether the user already owns a room:
    - If not: the client calls `RoomAPIClient.createRoom()`, the server creates the room (with `editors: []`) and associates it with the user, and the client receives the new room ID.
    - If yes: the client uses the existing room ID directly.
3. The client emits a `RequestRoomChangeSignal` to move the user into their room.

## Copy Room URL
1. The client computes the room URL locally and copies it to the clipboard. No server request is made.

## Change Texture Pack
1. The client sends the new texture pack path to the server via `RoomAPIClient.changeRoomTexture()`.
2. The server verifies the user owns a room and persists the new texture pack path.

## Add Editor
1. The client sends the target username and Editor role to the server via `RoomAPIClient.setRoomUserRole()`.
2. The server verifies the requester owns the room, looks up the target user, and calls `ServerRoomManager.setRoomEditor(roomID, {userID, userName, email})`. This persists the new editor entry on `DBRoom.editors` and refreshes the in-memory `editorsByRoomID` cache if the room is loaded.
3. `setRoomEditor` returns `"success"`, `"limit-reached"`, or `"error"`. If the room is already at `MAX_ROOM_EDITORS` and the target is not already an editor, it returns `"limit-reached"` and the route responds **409**; the client shows a "maximum number of editors" notification. (Refreshing an already-present editor entry is never blocked by the limit.)
4. On success, `ServerUserManager.syncUserRoleInMemory(targetUserID, roomID, Editor)` updates the runtime role map and multicasts a `SetUserRoleSignal` to everyone in the room.

## Remove Editor
1. The client sends the target username with a Visitor role to the server via `RoomAPIClient.setRoomUserRole()`.
2. The server calls `ServerRoomManager.removeRoomEditor(roomID, targetUserID)`, which strips the entry from `DBRoom.editors` and the in-memory cache.
3. `ServerUserManager.syncUserRoleInMemory` updates the runtime role map and multicasts a `SetUserRoleSignal` with the Visitor role.

## Get Room Editors
1. The client requests the list of editors for the user's owned room via `RoomAPIClient.getRoomEditors()` (POST `/api/room/get_room_editors`).
2. The server verifies the requester is a registered user (Member or Admin) and owns a room. If so, it calls `ServerRoomManager.getRoomEditors(roomID)` (which serves the in-memory cache when available, or reads `DBRoom.editors` directly) and returns the entries projected down to `{userName, email}`. Returns 404 if the user is not found, 403 if the user doesn't own a room.

## User Role Resolution at Room Join
When a user joins a room, `ServerRoomManager.changeUserRoom` derives the user's role (rather than looking it up in a separate ACL table):
1. **Owner** if `room.ownerUserID === user.id`.
2. **Editor** if the user's id appears in `editorsByRoomID[roomID]`.
3. **Visitor** otherwise.

If the target user is not currently in the room when a role change is applied, they won't receive `SetUserRoleSignal` in real time, but the change takes effect on their next room join because the editor entry is already on DBRoom.editors.
