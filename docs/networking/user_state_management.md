# User State Management Flows

Reference: @src/server/db/types/row/dbUser.ts , @src/server/db/types/row/dbRoom.ts , @src/server/sockets/socketsServer.ts , @src/server/room/serverRoomManager.ts , @src/server/user/serverUserManager.ts , @src/server/sockets/types/socketUserContext.ts

Single-player rooms differ from these flows (see [single_player_mode.md](single_player_mode.md)). Room capacity rules are in [room_population.md](room_population.md).

## Where state lives
- **`DBUser`**: last room, player metadata (shared across rooms), single-player mode, seen FTUE elements, account info and login bookkeeping.
- **`DBRoom`**: owner and texture pack. Room contents are a separate blob.
- There is no per-session snapshot. Players always spawn behind a door, and permissions are derived from user + room by `RoomValidationUtil`, so there is nothing to establish or restore per session.

## Choosing the room on connect
- `/`: the user's single-player room if that mode is set, otherwise their last room, otherwise a hub from the [balancer](room_population.md).
- `/:roomID`: that room, falling back to a hub if it does not exist or is full.

## Changing rooms (no reload)
1. The client sends a room-change request and blocks further requests until it finishes.
2. The server loads the target room (cache or DB, deduplicated across concurrent loads) and checks capacity. If the room is full, the user stays where they are.
3. The server leaves the old room (despawns the player and optionally flushes metadata), spawns the user behind a [door](../geometry/room_entrance.md) with restored metadata, writes the last room to `DBUser` and notifies the client.

## Player metadata across sessions
On join, metadata is resolved from: **(1)** an in-memory recent-disconnect buffer, **(2)** `DBUser`, **(3)** empty.

The buffer is filled synchronously whenever a session ends (disconnect, or eviction by a newer socket), before the asynchronous DB write. It covers:
- **Close and reopen**: the reconnect reads the buffer if the DB write has not landed yet.
- **Refresh**: whichever of the new connect and the old disconnect happens first, the buffer bridges them. A new socket evicts the still-registered old one.
- **Duplicate tab**: the old socket is sent to the duplication error page, and the new tab inherits its metadata.

Entries expire after a short TTL.

## Server shutdown and crashes
- **Crash**: in-memory state is lost. The last DB writes are the recovery point.
- **Graceful shutdown**: all players' metadata is batch-saved, users are removed from rooms and disconnected. Clients poll the health route and reload when it reports ready. Readiness is judged by **status code**, because nginx answers with a gateway error while the app is down (so the poll must be same-origin). A process that is shutting down also reports not-ready. Polling backs off and never stops.

## Server upkeep
- **Stale sockets**: a periodic check cleans up sockets whose disconnect never fired, after a grace period. The same loop evicts expired buffer entries.
- **Heartbeat**: aggressive ping and timeout settings detect dead connections quickly.
- **Room auto-save**: dirty rooms are saved in rate-limited batches. When the last user leaves a Regular room, it is saved and then unloaded, after re-checking that it is still empty. Hubs stay loaded.
- **Signal batching**: signals queue per type per connection and flush on a fixed interval. Some types have a minimum send interval (e.g. room changes and commands). The server rejects signals that arrive too early, and the client retries a few times.

## User commands
The client sends a command string, and the server dispatches it to a handler (e.g. finish-tutorial, add-FTUE-element). Handlers that modify the user **update the in-memory user as well as `DBUser`**, because the in-memory object serves the rest of the session.
