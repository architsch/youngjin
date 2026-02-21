# E2E Tests

## Workflows

- `.github/workflows/e2e-tests.yml` - Workflow for automatically running the E2E tests when the project gets deployed to the staging server.

## How to Run E2E Tests Manually

- `npm run test:e2e` — run all tests headlessly
- `npm run test:e2e:headed` — run with visible browser
- `npm run test:e2e:debug` — step through with Playwright Inspector
- `E2E_BASE_URL=http://localhost:3000 npm run test:e2e` — test in local dev server