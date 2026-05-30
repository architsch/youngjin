# Single-Player Mode

Reference: @src/shared/room/types/roomType.ts , @src/shared/user/types/user.ts , @src/shared/system/types/featureFlag.ts , @src/shared/system/types/observableSet.ts , @src/server/room/serverRoomManager.ts , @src/server/room/routines/ownerlessRoomCreationRoutine.ts , @src/server/sockets/socketsServer.ts , @src/server/user/util/userCommandUtil.ts , @src/client/singlePlayer/singlePlayerManager.ts , @src/client/object/util/clientObjectUtil.ts

## What it is

In addition to the default **multi-player** experience (where many users share a room and the server is authoritative over every player/voxel/object), the game supports a **single-player** mode: a room that the user explores alone, with all gameplay state driven entirely by their own client.

The motivating use case is the **first-time tutorial**. Single-player mode gives us a systematic, isolated environment to script a guided experience (a dedicated tutorial room) without worrying about other players, server round-trips, or persistence side-effects.

## The two axes: room type vs. user mode

Single-player support is expressed through two independent pieces of state:

- **`RoomType.SinglePlayer`** (`roomType.ts`) — a new room type alongside `Hub` and `Regular`. A `SinglePlayer` room is treated as a *shared template*: there is one such room per `roomName` (e.g. one `"tutorial"` room for the whole server), and every user who enters it sees the same starting layout but acts on their own **local** copy. The server never mutates a single-player room on a user's behalf.
- **`User.singlePlayerMode`** (`user.ts`) — a string on the user that replaces the old numeric `tutorialStep`. `""` means the user is **not** in single-player mode; a non-empty value (currently only `"tutorial"`) means the user should be routed into the corresponding single-player room on their next connection. New users (guests and freshly-created members) start with `singlePlayerMode = "tutorial"`.

The shared single-player rooms are created at server boot by `OwnerlessRoomCreationRoutine.createIfMissing` (see `server.ts`), which also creates the Hub room. These rooms have no owner (`ownerUserID = ""`).

## Where the user lands on connect

`SocketsServer` resolves the target room with this priority (see the connection handler):

1. **`targetRoomID`** from the socket handshake (URL-based access, `/:roomID`).
2. **Single-player room** — if `user.singlePlayerMode != ""`, the fallback room type becomes `SinglePlayer` and no specific `preferredRoomID` is used.
3. **`user.lastRoomID`** — the last multi-player room the user was in.
4. **Hub room** — the final fallback.

If the preferred room fails to load, the server falls back to the first room of `fallbackRoomType` (either `SinglePlayer` or `Hub`).

### The `"hub"` keyword

