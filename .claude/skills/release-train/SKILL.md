---
name: release-train
description: Run the full release pipeline for a batch of changes — sync docs and tests to the code, audit the project's own skills, publish a dev-log post, commit and push, watch the GitHub Actions deployment to staging and fix what fails, run VPS maintenance, then playtest the deployed staging server. Use when asked to ship, release, run the release train, take a feature all the way to staging, or run the whole end-to-end workflow.
---

# Release Train

Takes one batch of finished work from a dirty working tree to a verified deployment on staging, in
six phases. Each phase has an owner, a definite output, and a point at which it hands over.

You are the **orchestrator**. Your job is sequencing, the approval gates, and the final report —
not doing the phases yourself. Delegate each phase to a subagent, because the six together are far
more context than one agent can hold, and a phase that runs out of room mid-way produces confident
half-work.

| # | Phase | Runs as | Skill |
|---|---|---|---|
| 1 | Docs and tests catch up with the code | subagent | `docs-and-tests-sync` |
| 2 | The project's own skills are audited | subagent | `skill-upkeep` |
| 3 | A dev-log post is written and published | subagent | `devlog-post` |
| 4 | Commit, push, watch CI, fix failures | **main thread** | [reference/ci-watch.md](reference/ci-watch.md) |
| 5 | VPS maintenance | subagent | `vps-maintenance` |
| 6 | Staging playtest | subagent | `staging-playtest` |

Between 3 and 4 the run stops at an approval gate: the dev-log post is the user's to approve, and
nothing is committed until they have.

Arguments narrow the run: `--from <n>` starts at a phase, `--only <n,m>` runs just those. With no
arguments, run all six.

## Run state

Long runs get compacted. Before phase 1, create `temp/release-train/<YYYY-MM-DD-HHmm>.md` and keep
it current as each phase reports — it is what lets the run be picked up after a summarisation, and
what the final report is assembled from. `temp/` is gitignored, so it never enters the changeset.

Record, per phase: status, what it changed (paths), what it found, and what it deliberately left.
Also record the run's fixed facts at the top: the starting HEAD, the change set, the dev-log subject
once chosen, and whether the user has approved the dev-log post at checkpoint B.

Write that approval down the moment it is given, and never assume one that is not written down. A
run picked up after a summarisation cannot tell an approved post from an unapproved one by looking
at the files — both are just a page under `public/devlog-2026/`. If the state file does not say the
user approved, the post is not approved: ask again.

## Phase 0 — Survey

Before delegating anything, establish what this batch actually contains:

```bash
git status --short
git log origin/main..HEAD --oneline
git diff origin/main...HEAD --stat -- . ':!dist'
git diff HEAD --stat -- . ':!dist'
```

Write the change set into the state file. Phases 1, 2 and 3 all key off it, and deriving it three
times independently is how three agents end up describing three different releases.

If the working tree is clean and nothing is unpushed, there is nothing to ship. Say so and stop.

## Phases 1 and 2 — In parallel

These touch disjoint files, so run both subagents at once. Give each the change set from phase 0
rather than making it re-derive one, and state the file ownership explicitly in the brief, because
it is the only thing keeping them apart:

- **Phase 1 owns** `tests/`, `docs/`, `CLAUDE.md`, `README.md`.
- **Phase 2 owns** `.claude/skills/`.

Neither may touch `src/`. If either concludes that a source change is needed, it reports that as a
finding and does not make it — a docs pass that quietly edits application code is a docs pass whose
diff nobody will read carefully.

## Checkpoint A — the dev-log subject

Phases 1 and 2 report; summarise both to the user briefly. Then ask, once, which feature the dev-log
post should cover, offering the two or three most substantial user-visible changes from the change
set as options, plus the option to skip the post entirely.

This is a genuine judgement call — one post covers one feature, the post is an advertisement aimed
at people who have never played the game, and the batch usually contains several candidates. Ask it
here rather than at the start, so the options are drawn from a change set that has actually been
read. Together with checkpoint B, which judges the post that comes out of it, this is one of the two
interruptions before the commit gate.

## Phase 3 — Dev-log post

Delegate to `devlog-post` with the chosen feature named. It boots a local dev server, captures
screenshots against the running game, writes the post, and regenerates the static site.

Two things to check when it reports back, because both are silent failures: the new page exists
under `public/devlog-2026/` and contains the post's title, and every image the page references is
actually a file in that directory. Also confirm the dev server it started was stopped, or phase 4's
build competes with it for port 3000.

## Checkpoint B — approve the dev-log post

**The run stops here and waits for the user.** The post is the one output of this workflow that no
automated check can judge. It is public writing published under the project's name, aimed at people
who have never seen the game, and whether it reads well is a human call. Phase 4 commits it, so the
approval has to happen before phase 4 begins, not after.

Give the user everything they need to judge it without opening files themselves:

- The post's title and page number, and the local preview URL
  `http://127.0.0.1:3000/devlog-2026/page-<N>.html` — noting that a dev server has to be running for
  it, since phase 3 stops the one it started.
- The screenshot files by path, so they can be opened and looked at.
- The **full post text as the user will paste it**, in a copyable block, with its character count.

Then ask for approval, and stop. Do not run `npm run beforeCommit`, do not commit, do not push, do
not start any later phase until the user has actually approved. A reply about something else is not
approval, and neither is no reply at all.

### When the user asks for changes instead

Read the note as being about how dev-log posts are *made*, not only about this one — otherwise the
same fault comes back on the next release, and the user gives the same note again. In order:

