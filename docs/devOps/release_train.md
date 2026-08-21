# Release Train

An AI-orchestrated pipeline that takes one batch of finished work from a dirty working tree to a
verified deployment on staging. It is driven by the `release-train` skill in `.claude/skills/`, and
each of its phases is a skill that also stands on its own.

The reason it exists is that the work surrounding a release — documentation that has fallen behind,
tests that never caught up, a dev-log post, watching CI, checking on the machine — is individually
small, collectively large, and the first thing dropped when the interesting part is finished. None
of it is hard; all of it is easy to skip.

## The phases

| # | Phase | Skill | Runs as |
|---|---|---|---|
| 1 | Documentation and tests catch up with the code | `docs-and-tests-sync` | subagent |
| 2 | The project's own skills are audited against the code they drive | `skill-upkeep` | subagent |
| 3 | A dev-log post is written and published | `devlog-post` | subagent |
| 4 | Commit, push, watch GitHub Actions, fix failures | — | main thread |
| 5 | VPS maintenance | `vps-maintenance` | subagent |
| 6 | Staging playtest | `staging-playtest` | subagent |

Phases 1 and 2 run in parallel — they own disjoint files (`tests/`, `docs/`, `CLAUDE.md`,
`README.md` for the first; `.claude/skills/` for the second) and neither may touch `src/`. The rest
are sequential, because each depends on the one before it having landed.

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

Phase 5's disk reclamation compresses already-rotated PM2 log files, and the log survey phase 6
depends on locates those files by name. Running the reclamation first would leave the playtest with
a much shorter view of the server's error history, and long-standing noise would read as new
findings. The orchestrator therefore snapshots the log backlog before phase 5 and hands the snapshot
to phase 6.

## Related

- [VPS Maintenance](vps/maintenance.md) — the manual procedures phase 5 reports against rather than
  performing
- [Deployment](vps/deployment.md) — what the staging and live deployments actually do
- [Staging Playtest Workflow](../testing/playtest/workflow.md) — the tooling behind phase 6
- [E2E Test Workflow](../testing/e2e/workflow.md) — the suite that gates a deployment
