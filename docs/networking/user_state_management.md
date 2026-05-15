# User State Management Flows

Reference: @src/server/db/types/row/dbUser.ts , @src/server/db/types/row/dbRoom.ts , @src/shared/room/types/roomRuntimeMemory.ts , @src/shared/room/types/roomChangedSignal.ts , @src/server/sockets/socketsServer.ts , @src/client/networking/client/socketsClient.ts , @src/server/room/serverRoomManager.ts , @src/server/user/serverUserManager.ts , @src/server/user/util/userCommandUtil.ts , @src/server/sockets/types/socketUserContext.ts

## Where user state lives

- **DBUser** — per-user, persistent. Holds `lastRoomID`, `playerMetadata`, `tutorialStep`, account info (`userName`, `email`, `userType`), and bookkeeping (`loginCount`, `lastLoginAt`, etc.). `playerMetadata` follows the user across rooms; it is not per-room.
- **DBRoom** — per-room, persistent. Holds `ownerUserID`, `ownerUserName`, `texturePackPath`, and `editors[]`, a denormalized list of `{userID, userName, email}` entries (so listing editors in the UI never needs an extra DBUser join). The product invariant is that `userName`/`email` never change after account creation, so the denormalized snapshot does not drift.
- **No `UserGameplayState` aggregate.** Earlier versions of the server bundled position, direction, role, and metadata into a single "gameplay state" snapshot that was saved on disconnect and loaded on connect. That abstraction is gone — players always spawn at `ENTRANCE_POSITION`, user role is derived from `DBRoom`, and `lastRoomID` / `playerMetadata` are written to `DBUser` directly. See `ServerUserManager` and `ServerRoomManager`.

## When the user moves from one room to another without reloading the game page
1. The client sends a `RequestRoomChangeSignal` to the server and blocks further room change requests until the current one completes.
2. The server removes the user from the previous room (despawning player objects, flushing playerMetadata to DBUser if `savePlayerMetadata` is requested) and loads the target room (from cache or Firestore).
3. The server places the user at `ENTRANCE_POSITION` (fixed entrance) and restores `playerMetadata` from the in-memory disconnect buffer or `DBUser` (see "Player Metadata Restoration" below).
4. The server writes the new `lastRoomID` to `DBUser` (fire-and-forget) and unicasts a `RoomChangedSignal` to the client.

## When the user opens "/" without a room ID in the URL
1. The standard authentication and socket connection flow runs (see `authentication.md`).
2. Since no `targetRoomID` is specified, the server falls back to `user.lastRoomID` (read from DBUser). If that room doesn't exist, it falls back to a Hub room.
3. The server unicasts a `RoomChangedSignal` to the client, which initializes the game.

## When the user opens "/:roomID" with a room ID in the URL
1. The standard authentication and socket connection flow runs with the URL-specified room ID.
2. The server attempts to join the user to the specified room. If that room doesn't exist, it falls back to a Hub room.
3. The server unicasts a `RoomChangedSignal` to the client, which initializes the game.

## When the user closes the page and reopens it
1. On disconnect, `ServerUserManager.removeUserFromRoom` snapshots the latest `playerMetadata` synchronously into the in-memory `recentDisconnectMetadata` buffer, then kicks off the asynchronous `DBUserUtil.savePlayerMetadata` write.
2. On reconnect, the new connection consults `recentDisconnectMetadata` first; if the buffer is empty, the server falls back to `DBUser.playerMetadata`. Either way, the new player object inherits the latest metadata.

## When the user refreshes the page
1. Depending on timing, the new socket may connect before or after the old socket's disconnect fires. Either way, the metadata bridge is the same single mechanism — `ServerUserManager.recentDisconnectMetadata`, populated synchronously by the old session's `removeUserFromRoom` (before the `DBUser` write begins) and consumed by the new session's `changeUserRoom`.
    - **Case A — New socket connects first**: the old socket is still registered, so `SocketsServer` proactively evicts it by calling `changeUserRoom(oldContext, undefined, …)`. That eviction's `removeUserFromRoom` populates `recentDisconnectMetadata`. The old socket's later disconnect handler is a no-op (it sees it has already been replaced).
    - **Case B — Old socket disconnects first**: the disconnect handler already ran `removeUserFromRoom`, which populated `recentDisconnectMetadata`. The new connection needs no special handling.
