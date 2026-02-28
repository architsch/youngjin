# Tests

## E2E Tests

### E2E Test Workflow

- `.github/workflows/e2e-tests.yml` - Workflow for automatically running the E2E tests when the project gets deployed to the staging server.

### How to Run E2E Tests Manually

- `npm run test:e2e` — run all tests headlessly (in staging server)
- `npm run test:e2e:headed` — run with visible browser (in staging server)
- `npm run test:e2e:debug` — step through with Playwright Inspector (in staging server)
- `npm run test:e2e:local` — test in local dev server

## Integration Tests

### Integration Test Coverage Criteria

- Types of events:
    - User connecting to the socket server.
    - User disconnecting from the socket server.
    - User reconnecting by first signaling a socket connection and then signaling a socket disconnection in rapid succession (e.g. Case A in `gameSockets.ts`)
    - Use reconnecting by first signaling a socket disconnection and then signaling a socket connection in rapid succession (e.g. Case B in `gameSockets.ts`)
    - User joining a room (via `RoomChangeRequestParams`) which hasn't been loaded yet in RoomManager.
    - User joining a room (via `RoomChangeRequestParams`) which has already been loaded in RoomManager.
    - User modifying a part of the room's voxelGrid (via `updateVoxelGridParams`).
    - User sending an object-message (via `objectMessageParams`).
    - User moving an object (e.g. player) in 3D space (via `objectSyncParams`).
    - Server restarting.
    - Graceful shutdown and rebooting of the server.

- Random variations in each event:
    - Latencies (in HTTP requests, socket communication, DB queries, etc)
    - Validity of the parameters (e.g. whether the room that the user tries to join exists or not, etc)

- Combinations of events to try:
    - Concurrent execution of multiple events of the same type and same parameters (e.g. Two users adding a voxel-block to the same position at the same time).
    - Concurrent execution of multiple events of the same type but different parameters (e.g. Two users adding voxel-blocks to two different positions at the same time).
    - Concurrent execution of multiple events of different types.
    - Execution of a sequence of random types of events at random points in time.

- Things to verify:
    - Each user's gameplay state gets preserved whenever the user leaves the room, joins the room, or disconnects/reconnects. Also, this gameplay state gets synced up across all users in the same room.
    - Each user's object-message gets communicated to all other users in the same room (including those who join the room after the message is being sent).
    - When the server receives `objectSyncParams` signals from the users, it updates their corresponding PhysicsObjects based on the rules of the physics system, and resolves considerable discrepancies between server-side and client-side physics states by means of `objectDesyncResolveParams`. The updated ObjectTransforms are synced up across all users in the same room.
    - The state of each room's RoomRuntimeMemory is always preserved, gets updated only in ways expected by the users' actions (such as those which involve `updateVoxelGridParams`), and gets communicated to all users who either are joining the room or are already in the room.

- **What the integration tests should be aiming for**:
    - Integration tests should try out random combinations of events (described above), and identify points of failure in them (i.e. points which deviate from the app's expectations).

### How to Run Integration Tests Manually

- `test:integration` - run integration tests
- `test:integration:watch` - run integration tests in watch mode (re-runs on file change)
- `test:integration:ui` - run integration tests with Vitest's browser-based UI