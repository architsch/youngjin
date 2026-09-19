# Single-Player Mode

Reference: @src/shared/room/types/roomType.ts , @src/shared/system/types/featureFlag.ts , @src/server/room/util/roomPickerUtil.ts , @src/server/sockets/socketsServer.ts , @src/shared/singlePlayer/maps/singlePlayerModeConfigMap.ts , @src/client/singlePlayer/singlePlayerManager.ts , @src/client/singlePlayer/maps/singlePlayerModeClientConfigMap.ts , @src/client/singlePlayer/maps/singlePlayerActionMap.ts , @src/client/singlePlayer/maps/singlePlayerConditionMap.ts

A single-player room is explored alone and runs entirely on the client. Its main use is the first-time **tutorial**, a scripted experience isolated from other players and from persistence.

## Two independent pieces of state
- **`RoomType` single-player**: a shared template (one per name, no owner) that each client builds and edits as its own local copy. The server never stores or mutates it.
- **The user's single-player mode** (on `User`/`DBUser`): which experience, if any, to route the user into on connect. New users start routed to the tutorial. An empty value means finished.

**The client decides whether to run single-player logic from the joined room's `RoomType`**, never from the user flag, so single-player logic can never run in a multiplayer room or the reverse.

## Routing
On connect, `SocketsServer` picks, in order: the single-player room (if the flag is set), the URL's room, the last room, a hub. While the tutorial is unfinished, a URL room is deferred: the client remembers it and uses it when the tutorial is skipped. The reserved **hub keyword** is a pseudo room id that `RoomPickerUtil` resolves to a balanced hub (see [room_population.md](room_population.md)).

## Server contract
- The server sends only the room's identity, and the client generates the room from its `SinglePlayerModeConfig` (with the same generation code the server uses).
- The user is not registered as a participant, no last room is written, and nothing is removed on exit.
- As defense in depth, room-mutating handlers in `ServerObjectManager` and `ServerVoxelManager` find no bound room and reject the edit. Client edit paths and the transform emitter also skip their signals in single-player rooms.
- `RoomValidationUtil` allows editing in single-player rooms, since edits stay local.

## Scripted steps
- `SinglePlayerModeConfig` (shared) builds the room and exposes its layout. `SinglePlayerModeClientConfig` (client) defines named `SinglePlayerStep`s and a teardown.
- A step has **start actions**, **transition rules** (all requirements met → next step after a delay; the first matching rule wins; "none" ends the mode) and **end actions**. Steps refer to each other by name.
- `SinglePlayerManager` evaluates transitions every frame. A single observable holds the current mode and step, and changing it runs the end and start actions.
- `SinglePlayerAction` and `SinglePlayerCondition` are tagged variants dispatched through client maps. A new tutorial capability is a new variant plus its handler, with no per-step code. Actions cover tutorial UI, gizmos, feature flags, camera holds, poses and distance, local world edits, selection (including what edit mode opens on and narrowing what the user may select to a single quad), hiding the user's own character, metadata, cosmetic animations and finishing. Conditions observe local state such as proximity, mode, selection, blocks, quad textures, the user's edit tally, camera movement since a noted view, and chat or metadata tests.
- A quad is addressed everywhere by its index, and a **UI element by its DOM id**, which a step may compute (e.g. one cell of the texture strip). An element pointed at is scrolled into view within whatever list holds it.
- **Parameters are functions** (`SinglePlayerParam`) evaluated against the running game, normally when the action runs. An action that sets up something for later (what edit mode opens on) evaluates them when that happens instead. An action can store a computed value under a name for the rest of the mode, so several later actions can target the same thing.
- A step's own actions override constraints that the step itself imposed (e.g. a locked selection).
- To teach an *act* rather than an outcome, conditions wait on a tally of manual edits (not on a specific cell), or on the camera having moved away from a view the step noted.

## Presentation and constraints
- **Tutorial UI** (observable-backed and non-blocking for pointers): headline banner, arrow and outline that track a DOM element, and a gesture diagram. **World gizmos** (always on top): navigation arrow, point-of-interest arrow, quad outline. A single "clear" action removes all of them.
- The two gizmos that mark a **face** hide themselves whenever that face is out of sight — something drawn in between, or the camera behind it. They draw on top of everything, so otherwise they would hang in the middle of the wall in the way.
- **`FeatureFlag`**: an observable set of switches that restrict the UI and interactions (e.g. hide chat, disable voxel edits, lock selection, lock game mode). A flag restricts the **action itself**, not just the button for it (e.g. the mode lock also blocks the back gesture).
- **Selection restriction**: separate from the selection lock, which refuses every quad. A step that asks the user to pick a face out lifts the lock and leaves only that one face selectable, so a stray click can't strand the steps that act on it.

## Finishing
- The tutorial's exit is an ordinary door pointed at the hubs.
- Arriving in a non-single-player room triggers the finish command. The server verifies the user was in the tutorial and clears the flag in memory and in the DB. Skipping sends the user to the picker instead, which honors a deferred URL room.
- [FTUE](ftue.md) takes over afterwards.
