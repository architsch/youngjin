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

- Random variations in each event:
    - Latencies (in HTTP requests, socket communication, DB queries, etc)
    - Validity of the parameters (e.g. whether the room that the user tries to join exists or not, etc)

- Combinations of events to try:
    - Concurrent execution of multiple events of the same type and same parameters (e.g. Two users adding a voxel-block to the same position at the same time).
    - Concurrent execution of multiple events of the same type but different parameters (e.g. Two users adding voxel-blocks to two different positions at the same time).
    - Concurrent execution of multiple events of different types.
    - Execution of a sequence of random types of events at random points in time.

### How to Run Integration Tests Manually

- `test:integration` - run integration tests
- `test:integration:watch` - run integration tests in watch mode (re-runs on file change)
- `test:integration:ui` - run integration tests with Vitest's browser-based UI