2. In both cases the new socket's `changeUserRoom` consumes the buffered snapshot (falling back to `DBUser.playerMetadata`). There is no separate `cachedPlayerMetadata` path — the two orderings converge on the one buffer.
3. `lastRoomID` is already on `DBUser` (it was written when the user originally joined the room), so the new socket sees the same room without any extra cache.

## When the user duplicates the current browser tab
1. The server detects a duplicate user (same userID already in `socketUserContexts`), captures `playerMetadata` from the existing player object, disconnects the old socket (redirecting it to an error page), and proceeds with the new connection.
2. The new tab joins the same room and rebuilds the player object with the captured metadata.

## When the server crashes unexpectedly
1. All in-memory state (including the `recentDisconnectMetadata` buffer) is lost. Clients attempt automatic reconnection.
2. The last successful `DBUser.playerMetadata` and `DBUser.lastRoomID` writes are the recovery point. Anything in the in-memory buffer is gone.

## When the server undergoes a graceful shutdown
1. `SocketsServer.saveAndDisconnectAllUsers` calls `ServerRoomManager.saveAllUsersPlayerMetadata`, which batches a `DBUserUtil.saveMultipleUsersPlayerMetadata` query for every connected user.
2. Each user is then routed out of their room (no DB write — already flushed) and disconnected.
3. Clients detect the server-initiated disconnect, poll `/` until the server responds, then reload and read state from DBUser.

## User role resolution
A user's role within a room is derived (NOT stored separately) at room-join time inside `ServerRoomManager.changeUserRoom`:
1. **Owner** — if `room.ownerUserID === user.id`.
2. **Editor** — if the user's id appears in the room's `editors[]` list (loaded from DBRoom on room load, cached in-memory as `ServerRoomManager.editorsByRoomID`).
3. **Visitor** — default.

When the room owner appoints or revokes an editor via `/api/room/set_room_user_role`, the server:
1. Calls `ServerRoomManager.setRoomEditor` / `removeRoomEditor`, which updates `DBRoom.editors` (and the in-memory cache if the room is loaded).
2. Calls `ServerUserManager.syncUserRoleInMemory`, which updates the per-user runtime role map and multicasts a `SetUserRoleSignal` to everyone in the room.

If the target user is offline at the time, the multicast is a no-op for them; their role will take effect on their next room join (since `changeUserRoom` re-derives the role from DBRoom).

## Player Metadata Restoration
When a user joins a room, `ServerRoomManager.changeUserRoom` resolves `playerMetadata` with the following priority:
1. **`ServerUserManager.recentDisconnectMetadata` buffer** (synchronously populated by the previous session's `removeUserFromRoom`). Bridges the gap where the disconnect's `DBUser` write has not yet landed.
2. **`DBUser.playerMetadata`** (the persistent fallback — the buffer was either never populated, or already evicted by TTL).
3. **Empty object** (brand-new user with no chat history).

## In-Memory Buffers (server-only)
- **`ServerUserManager.recentDisconnectMetadata`**: `{[userID]: {metadata, timestamp}}`. Populated synchronously at disconnect, consumed on the matching reconnect. Periodically swept (TTL: 30 seconds) by the same loop that detects stale sockets. Required to close the race window where the disconnect's `DBUserUtil.savePlayerMetadata` write has not yet landed by the time the new socket reads `DBUser`.
- **`ServerRoomManager.editorsByRoomID`**: `{[roomID]: RoomEditor[]}`. Populated when a room is loaded (from `DBRoom.editors`), refreshed whenever `setRoomEditor`/`removeRoomEditor` succeeds, dropped when the room is unloaded.

## Stale Socket Detection & Cleanup
A periodic check runs every 5 seconds to detect sockets where `socket.connected === false` but the disconnect handler may not have fired (e.g. due to abrupt browser crash or swallowed errors). Stale sockets are given a 5-second grace period before cleanup, which removes the user from their room and deletes their context. The same loop also evicts `recentDisconnectMetadata` entries past the TTL.

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
