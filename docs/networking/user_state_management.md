# User State Management Flows

Reference: @src/server/user/types/userGameplayState.ts , @src/shared/room/types/roomRuntimeMemory.ts , @src/shared/room/types/roomChangedSignal.ts , @src/server/sockets/socketsServer.ts , @src/client/networking/client/socketsClient.ts , @src/server/room/serverRoomManager.ts , @src/server/user/serverUserManager.ts , @src/server/user/util/userCommandUtil.ts , @src/server/sockets/types/socketUserContext.ts

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
2. Clients detect the server-initiated disconnect (via `"io server disconnect"` reason), poll the server URL with HEAD requests every 3 seconds until it responds, then reload and restore from the DB.

## Gameplay State Caching
Gameplay state consists of: last room ID, position (x, y, z), direction (dirX, dirY, dirZ), player metadata dictionary, user role in room, and session duration.

The server maintains two levels of cache for reconnection scenarios:
1. **In-memory cache** (`recentDisconnectGameplayStates`): Stores gameplay state on disconnect with a 30-second TTL. Purpose: handle the race condition where a new socket connects before the DB write from disconnect completes.
2. **Database (Firestore)**: Full gameplay state saved on room leave. Used as fallback when the in-memory cache has expired.

## Player Metadata Restoration
When a user joins a room, player metadata is restored with the following priority:
1. **Cached gameplay state** (from reconnection) — highest priority.
2. **Database** (from a previous session in the same room).
3. **Empty** (new player to this room).

## Stale Socket Detection & Cleanup
A periodic check runs every 5 seconds to detect sockets where `socket.connected === false` but the disconnect handler may not have fired (e.g. due to abrupt browser crash or swallowed errors). Stale sockets are given a 5-second grace period before cleanup, which removes the user from their room and deletes their context.

## Socket Heartbeat Configuration
The server uses aggressive heartbeat timing:
- **Ping interval**: 10 seconds (server sends ping).
- **Ping timeout**: 5 seconds (wait for pong before disconnecting).

If the client doesn't respond with a pong within 5 seconds, the socket auto-disconnects.

## Room Load Deduplication
When multiple users request the same room concurrently, the server deduplicates the load by tracking in-flight room load promises via a `pendingLoads` map. All requests for the same room await the same promise, preventing duplicate Firestore queries.

## Periodic Room Auto-Saving
The server runs a background save cycle every 3 seconds. A room is saved to Firestore only if:
- It is marked as "dirty" (has unsaved changes), AND
- The last save was more than 10 minutes ago (or a forced save is triggered).

Rooms are saved in batches of 5 to avoid overwhelming the database. When the last user leaves a room, the server saves it immediately, then re-checks if the room is still empty (in case a user joined during the save) before unloading it.

## Signal Batching & Throttling
Signals are not sent individually. Instead, they accumulate in pending arrays per signal type on each `SocketUserContext` and are batched together every 200ms via a `signalBatch` event. Each signal type has a `minClientToServerSendInterval` that throttles how frequently signals can be sent:
- `requestRoomChangeSignal`: 2000ms (prevents frequent DB queries).
- `userCommandSignal`: 1000ms (prevents frequent DB queries).
- Most other signals: 0ms (no throttling).

The server enforces rate limiting by rejecting signals that arrive sooner than their configured interval. The client retries up to 10 times with 200ms delays if the rate limit is not yet met.

## User Commands
The server supports an extensible command system via `userCommandSignal`. The client sends a message in the format `"<commandType> <arg1> <arg2>..."`, which the server parses and dispatches to the appropriate handler. Current commands:
- **`tutorialStep <step_number>`**: Updates the user's tutorial progress. Validates the step number and persists to Firestore. Rate-limited to 1000ms between signals.
