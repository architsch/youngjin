# User State Management Flows

Reference: @src/server/user/types/userGameplayState.ts , @src/shared/room/types/roomRuntimeMemory.ts , @src/shared/room/types/roomChangedSignal.ts , @src/server/sockets/sockets.ts , @src/client/networking/client/socketsClient.ts

## When the user moves from one room to another without loading a new "/mypage"
1. The client sends a `RequestRoomChangeSignal` (with the target room's ID) to the server via `SocketsClient.tryEmitRequestRoomChangeSignal`. This also starts a client-side `roomChange` process that blocks further room change requests until the current one completes.
2. The server receives the `RequestRoomChangeSignal` and calls `ServerRoomManager.changeUserRoom` with the target room ID.
3. `ServerRoomManager.changeUserRoom` removes the user from the previous room (despawning the user's player object and cleaning up the room's runtime memory), without saving gameplay state to the DB (since the user is staying connected and state is still in runtime memory).
4. `ServerRoomManager.changeUserRoom` loads the target room (from in-memory cache if available, otherwise from Firestore), restores the user's position/direction/metadata (from DB lookup, or defaults if none exists), and adds the user to the new room.
5. The server unicasts a `RoomChangedSignal` (which bundles the room's `RoomRuntimeMemory` and the user's current role) to the client.
6. The client receives the `RoomChangedSignal` and calls `App.onRoomChangedSignalReceived`, which unloads the previous room (graphics, physics, objects) and loads the new room from the received data. The client-side `roomChange` process then ends.

## When the user opens "/mypage" without including a room's ID in its URL
1. The user sends a `/mypage` HTTP request to the server.
2. The server authenticates the user (via `UserIdentificationUtil`) and returns the `/mypage` HTML page with `targetRoomID` set to an empty string. This page, when loaded, fetches and runs the client app's bundle.
3. The client calls `SocketsClient.init`, which opens a Socket.IO connection with `targetRoomID: ""` in the handshake auth.
4. The server authenticates the socket (via `authMiddleware`) and establishes the connection.
5. The server determines which room the user should join. Since `targetRoomID` is empty, it falls back to `user.lastRoomID` (the room the user was last in, as stored in the DB).
6. The server calls `ServerRoomManager.changeUserRoom` with the preferred room ID.
    - If the room exists and the user successfully joins it, the server unicasts a `RoomChangedSignal` to the client.
    - If the room does not exist (or joining fails), the server falls back to a Hub room (checked in-memory first, then via Firestore query) and joins the user to that room instead.
7. The client receives the `RoomChangedSignal` and calls `App.onRoomChangedSignalReceived`, which loads the room and initializes the game (graphics, physics, objects) based on the received data. The client-side `roomChange` process then ends.

## When the user opens "/mypage" with a room's ID in its URL
1. The user sends a `/mypage/:roomID` HTTP request to the server.
2. The server authenticates the user (via `UserIdentificationUtil`) and returns the `/mypage` HTML page with `targetRoomID` set to the room ID from the URL. This page, when loaded, fetches and runs the client app's bundle.
3. The client calls `SocketsClient.init`, which opens a Socket.IO connection with `targetRoomID: "<roomID>"` in the handshake auth.
4. The server authenticates the socket (via `authMiddleware`) and establishes the connection.
5. The server determines which room the user should join. Since `targetRoomID` is non-empty, it takes priority over `user.lastRoomID`.
6. The server calls `ServerRoomManager.changeUserRoom` with the URL-specified room ID.
    - If the room exists and the user successfully joins it, the server unicasts a `RoomChangedSignal` to the client.
    - If the room does not exist (or joining fails), the server falls back to a Hub room (checked in-memory first, then via Firestore query) and joins the user to that room instead.
7. The client receives the `RoomChangedSignal` and calls `App.onRoomChangedSignalReceived`, which loads the room and initializes the game (graphics, physics, objects) based on the received data. The client-side `roomChange` process then ends.

## When the user closes the page and reopens it
1. When the page is closed, the socket disconnects.
2. The server's `disconnect` handler fires:
    1. It captures the user's current gameplay state (position, direction, metadata, role, room ID) from runtime memory and caches it in `recentDisconnectGameplayStates` (keyed by user ID, expires after 30 seconds).
    2. It removes the user from `ServerUserManager` and calls `ServerRoomManager.changeUserRoom(undefined)` to remove the user from the room (saving gameplay state to the DB).
3. When the user reopens the page, the standard `/mypage` or `/mypage/:roomID` flow begins (see above sections).
4. During socket authentication, the server loads the user's data from Firestore (including `lastRoomID` and other persisted state).
5. If the new connection arrives within 30 seconds of the disconnect, the server finds the cached gameplay state in `recentDisconnectGameplayStates` and passes it to `ServerRoomManager.changeUserRoom` as `cachedGameplayState`. This allows position restoration even if the DB write from step 2 hasn't completed yet.
6. If the new connection arrives after 30 seconds, the cached state has expired, and position restoration falls back to the DB lookup (which should have completed by then).

## When the user refreshes the page
1. The browser navigates away and reconnects. Depending on timing, one of two cases occurs:
    - **Case A: New socket connects BEFORE the old socket's disconnect fires** (common on low-latency environments).
        1. The server detects a duplicate user via `ServerUserManager.hasUser(user.id)`.
        2. The server captures the old session's gameplay state directly from runtime memory (no DB lookup needed).
        3. The server removes the old user from `ServerUserManager` and from its room, then sends a `forceRedirect` to the old socket (which is harmless since the page is already navigating away) and disconnects it.
        4. The server proceeds with the new connection, passing the captured gameplay state as `cachedGameplayState` to `ServerRoomManager.changeUserRoom`. The user rejoins the same room at the same position.
    - **Case B: Old socket's disconnect fires BEFORE the new socket connects** (common on higher-latency environments).
        1. The old socket's `disconnect` handler caches the gameplay state in `recentDisconnectGameplayStates` and saves it to the DB.
        2. The new socket connects. The server finds the cached gameplay state and restores from it (avoiding a potential race condition with the DB write).
2. In both cases, the user's room and position are preserved seamlessly. The client receives a `RoomChangedSignal` and initializes the game as usual.

## When the user duplicates the current browser tab
1. The new tab opens `/mypage` (or `/mypage/:roomID`), which triggers a new socket connection.
2. The server detects a duplicate user via `ServerUserManager.hasUser(user.id)` (since the original tab is still connected).
3. The server captures the existing session's gameplay state from runtime memory.
4. The server removes the old user from `ServerUserManager` and from its room, then sends a `forceRedirect` to the old socket, redirecting the original tab to an "auth-duplication" error page. The old socket is then disconnected.
5. The server proceeds with the new connection (from the duplicated tab), passing the captured gameplay state as `cachedGameplayState` to `ServerRoomManager.changeUserRoom`. The user joins the room at the same position as before.
6. The client in the new tab receives a `RoomChangedSignal` and initializes the game as usual.

## When the server crashes unexpectedly
1. All in-memory state (runtime memories, cached gameplay states, socket contexts) is lost instantly. No graceful shutdown logic runs.
2. Clients detect the disconnection via Socket.IO's ping/pong timeout mechanism. `SocketsClient` attempts automatic reconnection (up to 20 attempts with exponential backoff).
3. If all reconnection attempts are exhausted, the client reloads the page (`window.location.reload()`).
4. When the server comes back up and the client reconnects (either via auto-reconnect or page reload), user state is restored from the last successful DB save. Any gameplay state changes that occurred after the last DB save are lost.

## When the server undergoes a graceful shutdown and the new one starts
1. The server receives a `SIGTERM` or `SIGINT` signal (e.g. from PM2 during deployment).
2. The server's `gracefulShutdown` handler runs:
    1. It saves all dirty rooms to Firestore via `ServerRoomManager.saveRooms(true)`.
    2. It calls `Sockets.saveAndDisconnectAllUsers()`, which:
        1. Saves all connected users' gameplay states to Firestore in a batch via `ServerRoomManager.saveAllUserGameplayStates`.
        2. Removes each user from their room and force-disconnects their socket.
3. The server closes the HTTP server (with a 10-second hard timeout to prevent hanging).
4. Clients detect the server-initiated disconnect (`reason === "io server disconnect"`). Since Socket.IO does not auto-reconnect for server-initiated disconnects, the client calls `pollServerAndReload`, which periodically sends HEAD requests to the server URL until it responds.
5. Once the new server is up and responds to the poll, the client reloads the page, triggering the standard `/mypage` initialization flow. User state is restored from the DB (which was saved in step 2).
