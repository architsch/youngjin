# User State Management Flows

Reference: @src/server/db/types/row/dbUser.ts , @src/server/db/types/row/dbRoom.ts , @src/server/sockets/socketsServer.ts , @src/client/networking/client/socketsClient.ts , @src/server/room/serverRoomManager.ts , @src/server/user/serverUserManager.ts , @src/server/sockets/types/socketUserContext.ts

> For how single-player rooms (e.g. the tutorial) differ from the multi-player flows described here — they are not registered as participants and never write a last-room — see [single_player_mode.md](single_player_mode.md). For the rules governing which room a user may enter and how many users a room holds, see [room_population.md](room_population.md).

## Where user state lives

- **`DBUser`** — per-user, persistent. Holds the user's last room, their player metadata, their single-player mode (see [single_player_mode.md](single_player_mode.md)), the features they have already been introduced to (see [ftue.md](ftue.md)), account info, and login bookkeeping. Player metadata follows the user across rooms; it is not per-room.
- **`DBRoom`** — per-room, persistent. Holds the owner, the texture pack, and the editor list (a denormalized list of editor identities, so listing editors in the UI never needs an extra user lookup). The product invariant is that a user's name/email never change after account creation, so the denormalized snapshot does not drift.
- **State is not bundled into a per-session snapshot.** Players always spawn at the designated entrance position, a user's role is derived from `DBRoom` at join time, and the last room and player metadata are written to `DBUser` directly.

## When the user moves from one room to another without reloading the game page
1. The client sends a room-change request and blocks further requests until the current one completes.
2. The server loads the target room (from cache or the database) and checks that it can take another player. If it cannot, the user is turned away and stays in their current room (see [room_population.md](room_population.md)).
3. The server removes the user from the previous room, despawning their player object and, when requested, flushing player metadata to `DBUser`.
4. The server places the user at the designated [entrance position](../geometry/room_entrance.md) and restores their player metadata (see "Player Metadata Restoration" below).
5. The server writes the new last room to `DBUser` and notifies the client that the room has changed.

## When the user opens "/" without a room ID in the URL
1. The standard authentication and socket connection flow runs (see [authentication.md](authentication.md)).
2. With no room specified, the server picks the target room by priority: the user's single-player room if their mode flag is set; otherwise their last room; otherwise a Hub room chosen by the [load balancer](room_population.md#picking-a-hub).
3. The server tells the client which room it joined, and the client initializes the game.

## When the user opens "/:roomID" with a room ID in the URL
1. The standard authentication and socket connection flow runs with the URL-specified room ID.
2. The server joins the user to that room, falling back to a Hub room if the room doesn't exist or has reached its player cap.
3. The server tells the client which room it joined, and the client initializes the game.

## When the user closes the page and reopens it
1. On disconnect, the server snapshots the user's latest player metadata synchronously into an in-memory buffer, then kicks off the asynchronous write to `DBUser`.
2. On reconnect, the new connection consults the in-memory buffer first; if it is empty, the server falls back to `DBUser`. Either way, the new player object inherits the latest metadata.

## When the user refreshes the page
The new socket may connect before or after the old socket's disconnect fires. Either way, the same in-memory metadata buffer bridges the two sessions: it is populated synchronously when the old session is torn down and consumed when the new session joins.
- **New socket connects first:** the server proactively evicts the still-registered old socket, and that eviction populates the buffer. The old socket's later disconnect is then a no-op.
- **Old socket disconnects first:** its disconnect already populated the buffer, so the new connection needs no special handling.

The last room is already on `DBUser` from when the user originally joined, so the refreshed session lands in the same room without any extra cache.

## When the user duplicates the current browser tab
The server detects that the same user is already connected, captures the player metadata from the existing player object, disconnects the old socket (redirecting it to an error page), and proceeds with the new connection. The new tab joins the same room and rebuilds the player object from the captured metadata.

## When the server crashes unexpectedly
All in-memory state (including the metadata buffer) is lost, and clients attempt to reconnect automatically. The last successful writes of player metadata and last room to `DBUser` are the recovery point; anything still only in memory is gone.

