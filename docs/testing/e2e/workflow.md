# E2E Test Workflow

`.github/workflows/e2e-tests.yml` runs the Playwright suite against staging after each successful staging deploy.

| Command | Target |
|---|---|
| `npm run test:e2e` | staging, headless |
| `npm run test:e2e:headed` | staging, visible browser |
| `npm run test:e2e:debug` | staging, Playwright Inspector |
| `npm run test:e2e:local` | `http://127.0.0.1:3000` |

A local run reuses a dev server that is already on port 3000, or starts `npm run dev` through Playwright's `webServer` option and waits for `/health`. Auto-start needs `gcloud auth application-default login` (see [local_dev.md](../../devOps/local_dev.md)). A `/health` timeout usually means the dev server failed to boot, and its piped output shows why.
