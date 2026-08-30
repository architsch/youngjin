# Single-Player Mode

Reference: @src/shared/room/types/roomType.ts , @src/shared/user/types/user.ts , @src/shared/system/types/featureFlag.ts , @src/server/room/serverRoomManager.ts , @src/server/room/util/hubRoomUtil.ts , @src/server/room/util/roomPickerUtil.ts , @src/server/sockets/socketsServer.ts , @src/shared/singlePlayer/maps/singlePlayerModeConfigMap.ts , @src/client/singlePlayer/singlePlayerManager.ts , @src/client/singlePlayer/maps/singlePlayerModeClientConfigMap.ts , @src/client/singlePlayer/maps/singlePlayerActionMap.ts , @src/client/singlePlayer/maps/singlePlayerConditionMap.ts , @src/client/object/util/clientObjectUtil.ts

## What it is

In addition to the default **multi-player** experience (where many users share a room and the server is authoritative over every player, voxel, and object), the game supports a **single-player** mode: a room that the user explores alone, with all gameplay state driven entirely by their own client.

The motivating use case is the **first-time tutorial**. Single-player mode gives us a systematic, isolated environment to script a guided experience (a dedicated tutorial room) without worrying about other players, server round-trips, or persistence side-effects.

## The two axes: room type vs. user mode

Single-player support is expressed through two independent pieces of state:

- **A single-player room type** (`RoomType`) — a room type alongside Hub and Regular. A single-player room is a *shared template*: there is one such room per name (e.g. one tutorial room for the whole server), and every user who enters it sees the same starting layout but acts on their own **local** copy. The server never mutates a single-player room on a user's behalf, and these rooms have no owner.
- **A single-player mode flag on the user** (`User`) — names which single-player experience, if any, the user should be routed into on their next connection. An empty value means the user is not in single-player mode. New users (guests and freshly-created members) start out routed to the tutorial.

