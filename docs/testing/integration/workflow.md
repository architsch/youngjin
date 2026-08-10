# Integration Test Workflow

- Integration tests automatically run via `test:integration` in husky's `pre-commit` hook whenever `git commit` gets triggered.
- That run includes the DB suite, which needs a Firestore emulator — one is started for the run if none is already up. See [The DB Suite and the Firestore Emulator](#the-db-suite-and-the-firestore-emulator).

# How to Run Integration Tests Manually

- `test:integration` - run integration tests (starting a Firestore emulator if needed)
- `test:integration:nodb` - run integration tests against whatever is already there, skipping the DB suite if no emulator is up
- `test:integration:watch` - run integration tests in watch mode (re-runs on file change)
- `test:integration:ui` - run integration tests with Vitest's browser-based UI
- `test:integration:db` - run only the DB suite, with a Firestore emulator started for the run

# The DB Suite and the Firestore Emulator

`db.test.ts` is the one suite that runs against a real Firestore rather than the DB mock, so it needs the Firestore emulator listening on `FIRESTORE_EMULATOR_HOST` (`127.0.0.1:8080` by default). Without one it skips itself — which would mean the DB layer is covered only on the runs where somebody happened to have an emulator open. So `test:integration` goes through `dev/scripts/runIntegrationTests.js`, which guarantees there is one:

- **An emulator is already listening** (a `npm run dev` session, typically) — it is reused. Starting a second one would fail on the taken port, and the tests keep to their own collections regardless.
- **Otherwise** — a throwaway emulator is started, and lives exactly as long as the test run.
- **No emulator can be started** — the run fails rather than quietly proceeding without DB coverage. The usual cause is the Firebase CLI missing for the current Node.js version: globally installed CLIs belong to the version that installed them, so switching versions strands them and `npm install -g firebase-tools` restores them.

Starting an emulator adds a few seconds to the run. Use `test:integration:nodb` to skip that while iterating on suites that don't touch the DB.

The suite writes to, and clears, whole collections. Two things keep that safe:

- Vitest sets `DB_PREFIX` to `dbtest_`, so the suite has collections of its own and never touches the ones a local `npm run dev` session keeps its data in.
- The suite refuses to run at all unless `FIRESTORE_EMULATOR_HOST` is set, so it cannot reach a real Firestore project.