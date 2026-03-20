# "My Room" Flows

Reference: @src/client/ui/components/form/visitMyRoomForm.tsx , @src/client/ui/components/form/configureMyRoomForm.tsx

## Create/Visit My Room
1. The client shows `VisitMyRoomForm`, prompting the user to confirm. When confirmed, the client checks `user.ownedRoomID`:
    - If the user does not yet own a room (`ownedRoomID` is empty):
        1. The client calls `RoomAPIClient.createRoom()`, which sends a POST request to `/room_api/create_room`.
        2. The server's `RoomRouter` verifies the user is a registered (non-guest) user who does not already own a room.
        3. The server creates the room via `DBRoomUtil.createRoom()` (with a default texture pack path) and associates it with the user via `DBUserUtil.setOwnedRoomID()`. It responds with the new `roomID`.
        4. The client updates `user.ownedRoomID` with the returned `roomID`, then emits a `RequestRoomChangeSignal` via `SocketsClient.tryEmitRequestRoomChangeSignal`.
    - If the user already owns a room (`ownedRoomID` is non-empty):
        1. The client directly emits a `RequestRoomChangeSignal` via `SocketsClient.tryEmitRequestRoomChangeSignal`, using the existing `ownedRoomID`.
2. The server receives the `RequestRoomChangeSignal` and calls `RoomManager.changeUserRoom()`, moving the user into their room.

## Copy Room URL
1. `ConfigureMyRoomForm` computes the room URL on the client as `${window.location.origin}/mypage/${roomID}`.
2. When the user clicks "Copy", `navigator.clipboard.writeText(roomURL)` copies the URL to the clipboard.
3. `notificationMessageObservable.set("Copied the URL!")` displays a notification. No server request is made.

## Change Texture Pack
1. The client sends the new `texturePackPath` to the server via `RoomAPIClient.changeRoomTexture()`, which sends a POST request to `/room_api/change_room_texture`.
2. The server's `RoomRouter` verifies the user is registered and owns a room. It retrieves the room via `DBRoomUtil.getRoomContent()` and persists the new texture URL via `DBRoomUtil.changeRoomTexturePackPath()`.
    - If the update succeeds: the server responds with 200 and the client shows a "Texture pack updated!" notification.
    - If the update fails: the server responds with an error status and the client shows a "Failed to update texture pack." notification.

## Add Editor
1. The client sends `{ targetUserName, userRole: Editor }` to the server via `RoomAPIClient.setRoomUserRole()`, which sends a POST request to `/room_api/set_room_user_role`.
2. The server's `RoomRouter` verifies the requester is registered and owns a room. It looks up the target user by `userName` via `DBSearchUtil.users.withUserName()`.
3. The server calls `DBUserRoomStateUtil.setUserRole()` to persist the Editor role for the target user, then calls `syncUserRoleInMemory()` to update the in-memory role map and broadcast a `SetUserRoleSignal` to all clients currently in the room.
    - If the update succeeds: the server responds with 200 and the client shows an "Editor added!" notification, then reloads the editor list.
    - If the update fails: the server responds with an error status and the client shows a "Failed to add editor." notification.

## Remove Editor
1. The client prompts the user for confirmation. If confirmed, it sends `{ targetUserName, userRole: Visitor }` to the server via `RoomAPIClient.setRoomUserRole()`, which sends a POST request to `/room_api/set_room_user_role`.
2. The server's `RoomRouter` applies the same logic as Add Editor, but sets the target user's role to Visitor, effectively revoking editor access.
3. The server calls `syncUserRoleInMemory()` to update the in-memory role map and broadcast a `SetUserRoleSignal` to all clients currently in the room.
    - If the update succeeds: the server responds with 200 and the client shows an "Editor removed!" notification, then reloads the editor list.
    - If the update fails: the server responds with an error status and the client shows a "Failed to remove editor." notification.
