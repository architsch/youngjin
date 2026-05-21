# E2E Test Workflow

- `.github/workflows/e2e-tests.yml` - Workflow for automatically running the E2E tests when the project gets deployed to the staging server.

# How to Run E2E Tests Manually

- `npm run test:e2e` — run all tests headlessly (against the staging server)
- `npm run test:e2e:headed` — run with visible browser (against the staging server)
- `npm run test:e2e:debug` — step through with Playwright Inspector (against the staging server)
- `npm run test:e2e:local` — run against a local dev server

## Local Runs Auto-Start the Dev Server

`npm run test:e2e:local` points Playwright at `http://127.0.0.1:3000`. Through Playwright's
`webServer` option (see `playwright.config.ts`), a local run will either:

- **Reuse** a dev server already listening on port 3000 (and leave it running afterward), or
- **Auto-start** one with `npm run dev` when nothing is listening — waiting until `/health`
  answers (up to 180s while the bundles compile), then shutting it down when the run ends.

So a single `npm run test:e2e:local` is enough — no second terminal required.

**Prerequisite:** the auto-start path runs `npm run dev`, which fetches secrets from Google
Secret Manager, so you must have logged in once with `gcloud auth application-default login`
(see [local_dev.md](../../devOps/local_dev.md)). If that boot fails (e.g. missing credentials),
Playwright reports a timeout waiting for `/health`; the piped dev-server output shows the
underlying cause. The remote `test:e2e` variants never start a local server.