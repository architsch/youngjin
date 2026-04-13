# Integration Test Workflow

- Integration tests automatically run via `test:integration` in husky's `pre-commit` hook whenever `git commit` gets triggered.

# How to Run Integration Tests Manually

- `test:integration` - run integration tests
- `test:integration:watch` - run integration tests in watch mode (re-runs on file change)
- `test:integration:ui` - run integration tests with Vitest's browser-based UI