1. **Fold the advice into the `devlog-post` skill**, on the main thread, before regenerating
   anything. Put it where that subject already lives: `SKILL.md` for the rules of the post itself,
   `reference/writing.md` for voice, structure and what to cut, `reference/capture.md` for the
   screenshots, `reference/post-format.md` for the source format, `reference/hashtags.md` for the
   tag bank. Write it as a standing rule, in the register of the rules already there — "the closing
   paragraph never restates the opening", not "the user disliked the ending this time". If the note
   really does apply only to this one post, fix the post and say plainly that no rule came out of
   it, rather than inventing a general rule from a single case.
2. **Delegate phase 3 again** with the same feature named, briefing it on the user's note and on
   what the previous attempt left behind. The rerun **revises in place**: the newest block in
   `public/devlog-2026/source.txt` is the previous attempt's, and it gets replaced rather than
   appended after — otherwise the site grows a duplicate post. The page number stays the same,
   re-shot screenshots keep their filenames, and any screenshot the revision drops is deleted from
   `public/devlog-2026/` instead of being left orphaned.
3. **Come back to this checkpoint** with the new version. The loop runs until the user approves.
   There is no two-cycle bound here — a human answers every round, so no round is spent guessing —
   but each one costs another dev-server boot, so gather the user's notes into one brief rather
   than making a round per remark.

The skill edits from step 1 are working-tree changes like any other: record them in the state file,
let phase 4 commit them with the rest, and list them in the final report.

The user may also decide to drop the post here. Then remove its block from `source.txt` along with
the screenshots it added, regenerate the static site so no half-post page is left behind, and go on
to phase 4 without a post.

## Phase 4 — Commit, push, watch

**On the main thread.** The commit and the push are the user's decisions, and a prompt raised inside
a subagent is one the user answers without the context that produced it.

Full procedure in [reference/ci-watch.md](reference/ci-watch.md). In outline: `npm run beforeCommit`
so the committed bundles are production builds and the dev-log page is generated, review the whole
non-`dist/` diff, propose the commit, push, then watch *Deploy to Staging* and *E2E Tests (Staging)*
with `gh run watch --exit-status`.

Fixing CI failures is bounded at **two** fix-and-push cycles, and several classes of failure are out
of scope entirely — the reference file lists which. Never trigger *Promote to Live* or
*Rollback Live*; production is not part of this workflow at any point.

Do not proceed until *Deploy to Staging* has succeeded and the staging `/health` endpoint reports
the commit that was just pushed.

## Between 4 and 5 — Snapshot the log backlog

One command, on the main thread, and it must happen **before** phase 5:

```bash
node dev/scripts/playtest/serverMonitor.js history --app staging --top 20 > temp/release-train/backlog-<runID>.json
```

The reason is a real interaction between the two remaining phases. Phase 5's `reclaim --apply`
compresses already-rotated PM2 logs, and the log survey that phase 6 depends on reads those rotated
files by glob — after compression they no longer match, so the playtest would see a much shorter
backlog and read long-standing noise as new findings. Taking the snapshot first makes the order
safe. Hand the file's path to phase 6.

## Phase 5 — VPS maintenance

Delegate to `vps-maintenance`. It audits the machine in one read-only pass and applies only
non-disruptive housekeeping.

Two boundaries, and the orchestrator enforces them as much as the phase does: **nothing reboots the
machine**, and package upgrades happen only with the user's approval and only with a dry-run plan in
hand. That VPS runs live as well as staging — every disruptive act there is an outage of
`app.thingspool.net`. Pending reboots and version mismatches get reported, not resolved.

## Phase 6 — Staging playtest

Delegate to `staging-playtest`, passing the backlog snapshot from above and the commit that phase 4
confirmed on the server. It seeds the database states ordinary play cannot produce, drives concurrent
browser sessions, and correlates everything against the server's logs.

Give it the whole run's context: what changed in this batch, so it can aim at the parts of the
system this release actually touched rather than running a generic sweep.

## Final report

Assemble from the state file, in this order:

1. **Shipped** — the commit, what it contains, the deployment result, and the commit staging is
   serving.
2. **Findings that need the user** — CI failures left unfixed, VPS items requiring a human decision,
   new errors the playtest found. Each with its evidence. This section goes near the top because it
   is the reason to read the report.
3. **Changed** — docs, tests, skills, the dev-log post (with its URL and the pasteable text), and
   any rules checkpoint B's revisions wrote into the `devlog-post` skill.
4. **Verified** — the suites that passed, the states the playtest confirmed, the machine checks that
   came back clean.
5. **Not covered** — every phase that was skipped, bounded out, or blocked, and why.

Keep the categories apart. A release report that mixes what was verified with what was assumed is a
report that will be trusted about the wrong things.

## Boundaries for the whole run

- **Never push to production.** No `Promote to Live`, no `Rollback Live`, no direct writes to live
  data, no restarts of the `live` PM2 process.
- **Never reboot or restart services on the VPS** as part of an automated run.
- **Never commit a dev-log post the user has not approved.** Checkpoint B is a stop, not a notice.
- **Two fix cycles, then stop.** This applies to CI failures and to anything else that starts
  looping. Repeatedly pushing while guessing is the failure mode with the highest cost here.
- **Report failures as failures.** A red suite, a phase that could not complete, a finding that was
  not chased — all of these go in the report as they are. The value of this workflow is that it says
  what actually happened across six phases nobody watched individually.
