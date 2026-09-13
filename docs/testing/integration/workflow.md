# Integration Test Workflow

`npm run test:integration` runs in Husky's `pre-commit` hook.

| Command | Purpose |
|---|---|
| `test:integration` | all suites, starting a Firestore emulator if none is running |
| `test:integration:nodb` | all suites without starting an emulator (the DB suite skips itself if none is up) |
| `test:integration:watch` | watch mode |
| `test:integration:ui` | Vitest UI |
| `test:integration:db` | DB suite only, with an emulator |

## The DB Suite and the Firestore Emulator
`db.test.ts` runs against a real Firestore emulator on `FIRESTORE_EMULATOR_HOST` (default `127.0.0.1:8080`). `dev/scripts/runIntegrationTests.js` makes sure one is available:
- it **reuses** a running emulator (e.g. from `npm run dev`);
- otherwise it **starts** a throwaway emulator for the run;
- if none can start, the run **fails** rather than silently skipping DB coverage. The usual cause is `firebase-tools` missing after a Node.js switch (`npm install -g firebase-tools`).

Safety: Vitest sets `DB_PREFIX=dbtest_`, and the suite refuses to run without `FIRESTORE_EMULATOR_HOST`.
