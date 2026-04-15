# "My Room" Flows

Reference: @src/client/ui/components/form/visitMyRoomForm.tsx , @src/client/ui/components/form/configureMyRoomForm.tsx , @src/server/networking/router/api/roomRouter.ts , @src/server/user/serverUserManager.ts

## Create/Visit My Room
1. The client checks whether the user already owns a room:
    - If not: the client calls `RoomAPIClient.createRoom()`, the server creates the room and associates it with the user, and the client receives the new room ID.
    - If yes: the client uses the existing room ID directly.
2. The client emits a `RequestRoomChangeSignal` to move the user into their room.

## Copy Room URL
1. The client computes the room URL locally and copies it to the clipboard. No server request is made.

## Change Texture Pack
1. The client sends the new texture pack path to the server via `RoomAPIClient.changeRoomTexture()`.
2. The server verifies the user owns a room and persists the new texture pack path.

## Add Editor
1. The client sends the target username and Editor role to the server via `RoomAPIClient.setRoomUserRole()`.
2. The server verifies the requester owns the room, looks up the target user, persists the Editor role, and broadcasts a `SetUserRoleSignal` to all clients in the room.

## Remove Editor
1. The client sends the target username with a Visitor role to the server via `RoomAPIClient.setRoomUserRole()`.
2. The server applies the same logic as Add Editor, but sets the role to Visitor (revoking editor access), and broadcasts a `SetUserRoleSignal`.

## Get Room Editors
1. The client requests the list of editors for the user's owned room via `RoomAPIClient.getRoomEditors()` (POST `/api/room/get_room_editors`).
2. The server verifies the requester is a registered user (Member or Admin) and owns a room. If so, it queries Firestore and returns an array of editors with `{userName, email}`. Returns 404 if the user is not found, 403 if the user doesn't own a room.

## User Role Synchronization
When a user role change is made (Add/Remove Editor), it is applied in two phases:
1. **Database phase**: The new role is persisted to Firestore via `DBUserRoomStateUtil.setUserRole()`.
2. **In-memory & broadcast phase**: `ServerUserManager.syncUserRoleInMemory()` updates the `userRoleByUserID` map, creates a `SetUserRoleSignal`, and multicasts it to all clients in the room.

Note: If the target user is not currently in the room, they won't receive the signal in real time — the role change takes effect from their next room join. The room owner always receives the "Owner" role regardless of database or cached values.