`"hub"` is a reserved pseudo-room-ID, not a real room. When `ServerRoomManager.loadRoom("hub")` is called, it resolves to whichever `Hub`-type room is available (preferring one already loaded in memory, otherwise picking a random hub from the DB to spread traffic). The client uses this to send the user back to the hub after the tutorial (see [Door behavior](#door-behavior)).

## Server-side contract for single-player rooms

Because a single-player room is a shared template that each client drives locally, the server deliberately does **not** treat the joining user as a participant. In `ServerRoomManager.changeUserRoom`:

- **No participant registration.** For a `SinglePlayer` room, `ServerUserManager.addUserToRoom` is *not* called — the user's player object is created and updated entirely client-side. Instead the socket context is flagged via `socketUserContext.isInSinglePlayerRoom = true`.
- **No `lastRoomID` write.** Single-player rooms are re-entered via `user.singlePlayerMode`, not `lastRoomID`, so `DBUserUtil.setLastRoomID` is skipped.
- **No removal on exit.** When the user later leaves, removal is skipped (`if (!socketUserContext.isInSinglePlayerRoom) removeUserFromRoom(...)`), since they were never registered.

All server signal handlers that mutate room state reject single-player rooms early:

- `ServerObjectManager` — `onAddObjectSignalReceived`, `onRemoveObjectSignalReceived`, `onSetObjectTransformSignalReceived`, `onSetObjectMetadataSignalReceived`.
- `ServerVoxelManager` — add / remove / move voxel block and set-quad-texture handlers.

In practice the client never emits these signals while in a single-player room (see below), so these guards are defense-in-depth.

## Client-side architecture

### Local world construction

When the client loads a single-player room, `ClientObjectManager.load` takes a different path (see `clientObjectUtil.ts`):

- **Multi-player rooms:** the server includes the player object in the room data, and the client spawns the entrance door (`ClientObjectUtil.spawnEntranceDoor`).
- **Single-player rooms:** there is no server-provided player object, so the client spawns its own at the single-player entrance (`ClientObjectUtil.spawnSingleModePlayer`, anchored to `SINGLE_PLAYER_ENTRANCE_VOXEL_COL/ROW`).

`PeriodicTransformEmitter` disables itself in single-player rooms (`onSpawn` sets `updateEnabled = false`), and every edit path (voxel add/remove/move/texture, object add/remove/metadata, canvas move, chat metadata) guards its `SocketsClient.emit…` call behind `room.roomType != RoomTypeEnumMap.SinglePlayer`. The result: the player can move and edit freely, but nothing is sent to (or persisted by) the server.

### Step runner system

The scripted single-player experience is driven by `SinglePlayerManager` (ticked from the main update loop in `app.ts`) plus two observables:

- `singlePlayerModeObservable` — the current mode string (initialized from `user.singlePlayerMode`).
- `singlePlayerStepObservable` — the current step index within that mode (initialized to `0`).

Whenever either changes, `SinglePlayerManager` ends the current `SinglePlayerStepRunner` and constructs the one for `(mode, step)` from `SinglePlayerStepRunnerConstructorMap` (e.g. `{"tutorial": [() => new Tutorial_0()]}`). Each runner implements `start()` / `update(deltaTime)` / `end()`. `Tutorial_0`, for example, watches for the player to move and then advances the step.

`SinglePlayerUtil` exposes two operations to the runners:

- `setSinglePlayerStep(n)` — advance to the next step locally.
- `finishTutorial()` — emit a `UserCommandSignal("finishTutorial")` to the server.

### Feature flags

`FeatureFlag` (`featureFlag.ts`) is an enum of global UI/interaction switches (e.g. `HideChatInput`, `DisableManualVoxelBlockAddition`, `GoToHubImmediatelyOnDoorClick`). They are tracked in `clientFeatureFlagsObservable`, an `ObservableSet<FeatureFlag>` that notifies listeners when a flag is added or removed. Consumers either query `clientFeatureFlagsObservable.has(flag)` (voxel/canvas click handlers, edit-option components) or subscribe via `addElementListener` (e.g. `UIRoot` hides the chat input on `HideChatInput`). These flags let a tutorial step constrain what the user can do at a given moment.

### Door behavior

`DoorGameObject.onClick` checks the `GoToHubImmediatelyOnDoorClick` flag: when set, clicking the door emits `RequestRoomChangeSignal("hub")` (sending the user straight to a hub); otherwise it opens the normal room-list popup.

## Finishing the tutorial

When the tutorial completes, the client calls `SinglePlayerUtil.finishTutorial()`. The server's `UserCommandUtil.handleFinishTutorialCommand` verifies the user is in `singlePlayerMode == "tutorial"`, then clears it (`user.singlePlayerMode = ""` and `DBUserUtil.setSinglePlayerMode(userID, "")`). On the next connect the user will no longer be routed to the tutorial room.

## Persistence & migrations

- **DBUser** stores `singlePlayerMode: string` (replacing `tutorialStep: number`). Migration `v1 → v2` (`dbUserVersionMigration.ts`) drops `tutorialStep` and sets `singlePlayerMode = (tutorialStep > 0) ? "" : "tutorial"` — i.e. users who had made any tutorial progress are considered done, while users still at step 0 get the new tutorial.
- **DBRoom** gains `roomName: string`, used to distinguish single-player rooms by name. Migration `v2 → v3` (`dbRoomVersionMigration.ts`) backfills `roomName = ""`.
- **DBSearchUtil** excludes `SinglePlayer` rooms from the general room search and adds `withRoomNameAndType` for locating a specific single-player room.

## Room editability

`RoomValidationUtil.canUserEditRoom` (shared by client and server permission checks) returns true for Owners, Editors, **Hub** rooms, and **SinglePlayer** rooms. Single-player editing is purely local (never emitted/persisted), so granting edit permission there is safe and lets the tutorial teach building.

## Related docs

- [User State Management Flows](user_state_management.md) — room-join resolution and where user state lives.
- [Room Entrance](../geometry/room_entrance.md) — entrance geometry for multi-player vs. single-player rooms.