Hub rooms are preloaded at server boot by `HubRoomUtil`, which creates one if none exists yet (see [room_population.md](room_population.md#hub-residency)). A single-player room, by contrast, is never stored anywhere: it is generated on demand by the client from its mode configuration (see [Local world construction](#local-world-construction)).

## Where the user lands on connect

`SocketsServer` resolves the target room by priority:

1. The user's single-player room, if their single-player mode flag is set. An unfinished single-player experience (e.g. the first-time tutorial) gates everything else: a specific room requested via the connection URL is deliberately *not* honored yet — the client remembers it and routes the user there once the experience is over (see [Finishing the tutorial](#finishing-the-tutorial)).
2. A specific room requested via the connection URL.
3. The last multi-player room the user was in.
4. A Hub room, as the final fallback.

If the preferred room cannot be entered — it no longer exists, or it has reached its player cap — the server falls back to a Hub room. See [room_population.md](room_population.md#entering-a-specific-room).

The user's mode flag only *influences where the server routes them*; it is **not** what the client consults to decide whether to run a single-player experience. The room the server actually places the user in is the single source of truth: the client starts (or does not start) single-player mode purely from that room's `RoomType`, and a single-player room carries its mode identity in its name. This keeps the two from ever disagreeing — the single-player UI and scripted steps can never run on top of a multi-player room, nor a multi-player session inside a single-player room. (If, for example, the connection routing and the page-rendered user state ever resolved to different users, the client still simply follows the room it landed in.)

### The "hub" keyword

The hub keyword is a reserved pseudo-room-ID, not a real room. When asked to load it, `RoomPickerUtil` resolves it to whichever Hub room the incoming user should be load-balanced into (see [room_population.md](room_population.md#picking-a-hub)). It is what a URL names when the visitor is to be put somewhere sensible rather than in one room in particular. The way out of the tutorial names no room at all, which the same picker answers the same way (see [Door behavior](#door-behavior)).

## Server-side contract for single-player rooms

Because a single-player room is a shared template that each client drives locally, the server deliberately does **not** treat the joining user as a participant:

- **No participant registration.** The user's player object is created and updated entirely client-side; the server only flags the connection as being in a single-player room. The server never sends the room's contents either: it hands the joining user a content-less descriptor (the room's identity only) over their own connection, and the client builds the room locally.
- **No last-room write.** Single-player rooms are re-entered via the user's mode flag, not via the saved last room, so that write is skipped.
- **No removal on exit.** Since the user was never registered as a participant, there is nothing to remove when they leave.

As defense-in-depth, every server signal handler that would mutate room state (object add/remove/transform/metadata in `ServerObjectManager`, and voxel add/remove/move/texture in `ServerVoxelManager`) rejects these edits outright: a single-player user is never bound to a server-side room, so each handler finds no room to act on and bails. In practice the client never emits these while in a single-player room (see below).

## Client-side architecture

### Local world construction

When the client loads a single-player room it takes a different path than for a multi-player room:

- **Multi-player rooms:** the server sends the full room — voxels and objects, including the player and the room's own door.
- **Single-player rooms:** the server sends only the room's identity, so the client generates the room's voxels and objects locally from the mode's configuration (the same generation logic the server uses to build multi-player rooms) and spawns its own player at the entrance the configuration defines.

The transform emitter that normally streams player movement to the server disables itself in single-player rooms, and every edit path guards its outgoing signal behind a check for the room type. The result: the player can move and edit freely, but nothing is sent to or persisted by the server.

### Scripted steps: actions, conditions, and transitions

Each single-player experience is described declaratively, in two halves. A `SinglePlayerModeConfig` (one per mode) knows how to build the mode's room and exposes that room's layout metadata; it is shared, because the server generates the same room the client does. A `SinglePlayerModeClientConfig` produces the mode's `SinglePlayerStep`s as a set keyed by name, and the teardown that follows them; it is the client's alone, which is what lets a step reach straight for the room, the character, the camera and the UI as it is played. Steps are referenced by name rather than by position, so a step can name any other as its successor and the steps can be reordered or inserted without renumbering. A step has three parts:

- **Start actions** — run once when the step begins (e.g. show a piece of tutorial UI or place a gizmo).
- **Transition rules** — each rule pairs a set of requirements (all must hold) with the name of the step to advance to and a delay before doing so. The first rule whose requirements are all satisfied wins; a next-step of "none" ends the mode.
- **End actions** — run once when the step is left (typically clearing the step's UI and gizmos).

`SinglePlayerManager`, ticked from the main update loop, evaluates the current step's transition rules each frame and advances when one is met. A single observable holds the current mode-and-step pair; changing it automatically runs the previous step's end actions and the next step's start actions.

A `SinglePlayerAction` is a small tagged command and a `SinglePlayerCondition` a small tagged predicate, each dispatched through a client-side map keyed by its tag. Actions cover showing or clearing tutorial UI, placing world-space gizmos, toggling feature flags, holding the orbit camera on a place of the step's own choosing, editing the local world, moving the selection onto a quad of the step's own choosing, setting object metadata, playing a brief cosmetic animation on a world object (e.g. nudging an NPC so it appears to nod when it replies), and finishing the mode. A step's own act outranks the constraints that step has itself imposed: one that holds the selection still, so that the user cannot wander off the block being talked about, still moves that selection itself once the block has been built or taken away. Conditions observe local game state — player proximity, whether the user is in edit mode, which voxel-quad is selected and what texture it carries, whether a block exists, whether the user has yet made an edit of a given kind, how far the camera has been moved from a view the step noted down, whether the chat input or an object's metadata passes a test, or whether the room has been exited. Adding a new tutorial capability is therefore a matter of adding one action or condition variant plus its handler, with no per-step code.

### Parameters are computed, not written down

A step is written long before it is played, so what it points at often cannot be a number in its own text: which patch of floor is worth pointing out depends on where the user has wandered to, and which view he should be asked to turn away from is only settled once the camera has settled. Every value an action or condition carries is therefore a small function rather than a value (`SinglePlayerParam`) — constants read as such, and the rest looking at the running game when they are read.

Setting something aside is itself an action: a step works a value out once, under a name, and the steps that follow build their parameters from it. `SinglePlayerManager` holds those named values for the length of the mode and empties them when it ends. This is what lets a step settle on something *while being played* and then have several of its own actions — a gizmo, an outline, the camera — all point at the same thing.

Two conditions deserve a word, since they are what lets a step teach an act rather than an outcome. A step that asks the user to change something lets him choose *what* to change, so waiting for one particular cell of the world to end up a particular way would not do; the client keeps a running tally of the edits the user makes by hand — a block added, a block removed, a texture changed, a body part changed — and the step waits on that tally instead. And a step that asks the user to move the camera notes down the view it found him at, so that "has he moved it" is a question about the here and now (see [camera_control.md](../graphics/camera_control.md)) without the step having to jolt him into a fixed view first.

### Tutorial UI and gizmos

Start and end actions drive a thin, purely local presentation layer, all of it observable-backed:

- **On-screen UI** — a top-of-screen headline banner, a 2D arrow that points at a target UI element, a 2D outline that frames one, and a gesture diagram (an animated drawing with a short caption) that demonstrates an input such as how to move. The arrow hangs above its target, or below it for a target too near the top of the screen to have room above it; the diagram takes the middle of the screen, or steps aside to its edge, drawn small, when the point of the gesture is to watch what it does to something else. The arrow and outline follow their target element live, and none of these intercept pointer input, so the user can still operate the control being highlighted or perform the demonstrated gesture "through" the diagram.
- **World-space gizmos** — a flat, ground-parallel navigation arrow that floats ahead of the player and points toward a destination, a downward arrow that hovers over a point of interest, and a softly glowing outline that highlights a voxel-quad. These are drawn always-on-top so they stay visible through walls and objects.
- **The camera** — a step may hold the orbit camera on a place of its own for as long as it lasts, whatever the user has selected meanwhile, and give it back when it ends. Being shown the thing one is asked to pick out beats being told where to look for it. A step may also ask for the view that place is to be seen from, since some things — a patch of floor, seen from close to its own level — are barely visible from whichever direction the user happens to have left the camera in (see [camera_control.md](../graphics/camera_control.md)).

A single "clear" action tears the whole layer down, which every step's end actions use.

### Feature flags

`FeatureFlag` is a set of global UI/interaction switches (for example, hiding the chat input, disabling manual voxel editing, holding a selection in place, or holding the user in the game mode he is in). They are tracked in an observable set that notifies listeners as flags are toggled; consumers either query the set on demand or subscribe to changes. These flags let a tutorial step constrain what the user can do at a given moment — and, just as importantly, hand him one thing at a time: the way into edit mode and the way back out of it are each opened only by the step that teaches them, and the labels naming who the user is stay away for the whole tutorial, while the button that leaves the app never does.

A flag that constrains something the user can do constrains the *doing* of it, not merely the control that offers it. The one holding him in his game mode is the clearest case: it refuses the crossing itself, so the back gesture and a second click on what is being edited are turned away along with the buttons, which are hidden because that same flag says there is nothing for them to do (see [game_mode.md](../gameplay/game_mode.md)).

### Door behavior

Nothing about the tutorial's door is special-cased. It is generated as the room's own way in, leading nowhere — and a door of that kind, asked to open onto a destination it does not have, falls back on taking the user out to wherever the server judges he should go next: the room he originally asked for through the connection URL, or a hub. That is exactly what leaving the tutorial means, so the ordinary behavior of an unwired entrance is the whole of it. See [room_entrance.md](../geometry/room_entrance.md#the-door-as-an-object).

## Finishing the tutorial

When the tutorial completes, the client signals the server, which verifies the user is actually in the tutorial and then clears their single-player mode flag (in memory and in storage). On the next connect the user is no longer routed to the tutorial room. Guiding the user from there on is the job of the post-tutorial [FTUE system](ftue.md).

Leaving the tutorial is itself a room change: the user is moved into a real (multi-player) room, and it is landing in that non-single-player room that triggers the completion signal. If the user originally arrived via a room-specific URL — the destination that connect-time routing deferred — that is the room they are sent to now, within the same runtime; otherwise they go to a hub. This holds whether the tutorial is finished naturally (through the door) or skipped.

## Persistence

The user record stores which single-player mode (if any) the user should resume; an empty value means the experience is finished. Existing user records are migrated to carry this field, so that users who had already made tutorial progress are treated as having finished it, while those who had not are routed into the tutorial.

Single-player rooms themselves are never persisted — they are not stored in the database, owned, or written back. Each is regenerated by the client from its mode configuration every time the user enters, so the room always reflects the current configuration.

## Room editability

The shared editability check (used by both client and server) grants edit permission in single-player rooms (as well as to Owners, Editors, and in Hub rooms). Single-player editing is purely local and never persisted, so allowing it is safe and lets the tutorial teach building.

## Related docs

- [Game Mode](../gameplay/game_mode.md) — the play/edit modes the tutorial walks the user through.
- [First-Time User Experience](ftue.md) — the guidance that takes over once the tutorial is done.
- [User State Management Flows](user_state_management.md) — room-join resolution and where user state lives.
- [Room Entrances](../geometry/room_entrance.md) — how a room's doors work, and where an arriving player lands.
