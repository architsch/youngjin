# Release Train

An AI-orchestrated pipeline, driven by the `release-train` skill, that takes a batch of work from the working tree to a verified staging deployment.

| # | Phase | Skill | Runs as |
|---|---|---|---|
| 1 | Audit the project's own skills | `skill-upkeep` | subagent |
| 2 | Write and publish a dev-log post | `devlog-post` | subagent |
| 3 | Commit, push, watch GitHub Actions, fix failures | — | main thread |
| 4 | VPS maintenance | `vps-maintenance` | subagent |
| 5 | Staging playtest | `staging-playtest` | subagent |

- Phases 1 and 2 run in parallel on disjoint files. Neither touches `src/`, `docs/` or `tests/`. The remaining phases run in order.
- Docs and tests are kept current as features are built, so they are not a phase. `docs-and-tests-sync` exists for batches that fell behind.
- Phases run in subagents so each gets a fresh context. The orchestrator reads diff stats and phase reports rather than file contents, and keeps run state under `temp/release-train/` so a run can resume after summarization.
- **Human gates**: dev-log post approval (requested changes are written back into the skill), commit and push (pushing to `main` deploys staging), and any VPS change beyond housekeeping. Reboots are never automated.
- **Deploys**: a push to `main` triggers `Deploy to Staging` (self-hosted runner) and `Deploy static content to Pages`. `E2E Tests (Staging)` runs after a successful staging deploy. `Promote to Live` and `Rollback Live` are manual and denied to the assistant.
- **Bounds**: at most two CI fix-and-push cycles. Runtime version mismatches, an offline runner and secrets are out of scope (see [maintenance.md](vps/maintenance.md)).
- **Ordering**: the staging log backlog is snapshotted before phase 4 and handed to phase 5, so pre-existing errors are not reported as new.
