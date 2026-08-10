# Integration Test Framework

## Architecture

The integration test framework exercises real server-side game logic (room management, object management, voxel operations, physics, signal routing) against a mocked database layer. No actual Firestore or network I/O occurs.

The one exception is the DB suite, which is about the database layer itself and therefore cannot use the mock — see [The DB Suite](#the-db-suite) below.

```
                     +------------------+
                     |  Scenario Tests  |  (declarative test specs)
                     +--------+---------+
                              |
                     +--------v---------+
                     | Scenario Runner  |  (setup -> actions -> invariants -> assertions -> cleanup)
                     +--------+---------+
                              |
              +---------------+---------------+
              |               |               |
     +--------v------+  +----v-----+  +------v--------+
     | Action Engine |  |Invariants|  |Scenario Presets|
     +--------+------+  +----+-----+  +------+--------+
              |               |               |
     +--------v---------------v---------------v--------+
     |                Server Harness                    |
     |  (wires real modules + mocked DB layer)          |
     +--------+----------------------------------------+
              |
     +--------v-----------------------------------------+
     |  Real Server Modules                              |
     |  ServerRoomManager, ServerUserManager,             |
     |  ServerObjectManager, ServerVoxelManager,          |
     |  PhysicsManager, ObjectUpdateUtil, VoxelUpdateUtil |
     +--------------------------------------------------+
```

## Core Components

### Server Harness (`helpers/serverHarness.ts`)

The harness is the foundation. It:
- Mocks the database utilities (`dbRoomUtil`, `dbUserUtil`, `dbSearchUtil`) with in-memory stores. Room creation is mocked into a real, loadable room, so server code that creates rooms on demand (hub creation in particular) can be exercised end to end.
- Calls `setIsServer()` so server-only validation gates (e.g. Player `canUserAddObject`) pass
- Provides convenience methods: `connectUser()`, `joinRoom()`, `appStartJoin()`, `disconnectUser()`, `reconnectCaseA()`, `reconnectCaseB()`, `gracefulShutdown()`. `joinRoom()` names a destination outright; `appStartJoin()` instead mirrors what the socket server does on connection — let the room picker choose, join with a fallback allowed, and report a refusal — so the destination itself can be put under test. A reconnecting context is rebuilt from the mocked `DBUser`, the way the real auth middleware does, so it carries the previous session's last room and single-player mode.
- Provides population helpers: `loadRoom()` (preload a room with nobody in it, the way hubs are preloaded at start-up), `fillRoomWithUsers()` (connect and join N real users), and `setSyntheticRoomPopulation()` (stuff a room's participant table so that population-dependent logic can be tested without one socket per player — scenarios using it must skip the structural invariants)
- Supports configurable latency simulation on DB operations
- Exposes direct access to `ServerRoomManager`, `ServerUserManager`, `ServerObjectManager`, `RoomPickerUtil`, `HubRoomUtil`, `PhysicsManager`

### Room Fixtures (`helpers/roomContent.ts`)

The server generates every Hub/Regular room from a seed drawn at creation time — its layout, its contents and its texture pack alike — which makes a real room a poor fixture: a scenario that builds and edits blocks at chosen coordinates needs to know what is already there, and needs the same answer on every run. So `createTestRoom()` gives scenarios the bare shell instead — one open floor inside the boundary wall, with the entrance carved, a fixed texture pack, and nothing else — and both `mockDB.seedRoom()` and `selectionHarness.createRoom()` go through it. Single-player rooms keep their real template, since that template *is* what those scenarios are about.

The generator itself is covered separately by `room-generation.test.ts`.

### The DB Suite (`scenarios/db.test.ts`, `helpers/emulatorDB.ts`)

Mocking the DB layer leaves the query runners — the code deciding what Firestore is actually asked to do — with nothing exercising them. A mock cannot fill that gap, because what these tests are about is what a real Firestore does: which operations it accepts inside a transaction, how many writes it takes in one commit, what it stores when a write is malformed, and what it does when two writers reach the same document. So this suite runs the real runners against the Firestore emulator, and covers every query type (insert, select, update, delete, batch) along with the read-through cache, the query rate monitor, row version migration, and the migration write-back.

`emulatorDB.ts` gives it what the harness gives gameplay tests: a way to seed stored state directly (including states the query layer would never produce, such as a row left at an outdated version), a way to read a document exactly as stored — with no migration, caching or id-injection in the way — a wait for fire-and-forget writes to land, and a capture of what the DB layer logged.

Two properties of this suite are worth knowing when adding to it:

- **The emulator is more permissive than Firestore.** It accepts oversized commits that a real project rejects. So a test about splitting a write across commits asserts on the number of commits issued, not merely on the write succeeding.
- **The write-back is fire-and-forget by design.** Assertions about it wait for the document to change rather than assuming it already has.

The suite is part of the ordinary `test:integration` run, and therefore of the `pre-commit` hook: an emulator is started for the run when none is already up. See [workflow.md](workflow.md#the-db-suite-and-the-firestore-emulator).

### Scenario Runner (`helpers/scenarioRunner.ts`)

The runner executes a declarative `ScenarioConfig`:

```typescript
interface ScenarioConfig {
    name: string;              // Human-readable description
    rooms: RoomConfig[];       // Rooms to seed
    users?: UserConfig[];      // Users to connect (and optionally join to rooms)
    latency?: LatencyConfig;   // Optional DB latency simulation
    actions?: Action[];        // Action sequence to execute
    invariants?: InvariantSet; // Which invariants to check ("structural" | "full")
    skipInvariants?: boolean;  // Skip invariant checking
    assertions?: Function;     // Custom assertions on final state
    skipCleanup?: boolean;     // Don't auto-disconnect at end
}
```

Execution flow: `reset -> latency config -> seed rooms -> pre-place voxels -> connect users -> join rooms -> execute actions -> check invariants -> run assertions -> cleanup`

### Action Engine (`helpers/actions.ts`)

Every atomic operation is an `Action` type:

| Action | Description |
|--------|-------------|
| `connect` | Connect a new user |
| `disconnect` | Disconnect a user (optionally saving state) |
| `reconnectCaseA` | New socket before old disconnect |
| `reconnectCaseB` | Old disconnect before new socket |
| `joinRoom` | Move user into a room (optionally allowing a fallback when the room can't take them) |
| `requestRoomChange` | Room change via `onRequestRoomChangeSignalReceived` (saves previous room state) |
| `seedRoom` | Seed a room into mock DB |
| `moveObject` | Update player transform |
| `sendMessage` | Send chat message (object metadata) |
| `setPlayerComposition` | Set a player's mesh composition (from a seed, or a raw string) |
| `setObjectMetadata` | Set an arbitrary metadata key on a player object (optionally another user's) |
| `addVoxel` | Add a voxel block |
| `removeVoxel` | Remove a voxel block |
| `moveVoxel` | Move a voxel block |
| `setVoxelTexture` | Set voxel quad texture |
| `setUserRole` | Change a user's role (Owner/Editor/Visitor) |
| `setRoomOwner` | Set a user as the owner of a room |
| `parallel` | Execute action groups concurrently |
| `gracefulShutdown` | Simulate server shutdown |
| `setLatency` | Toggle DB latency simulation |

The `parallel` action wraps groups of actions in `Promise.allSettled()` to test race conditions.

### Invariants (`helpers/invariants.ts`)

Structural invariants that must hold after any valid action sequence:

1. **User count consistency** - `ServerUserManager` user count matches tracked array
2. **Valid socket contexts** - Every user maps to a valid `SocketUserContext`
3. **Room participant counts** - Participant count matches `SocketRoomContext` user count
4. **Room ID references** - `currentRoomIDByUserID` only references loaded rooms with the user as participant
5. **Object ownership** - Every object in a room belongs to a room participant
6. **No multi-room users** - No user appears in multiple rooms simultaneously
7. **Player objects exist** - Every room participant has exactly one player object
8. **Player object & metadata presence** - Every in-room user has a player object and a readable `ServerUserManager.getPlayerMetadata` snapshot
9. **Physics room consistency** - Every occupied room has a loaded physics room
10. **Physics object consistency** - Every participant's player object exists in the physics system
11. **User role consistency** - Room owners in the room have the Owner role

Invariant sets: `"structural"` (checks 1–7), `"full"` (adds 8), `"extended"` (adds 9–11).

There is also a clean-state check for use after every user has disconnected. It requires no user or room reference to be left behind, and no room to still be loaded — except hubs, which stay resident by design (see [room_population.md](../../networking/room_population.md#hub-residency)) and must simply be empty.

Signal utilities:
- `getPendingSignals(ctx, signalType)` - Read buffered signals from a user's `SocketUserContext`
- `checkMulticastSignalReach()` - Verify multicast reached all except excluded user
- `checkUnicastSignalReach()` - Verify unicast reached only the target

### Scenario Presets (`helpers/scenarioPresets.ts`)

Reusable building blocks:
- **Room presets**: `EMPTY_HUB`, `EMPTY_REGULAR`, `regularRoom(id)`, `hubRoom(id)`, `roomWithWall(id,row,col)`, `multipleRooms(count)`
- **User presets**: `userAtCenter(roomID)`, `userAt(x,z,roomID)`, `namedUser(id,roomID)`, `usersInRoom(count,roomID)`
- **Action presets**: `walkAcross()`, `buildColumn()`, `removeColumn()`, `reconnectUser()`, `disconnectWithSave()`, `disconnectWithoutSave()`, `parallel()`, `enableLatency()`, `disableLatency()`
- **Permission presets**: `setOwner(userIndex,roomID)`, `promoteToEditor(userIndex)`, `demoteToVisitor(userIndex)`
- **Composite presets**: `addAndTextureVoxel()`, `buildAndMoveBlock()`

## Property-Based Testing

Uses [fast-check](https://github.com/dubzzz/fast-check) to generate random action sequences and verify invariants hold.

Parameterized over:
- **Weight profiles** - Control the distribution of action types (balanced, connect-heavy, disconnect-heavy, room-switch-heavy, voxel-heavy, reconnect-heavy, voxel-mixed, permission-mixed)
- **Latency** - Tests run both with and without simulated DB latency
- **Room types** - Regular rooms (permission-gated) and Hub rooms (open editing)

Each profile generates `maxActions` random actions for `numRuns` iterations. After each sequence, structural invariants are checked.

## Adding New Tests

### New Scenario Test

```typescript
it("my new test", async () => {
    await runScenario({
        name: "description",
        rooms: [hubRoom("my-room")],
        users: [userAtCenter("my-room"), userAt(20, 20, "my-room")],
        actions: [
            { type: "addVoxel", userIndex: 0, row: 10, col: 10, layer: 0 },
        ],
        assertions: ({ users, harness }) => {
            // Custom assertions here
        },
    });
});
```

### New Test Outside the Harness

Some subjects are not room/session gameplay: HTTP route handlers, user commands, DB row migrations, and client-side utilities. Those tests skip the harness (which globally mocks `userCommandUtil` and only exposes the DB fields gameplay needs) and declare their own `vi.mock` factories per file, then import the module under test afterwards — see `ftue.test.ts`, `auth-lifecycle.test.ts` and `room-api.test.ts`.

Recurring recipes in those files:
- **Route handlers** — find the layer in the router's `stack` by path and method, then walk `layer.route.stack` with a mock `req`/`res`. A pre-set `req.userString` plus a mocked `userIdentificationUtil` stands in for an identified user.
- **Client-side utilities** — mock `src/client/app` and `src/client/networking/client/socketsClient` so the util runs against a plain user object and a recorded list of emitted signals. Mock `src/client/system/clientObservables` too (the real module reaches into three.js), re-exporting real `Observable` instances for the channels under test.

### New Action Type

1. Add the type to the `Action` union in `actions.ts`
2. Add a case to `executeAction()`
3. Optionally add a fast-check arbitrary to `buildActionArbitrary()`

### New Invariant

1. Add the check function to `invariants.ts`
2. Wire it into `checkStructuralInvariants()` or create a new composite

## Running Tests

See [workflow.md](workflow.md) for commands to run integration tests.
