# Integration Test Framework

## Architecture

The integration test framework exercises real server-side game logic (room management, object management, voxel operations, physics, signal routing) against a mocked database layer. No actual Firestore or network I/O occurs.

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
- Mocks all database utilities (`dbRoomUtil`, `dbUserUtil`, `dbSearchUtil`, `dbUserRoomStateUtil`) with in-memory stores
- Calls `setIsServer()` so server-only validation gates (e.g. Player `canUserAddObject`) pass
- Provides convenience methods: `connectUser()`, `joinRoom()`, `disconnectUser()`, `reconnectCaseA()`, `reconnectCaseB()`, `gracefulShutdown()`
- Supports configurable latency simulation on DB operations
- Exposes direct access to `ServerRoomManager`, `ServerUserManager`, `ServerObjectManager`, `PhysicsManager`

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
| `joinRoom` | Move user into a room |
| `seedRoom` | Seed a room into mock DB |
| `moveObject` | Update player transform |
| `sendMessage` | Send chat message (object metadata) |
| `addVoxel` | Add a voxel block |
| `removeVoxel` | Remove a voxel block |
| `moveVoxel` | Move a voxel block |
| `setVoxelTexture` | Set voxel quad texture |
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
8. **Transform consistency** - In-room object transforms match `getUserGameplayState` output

Signal utilities:
- `getPendingSignals(ctx, signalType)` - Read buffered signals from a user's `SocketUserContext`
- `checkMulticastSignalReach()` - Verify multicast reached all except excluded user
- `checkUnicastSignalReach()` - Verify unicast reached only the target

### Scenario Presets (`helpers/scenarioPresets.ts`)

Reusable building blocks:
- **Room presets**: `EMPTY_HUB`, `EMPTY_REGULAR`, `regularRoom(id)`, `hubRoom(id)`, `roomWithWall(id,row,col)`
- **User presets**: `userAtCenter(roomID)`, `userAt(x,z,roomID)`, `usersInRoom(count,roomID)`
- **Action presets**: `walkAcross()`, `buildColumn()`, `removeColumn()`, `parallel()`, `enableLatency()`, `disableLatency()`

## Property-Based Testing

Uses [fast-check](https://github.com/dubzzz/fast-check) to generate random action sequences and verify invariants hold.

Parameterized over:
- **Weight profiles** - Control the distribution of action types (balanced, connect-heavy, disconnect-heavy, room-switch-heavy, voxel-heavy, reconnect-heavy)
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

### New Action Type

1. Add the type to the `Action` union in `actions.ts`
2. Add a case to `executeAction()`
3. Optionally add a fast-check arbitrary to `buildActionArbitrary()`

### New Invariant

1. Add the check function to `invariants.ts`
2. Wire it into `checkStructuralInvariants()` or create a new composite

## Running Tests

```bash
# All integration tests
npx vitest run tests/integration/

# Specific scenario file
npx vitest run tests/integration/scenarios/connection.test.ts

# Watch mode
npx vitest tests/integration/scenarios/
```
