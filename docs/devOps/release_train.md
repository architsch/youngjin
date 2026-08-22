# Release Train

An AI-orchestrated pipeline that takes one batch of finished work from a dirty working tree to a
verified deployment on staging. It is driven by the `release-train` skill in `.claude/skills/`, and
each of its phases is a skill that also stands on its own.

The reason it exists is that the work surrounding a release — a skills audit, a dev-log post,
watching CI, checking on the machine, playtesting what was deployed — is individually small,
collectively large, and the first thing dropped when the interesting part is finished. None of it is
hard; all of it is easy to skip.

## The phases

| # | Phase | Skill | Runs as |
|---|---|---|---|
| 1 | The project's own skills are audited against the code they drive | `skill-upkeep` | subagent |
| 2 | A dev-log post is written and published | `devlog-post` | subagent |
| 3 | Commit, push, watch GitHub Actions, fix failures | — | main thread |
| 4 | VPS maintenance | `vps-maintenance` | subagent |
| 5 | Staging playtest | `staging-playtest` | subagent |

Phases 1 and 2 run in parallel — they own disjoint files (`.claude/skills/` for the first, the
dev-log directory and its screenshots for the second) and neither may touch `src/`, `docs/` or
`tests/`. The rest are sequential, because each depends on the one before it having landed.

Documentation and tests are not a phase. They are kept in step with the code as each feature is
built, so re-auditing them at release time mostly re-reads the batch to confirm what is already
true. `docs-and-tests-sync` stands on its own for the case where a batch did get ahead of them.

## Why the phases are delegated

Everything except the commit runs in a subagent, and that is the pipeline's central structural
choice rather than a detail of how it happens to be written. The five phases together are far more
context than one agent can hold, and an agent that runs out of room mid-phase does not stop — it
produces confident half-work. Delegating gives each phase a fresh context and returns only its
conclusions, which is also what keeps the orchestrator alive long enough to reach the approval gates
and the final report, the two things only it can produce.

The same reasoning shapes the orchestrator's own habits: it surveys the batch by diff statistics
rather than contents, trusts each phase's report instead of re-reading the files behind it, reviews
the pre-commit diff by exception against what the phases said they touched, and redirects verbose
build and CI output to files it greps rather than reads.

The orchestrator keeps a run-state file under `temp/release-train/`. A run of this length is
summarised at least once, and the file is what lets it be picked up afterwards rather than restarted.

## Where a human is required

Three points, deliberately:

- **The dev-log post.** The pipeline asks which feature the post should cover, and then stops again
  once the post exists, showing it in full and waiting for the user to approve it before anything is
  committed. It is public writing published under the project's name, and no automated check can
  tell a good one from a bad one. When the user asks for changes instead, the advice is written back
  into the `devlog-post` skill as a standing rule before the post is regenerated, so that the same
  correction does not have to be given again on the next release.
- **The commit and the push.** These run on the main thread rather than in a subagent, so the
  approval prompt reaches the user with the diff that produced it in view. Pushing to `main`
  triggers deployment, which makes it the point of no return for staging.
- **Any VPS mutation beyond housekeeping.** Package upgrades need approval with a dry-run plan in
  hand. Reboots are not automated at all.

Everything else is allowed to proceed unattended, which is what the permission rules in
`.claude/settings.json` are arranged to support: observation is allowed, change asks.

## What deploys, and when

A push to `main` starts two independent workflows — `Deploy to Staging`, on the self-hosted runner
that is the VPS itself, and `Deploy static content to Pages`, which publishes `public/` (including
any new dev-log page). `E2E Tests (Staging)` follows, triggered by the deployment's completion event
and only when it succeeded.

`Promote to Live` and `Rollback Live` are manual-dispatch workflows and are not part of this
pipeline at any point. Dispatching them is denied to the assistant outright.

## Bounds

CI failures are fixed within the pipeline for at most two fix-and-push cycles. Beyond that the
problem is not the kind an unattended run should keep pushing at, and the run stops with a report.
Several classes of failure are out of scope from the start — a VPS runtime version mismatch, an
offline runner, anything touching secrets — because each has a documented manual procedure whose
ordering matters.

## Ordering constraint worth knowing

Phase 5 reports the errors a release introduced, which it can only do against a record of the
errors the server was already producing. That record has to be taken before anything in the run
touches the machine, and phase 4 is the first phase that does. The orchestrator therefore snapshots
the log backlog before phase 4 and hands the snapshot to phase 5; without it, long-standing noise
reads as new findings.

## Related

- [VPS Maintenance](vps/maintenance.md) — the manual procedures phase 4 reports against rather than
  performing
- [Deployment](vps/deployment.md) — what the staging and live deployments actually do
- [Staging Playtest Workflow](../testing/playtest/workflow.md) — the tooling behind phase 5
- [E2E Test Workflow](../testing/e2e/workflow.md) — the suite that gates a deployment
