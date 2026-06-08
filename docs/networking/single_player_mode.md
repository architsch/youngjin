# Single-Player Mode

Reference: @src/shared/room/types/roomType.ts , @src/shared/user/types/user.ts , @src/shared/system/types/featureFlag.ts , @src/server/room/serverRoomManager.ts , @src/server/room/routines/ownerlessRoomCreationRoutine.ts , @src/server/sockets/socketsServer.ts , @src/shared/singlePlayer/maps/singlePlayerModeConfigMap.ts , @src/client/singlePlayer/singlePlayerManager.ts , @src/client/singlePlayer/maps/singlePlayerActionMap.ts , @src/client/singlePlayer/maps/singlePlayerConditionMap.ts , @src/client/object/util/clientObjectUtil.ts

## What it is

In addition to the default **multi-player** experience (where many users share a room and the server is authoritative over every player, voxel, and object), the game supports a **single-player** mode: a room that the user explores alone, with all gameplay state driven entirely by their own client.

The motivating use case is the **first-time tutorial**. Single-player mode gives us a systematic, isolated environment to script a guided experience (a dedicated tutorial room) without worrying about other players, server round-trips, or persistence side-effects.

## The two axes: room type vs. user mode

Single-player support is expressed through two independent pieces of state:

- **A single-player room type** (`RoomType`) — a room type alongside Hub and Regular. A single-player room is a *shared template*: there is one such room per name (e.g. one tutorial room for the whole server), and every user who enters it sees the same starting layout but acts on their own **local** copy. The server never mutates a single-player room on a user's behalf, and these rooms have no owner.
- **A single-player mode flag on the user** (`User`) — names which single-player experience, if any, the user should be routed into on their next connection. An empty value means the user is not in single-player mode. New users (guests and freshly-created members) start out routed to the tutorial.

The shared single-player rooms (and the Hub room) are created at server boot by `OwnerlessRoomCreationRoutine` if they do not already exist.

## Where the user lands on connect

`SocketsServer` resolves the target room by priority:

1. A specific room requested via the connection URL.
2. The user's single-player room, if their single-player mode flag is set.
3. The last multi-player room the user was in.
4. A Hub room, as the final fallback.

If the preferred room fails to load, the server falls back to the first room of the resolved fallback type (single-player or Hub).

### The "hub" keyword

The hub keyword is a reserved pseudo-room-ID, not a real room. When asked to load it, `ServerRoomManager` resolves it to whichever Hub room is available (preferring one already in memory, otherwise picking a random hub to spread traffic). The client uses this to send the user back to a hub after the tutorial (see [Door behavior](#door-behavior)).

## Server-side contract for single-player rooms

Because a single-player room is a shared template that each client drives locally, the server deliberately does **not** treat the joining user as a participant:

- **No participant registration.** The user's player object is created and updated entirely client-side; the server only flags the connection as being in a single-player room.
- **No last-room write.** Single-player rooms are re-entered via the user's mode flag, not via the saved last room, so that write is skipped.
- **No removal on exit.** Since the user was never registered as a participant, there is nothing to remove when they leave.

As defense-in-depth, every server signal handler that would mutate room state (object add/remove/transform/metadata in `ServerObjectManager`, and voxel add/remove/move/texture in `ServerVoxelManager`) rejects single-player rooms outright. In practice the client never emits these while in a single-player room (see below).

## Client-side architecture

### Local world construction

When the client loads a single-player room it takes a different path than for a multi-player room:

- **Multi-player rooms:** the server includes the player object in the room data, and the client spawns the entrance door.
- **Single-player rooms:** there is no server-provided player object, so the client spawns its own at the entrance defined by the mode's configuration.

The transform emitter that normally streams player movement to the server disables itself in single-player rooms, and every edit path guards its outgoing signal behind a check for the room type. The result: the player can move and edit freely, but nothing is sent to or persisted by the server.

### Scripted steps: actions, conditions, and transitions

Each single-player experience is described declaratively by a `SinglePlayerModeConfig` (one per mode), which knows how to build its room, expose the room's layout metadata, and produce an ordered list of `SinglePlayerStep`s. A step has three parts:

- **Start actions** — run once when the step begins (e.g. show a piece of tutorial UI or place a gizmo).
- **Transition rules** — each rule pairs a set of requirements (all must hold) with the next step to advance to and a delay before doing so. The first rule whose requirements are all satisfied wins; a next-step of "none" ends the mode.
- **End actions** — run once when the step is left (typically clearing the step's UI and gizmos).

`SinglePlayerManager`, ticked from the main update loop, evaluates the current step's transition rules each frame and advances when one is met. A single observable holds the current mode-and-step pair; changing it automatically runs the previous step's end actions and the next step's start actions.

A `SinglePlayerAction` is a small tagged command and a `SinglePlayerCondition` a small tagged predicate, each dispatched through a client-side map keyed by its tag. Actions cover showing or clearing tutorial UI, placing world-space gizmos, toggling feature flags, editing the local world, setting object metadata, and finishing the mode. Conditions observe local game state — player proximity, which voxel-quad is selected and what texture it carries, whether a block exists, whether the chat input or an object's metadata passes a test, or whether the room has been exited. Adding a new tutorial capability is therefore a matter of adding one action or condition variant plus its handler, with no per-step code.

### Tutorial UI and gizmos

Start and end actions drive a thin, purely local presentation layer, all of it observable-backed:

- **On-screen UI** — a top-of-screen headline banner, a 2D arrow that points at a target UI element, and a 2D outline that frames one. The arrow and outline follow their target element live and never intercept pointer input, so the user can still operate the control being highlighted.
- **World-space gizmos** — a navigation arrow that floats ahead of the player and points toward a destination, a downward arrow that hovers over a point of interest, and an outline that highlights a voxel-quad. These are drawn always-on-top so they stay visible through walls and objects.

A single "clear" action tears the whole layer down, which every step's end actions use.

### Feature flags

`FeatureFlag` is a set of global UI/interaction switches (for example, hiding the chat input, disabling manual voxel editing, or changing what the door does). They are tracked in an observable set that notifies listeners as flags are toggled; consumers either query the set on demand or subscribe to changes. These flags let a tutorial step constrain what the user can do at a given moment.

### Door behavior

The entrance door checks a feature flag: when set, clicking the door sends the user straight to a hub; otherwise it opens the normal room-list popup. See [room_entrance.md](../geometry/room_entrance.md#the-door-object).

## Finishing the tutorial

When the tutorial completes, the client signals the server, which verifies the user is actually in the tutorial and then clears their single-player mode flag (in memory and in storage). On the next connect the user is no longer routed to the tutorial room.

## Persistence

The user record stores which single-player mode (if any) the user should resume, and the room record stores a name used to distinguish single-player rooms from one another. Stored records are migrated to carry these fields; existing users who had already made tutorial progress are treated as having finished it, while those who had not are routed into the tutorial. Single-player rooms are excluded from the general room search and located by name instead.

## Room editability

The shared editability check (used by both client and server) grants edit permission in single-player rooms (as well as to Owners, Editors, and in Hub rooms). Single-player editing is purely local and never persisted, so allowing it is safe and lets the tutorial teach building.

## Related docs

- [User State Management Flows](user_state_management.md) — room-join resolution and where user state lives.
- [Room Entrance](../geometry/room_entrance.md) — entrance geometry for multi-player vs. single-player rooms.