## When the server undergoes a graceful shutdown
The server batches a save of every connected user's player metadata, then routes each user out of their room (no further DB write needed) and disconnects them. Clients detect the server-initiated disconnect, wait for the server to come back, then reload and read their state from `DBUser`.

Waiting is the delicate part, because the reverse proxy in front of the app stays up while the app process behind it does not, and answers on its behalf with a gateway error. A response therefore proves only that the host is reachable, not that the app is back, so clients decide readiness from the *status* of the health route rather than from the mere arrival of a reply. This also requires the poll to be same-origin, since a cross-origin response carries no readable status.

The health route reports "not ready" for a process that is on its way out, as well as for one that is not yet listening. Both must count as unavailable: a client that reloaded into the outgoing process would only be disconnected again moments later. Clients keep polling (at a widening interval) for as long as the page is open, so the session recovers whenever the server does return.

## User role resolution
A user's role within a room is derived (not stored separately) at join time:
1. **Owner** — if the user owns the room.
2. **Editor** — if the user appears in the room's editor list (loaded from `DBRoom` and cached in memory while the room is loaded).
3. **Visitor** — otherwise.

When the owner appoints or revokes an editor, the server updates `DBRoom` (and the in-memory cache) and notifies everyone currently in the room of the role change. If the affected user is offline, the change simply takes effect on their next join, since the role is re-derived from `DBRoom` each time.

## Player Metadata Restoration
When a user joins a room, the server resolves their player metadata by priority:
1. **The in-memory disconnect buffer** — bridges the window where the previous session's `DBUser` write has not yet landed.
2. **`DBUser`** — the persistent fallback.
3. **Empty** — a brand-new user with no history.

## In-Memory Buffers (server-only)
- **Recent-disconnect metadata buffer** — keyed by user. Populated synchronously at disconnect and consumed on the matching reconnect, then swept after a short time-to-live. It closes the race window where the disconnect's `DBUser` write has not yet landed when the new socket reads `DBUser`.
- **Editor cache** — keyed by room. Populated from `DBRoom` when a room loads, refreshed when editors change, and dropped when the room unloads.

## Stale Socket Detection & Cleanup
A periodic check detects sockets that are no longer connected but whose disconnect handler never fired (e.g. an abrupt browser crash). Such sockets are cleaned up after a short grace period — removing the user from their room and discarding their context. The same loop evicts expired entries from the disconnect-metadata buffer.

## Socket Heartbeat
The server uses aggressive heartbeat timing, pinging clients frequently and disconnecting any socket that fails to respond within a short timeout, so dead connections are detected quickly.

## Room Load Deduplication
When multiple users request the same room concurrently, the server tracks the in-flight load and has all requests await the same result, so the room is loaded from the database only once.

## Periodic Room Auto-Saving
A background cycle saves rooms that are marked dirty, rate-limited so that a busy room is not written too often, and processed in batches to avoid overwhelming the database. When the last user leaves a room, the server saves it immediately and then unloads it (re-checking that it is still empty first, in case someone joined during the save).

## Signal Batching & Throttling
Signals are not sent one at a time. They accumulate per signal type on each connection and are flushed together on a fixed interval. Each signal type has a minimum send interval that throttles how often it may be sent; signals tied to expensive operations (such as room changes and user commands) are throttled more aggressively, while most are not throttled at all. The server rejects signals that arrive too soon, and the client retries a few times before giving up.

## User Commands
The server supports an extensible command system: the client sends a command string, which the server parses and dispatches to the matching handler. For example, the **finish-tutorial** command verifies the user is in the tutorial, then clears their single-player mode and persists it (see [single_player_mode.md](single_player_mode.md)); the **add-FTUE-element** command records that the user has been through one of the features the app introduces to first-time users (see [ftue.md](ftue.md)).

Because these commands mutate the user record, each handler updates the in-memory user alongside the write to `DBUser`: the same user object serves the rest of the socket session, so a handler that only wrote to the database would leave the next command reading stale state.
