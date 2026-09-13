# Integration Test Framework

Integration tests run the real server modules (`ServerRoomManager`, `ServerUserManager`, `ServerObjectManager`, `ServerVoxelManager`, `PhysicsManager`, `ObjectUpdateUtil`, `VoxelUpdateUtil`) against a mocked DB, with no network I/O. The DB suite is the exception.

```
Scenario tests → Scenario runner → Action engine / Invariants / Presets → Server harness → Real server modules
```

## Helpers (`tests/integration/helpers/`)
- **`serverHarness.ts`**: mocks `dbRoomUtil`, `dbUserUtil` and `dbSearchUtil` with in-memory stores (room creation yields real, loadable rooms), calls `setIsServer()`, and supports optional DB latency.
  - Session helpers: `connectUser`, `joinRoom` (explicit destination), `appStartJoin` (mirrors connect-time picking with fallback), `disconnectUser`, `reconnectCaseA` (new socket first), `reconnectCaseB` (old disconnect first), `gracefulShutdown`. Reconnects rebuild the context from the mocked `DBUser`.
  - Population helpers: `loadRoom`, `fillRoomWithUsers`, `setSyntheticRoomPopulation` (fakes participants, so scenarios using it must skip structural invariants).
- **`roomContent.ts`**: `createTestRoom()` builds a deterministic shell (an open floor per storey, the entrance door, a fixed texture pack) instead of a seeded procedural room. `mockDB.seedRoom()` and `selectionHarness.createRoom()` use it. Single-player rooms keep their real template. The generator itself is covered by `room-generation.test.ts`.
- **`scenarioRunner.ts`**: runs a declarative `ScenarioConfig` (`rooms`, `users`, `latency`, `actions`, `invariants`, `assertions`, skip flags) in this order: reset → seed → connect/join → actions → invariants → assertions → cleanup.
- **`actions.ts`**: the `Action` union covers session, room, movement, chat and metadata, voxel, ownership (`setRoomOwner` writes both sides and `DBUser`), `parallel` (`Promise.allSettled`, for race conditions), shutdown and latency operations.
- **`invariants.ts`**: structural consistency checks across users, contexts, rooms, objects, physics and ownership. There are three sets: `"structural"`, `"full"` and `"extended"`. A clean-state check runs after everyone has disconnected (hubs may remain loaded but must be empty). Signal helpers: `getPendingSignals`, `checkMulticastSignalReach`, `checkUnicastSignalReach`.
- **`scenarioPresets.ts`**: reusable room, user, action, permission and composite presets.

## The DB Suite
`scenarios/db.test.ts` runs the real query runners against the emulator, covering all query types, the read-through cache, the rate monitor, row version migration and migration write-back. `emulatorDB.ts` seeds raw stored state (including outdated versions), reads documents exactly as stored, waits for fire-and-forget writes, and captures DB logs.
- **The emulator is more permissive than Firestore** (e.g. it accepts oversized commits), so assert on the commit count rather than on success.
- **Write-back is fire-and-forget**, so wait for the document to change.

See [workflow.md](workflow.md#the-db-suite-and-the-firestore-emulator) for how the emulator is provided.

## Property-based tests
fast-check generates random action sequences across weight profiles (balanced, connect-heavy, voxel-heavy, etc.), with and without latency, in Regular and Hub rooms. Structural invariants are checked after each sequence.

## Adding tests
- **Scenario**:
  ```typescript
  it("my new test", async () => {
      await runScenario({
          name: "description",
          rooms: [hubRoom("my-room")],
          users: [userAtCenter("my-room")],
          actions: [{ type: "addVoxel", userIndex: 0, row: 10, col: 10, layer: 0 }],
          assertions: ({ users, harness }) => { /* ... */ },
      });
  });
  ```
- **Outside the harness** (HTTP routes, user commands, DB migrations, client utilities): declare per-file `vi.mock` factories and import the module under test afterwards (see `ftue.test.ts`, `auth-lifecycle.test.ts`, `room-api.test.ts`).
  - Route handlers: find the router `stack` layer by path and method, then walk `layer.route.stack` with mock `req`/`res`. A preset `req.userString` plus a mocked `userIdentificationUtil` stands in for an identified user.
  - Client utilities: mock `src/client/app`, `socketsClient` and `clientObservables` (the real module pulls in three.js), re-exporting real `Observable`s where needed.
- **New action**: add it to the `Action` union, handle it in `executeAction()`, and optionally add it to `buildActionArbitrary()`.
- **New invariant**: add it to `invariants.ts` and wire it into a composite such as `checkStructuralInvariants()`.
