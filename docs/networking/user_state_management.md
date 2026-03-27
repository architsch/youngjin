# User State Management Flows

Reference: @src/server/user/types/userGameplayState.ts , @src/shared/room/types/roomRuntimeMemory.ts , @src/shared/room/types/roomChangedSignal.ts , @src/server/sockets/socketsServer.ts , @src/client/networking/client/socketsClient.ts

## When the user moves from one room to another without loading a new "/mypage"
1. The client sends a `RequestRoomChangeSignal` to the server and blocks further room change requests until the current one completes.
2. The server removes the user from the previous room (despawning player objects and cleaning up runtime memory), loads the target room (from cache or Firestore), restores the user's position/direction/metadata, and adds the user to the new room.
3. The server unicasts a `RoomChangedSignal` to the client, which unloads the previous room and loads the new one.

## When the user opens "/mypage" without a room ID in the URL
1. The standard authentication and socket connection flow runs (see `authentication.md`).
2. Since no `targetRoomID` is specified, the server falls back to `user.lastRoomID`. If that room doesn't exist, it falls back to a Hub room.
3. The server unicasts a `RoomChangedSignal` to the client, which initializes the game.

## When the user opens "/mypage" with a room ID in the URL
1. The standard authentication and socket connection flow runs with the URL-specified room ID.
2. The server attempts to join the user to the specified room. If that room doesn't exist, it falls back to a Hub room.
3. The server unicasts a `RoomChangedSignal` to the client, which initializes the game.

## When the user closes the page and reopens it
1. On disconnect, the server caches the user's gameplay state briefly and saves it to Firestore.
2. On reconnect, the server restores from the cached state if available (avoiding a race condition with the DB write), otherwise from the DB.

## When the user refreshes the page
1. Depending on timing, the new socket may connect before or after the old socket's disconnect fires.
    - **New socket connects first**: The server captures the old session's gameplay state from runtime memory, removes the old session, and restores state for the new connection.
    - **Old socket disconnects first**: The server caches the gameplay state on disconnect, then restores from cache when the new socket connects.
2. In both cases, the user's room and position are preserved seamlessly.

## When the user duplicates the current browser tab
1. The server detects a duplicate user, captures the existing session's gameplay state, and disconnects the old socket (redirecting it to an error page).
2. The new tab's connection proceeds with the captured gameplay state, preserving room and position.

## When the server crashes unexpectedly
1. All in-memory state is lost. Clients attempt automatic reconnection.
2. If reconnection fails, the client reloads the page. User state is restored from the last successful DB save.

## When the server undergoes a graceful shutdown
1. The server saves all dirty rooms and connected users' gameplay states to Firestore, then disconnects all sockets.
2. Clients detect the server-initiated disconnect, poll the server URL until it responds, then reload and restore from the DB.
