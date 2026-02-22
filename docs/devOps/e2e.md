# E2E Tests

## Workflows

- `.github/workflows/e2e-tests.yml` - Workflow for automatically running the E2E tests when the project gets deployed to the staging server.

## How to Run E2E Tests Manually

- `npm run test:e2e` — run all tests headlessly (in staging server)
- `npm run test:e2e:headed` — run with visible browser (in staging server)
- `npm run test:e2e:debug` — step through with Playwright Inspector (in staging server)
- `npm run test:e2e:local` — test in local dev server