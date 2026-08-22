---
name: release-train
description: Run the full release pipeline for a batch of changes — audit the project's own skills, publish a dev-log post, commit and push, watch the GitHub Actions deployment to staging and fix what fails, run VPS maintenance, then playtest the deployed staging server. Use when asked to ship, release, run the release train, take a feature all the way to staging, or run the whole end-to-end workflow.
---

# Release Train

Takes one batch of finished work from a dirty working tree to a verified deployment on staging, in
five phases. Each phase has an owner, a definite output, and a point at which it hands over.

You are the **orchestrator**. Your job is sequencing, the approval gates, and the final report —
not doing the phases yourself. Delegate each phase to a subagent, because the five together are far
more context than one agent can hold, and a phase that runs out of room mid-way produces confident
half-work.

| # | Phase | Runs as | Skill |
|---|---|---|---|
| 1 | The project's own skills are audited | subagent | `skill-upkeep` |
| 2 | A dev-log post is written and published | subagent | `devlog-post` |
| 3 | Commit, push, watch CI, fix failures | **main thread** | [reference/ci-watch.md](reference/ci-watch.md) |
| 4 | VPS maintenance | subagent | `vps-maintenance` |
| 5 | Staging playtest | subagent | `staging-playtest` |

Between 2 and 3 the run stops at an approval gate: the dev-log post is the user's to approve, and
nothing is committed until they have.

### How to delegate

Invoking this workflow **is** the request to spawn subagents — the delegation is the workflow, not
an optimisation on top of it. The general rule against spawning agents unasked does not apply to the
four delegated phases below, and running one of them inline "because it looked small" is the single
most expensive mistake available here: it moves that phase's entire working context into the
orchestrator's, permanently.

Each phase is one `Agent` call with `subagent_type: "general-purpose"`, whose prompt names the skill
to invoke, hands over the change set from phase 0, and ends with the report contract. Phases 1 and 2
go out in the same message so they run at once; the rest are sequential because each depends on the
one before it having landed.

Arguments narrow the run: `--from <n>` starts at a phase, `--only <n,m>` runs just those. With no
arguments, run all five. Narrowing is the cheapest saving available — a rerun after a fix almost
never needs the phases that already reported clean.

Documentation and tests are **not** a phase here. They are kept in step with the code as each
feature is built, so a pass over them at release time re-reads the whole batch to confirm what is
already true. If phase 0's survey shows they have genuinely fallen behind — a `src/` change with no
matching movement in `docs/` or `tests/` anywhere in the batch — record it as a finding for the user
and carry on. Catching up is a separate, user-invoked `docs-and-tests-sync` run.

## Token discipline

This run is long, and the orchestrator's context is its scarcest resource: every phase's output
passes through it, and a run that exhausts it mid-way loses the approval gates and the final report
— the two things only the orchestrator can produce. These rules matter as much as the phase order.

1. **Never do a phase's work yourself**, not even the small part that looks quicker to do than to
   brief. Reading source files to check a subagent's claim pulls that phase's context back into the
   main thread, which is precisely what delegating it avoided.
2. **Bound what comes back.** End every brief with the report contract below.
3. **Never re-verify a report by re-reading its files.** Open a file only when you are about to act
   on it yourself. The exceptions are the two cheap existence checks phase 2 needs, and they are
   `ls`/`grep`, not reads.
4. **Keep commands narrow.** `--stat` rather than whole diffs; long output redirected to a file
   under `temp/release-train/` and then grepped, never printed. A single `npm run beforeCommit`
   transcript pasted in full costs more than an entire phase's report.
5. **Write the state file; do not re-read it.** It is for the run that picks up after a
   summarisation, not for the turn that just wrote it.
6. **Do not narrate.** A phase gets a sentence or two between its report and the next delegation.
   Recapping the run so far is what the state file is for.

### The report contract

Every subagent brief ends with this, verbatim in substance:

> Report back in at most 20 lines: status; the paths you changed; findings that need a human, each
> anchored to a `path:line`; what you deliberately left undone. No diffs, no file contents, no
> command transcripts, no account of what you read on the way. Keep the detail in your own notes —
> the orchestrator needs only the conclusions.

## Run state

Long runs get compacted. Before phase 1, create `temp/release-train/<YYYY-MM-DD-HHmm>.md` and append
to it as each phase reports — it is what lets the run be picked up after a summarisation, and what
the final report is assembled from. `temp/` is gitignored, so it never enters the changeset.

Record, per phase, in a few lines: status, what it changed (paths), what it found, what it left. Also
record the run's fixed facts at the top: the starting HEAD, the change set, the dev-log subject once
chosen, and whether the user has approved the dev-log post at checkpoint B.

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

Stat only. The point here is the shape of the batch — which areas moved and which commit subjects
describe them — not its contents; phases 1 and 2 read what they need for themselves. Write the
change set into the state file, and hand it to every phase rather than making each re-derive one:
deriving it independently is how three agents end up describing three different releases.

If the working tree is clean and nothing is unpushed, there is nothing to ship. Say so and stop.

## Checkpoint A — the dev-log subject

Ask, once, which feature the dev-log post should cover, offering the two or three most substantial
user-visible changes from phase 0's survey as options, plus the option to skip the post entirely.

This is a genuine judgement call — one post covers one feature, the post is an advertisement aimed
at people who have never played the game, and the batch usually contains several candidates. The
commit subjects and the stat name the candidates well enough to choose between; do not go reading
`src/` to enrich the options. Together with checkpoint B, which judges the post that comes out of
it, this is one of the two interruptions before the commit gate.

## Phases 1 and 2 — In parallel

Delegate both at once, with the change set from phase 0 and the report contract in each brief.

- **Phase 1 (`skill-upkeep`) owns** `.claude/skills/`.
- **Phase 2 (`devlog-post`) owns** `public/devlog-2026/` and the screenshots it captures.

Neither may touch `src/`, `docs/`, `tests/`, `CLAUDE.md` or `README.md`. If either concludes a change
there is needed, it reports that as a finding and does not make it — a skills audit that quietly
edits application code is an audit whose diff nobody will read carefully.

Phase 1 may edit `.claude/skills/devlog-post/` while phase 2 is running. That is safe: phase 2 loaded
its instructions when it started, so an edit lands for the next run rather than mid-flight. What must
wait is the reverse — checkpoint B's edits to that same skill happen only after phase 1 has reported,
so the two never overwrite each other.

Phase 2 boots a local dev server, captures screenshots against the running game, writes the post, and
regenerates the static site. Two things to check when it reports back, because both are silent
failures, and both are one shell command rather than a read:

```bash
ls public/devlog-2026/
grep -c "<the post's title>" public/devlog-2026/page-<N>.html
```

The page exists and contains the title, and every image it references is a file in that directory.
Also confirm the dev server it started was stopped, or phase 3's build competes with it for port
3000.

## Checkpoint B — approve the dev-log post

**The run stops here and waits for the user.** The post is the one output of this workflow that no
automated check can judge. It is public writing published under the project's name, aimed at people
who have never seen the game, and whether it reads well is a human call. Phase 3 commits it, so the
approval has to happen before phase 3 begins, not after.

Give the user everything they need to judge it without opening files themselves:

- The post's title and page number, and the local preview URL
  `http://127.0.0.1:3000/devlog-2026/page-<N>.html` — noting that a dev server has to be running for
  it, since phase 2 stops the one it started.
- The screenshot files by path, so they can be opened and looked at.
- The **full post text as the user will paste it**, in a copyable block, with its character count.

That text comes from phase 2's report, which is where the exception to the report contract lies: the
post itself is the deliverable, so ask for it in the brief. Everything else about phase 2 stays
within the 20 lines.

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
2. **Delegate phase 2 again** with the same feature named, briefing it on the user's note and on
   what the previous attempt left behind. The rerun **revises in place**: the newest block in
   `public/devlog-2026/source.txt` is the previous attempt's, and it gets replaced rather than
   appended after — otherwise the site grows a duplicate post. The page number stays the same,
   re-shot screenshots keep their filenames, and any screenshot the revision drops is deleted from
   `public/devlog-2026/` instead of being left orphaned.
3. **Come back to this checkpoint** with the new version. The loop runs until the user approves.
   There is no two-cycle bound here — a human answers every round, so no round is spent guessing —
   but each one costs another dev-server boot and another agent's worth of context, so gather the
   user's notes into one brief rather than making a round per remark.

The skill edits from step 1 are working-tree changes like any other: record them in the state file,
let phase 3 commit them with the rest, and list them in the final report.

The user may also decide to drop the post here. Then remove its block from `source.txt` along with
the screenshots it added, regenerate the static site so no half-post page is left behind, and go on
to phase 3 without a post.

## Phase 3 — Commit, push, watch

**On the main thread.** The commit and the push are the user's decisions, and a prompt raised inside
a subagent is one the user answers without the context that produced it.

Full procedure in [reference/ci-watch.md](reference/ci-watch.md). In outline: `npm run beforeCommit`
so the committed bundles are production builds and the dev-log page is generated, review the diff,
propose the commit, push, then watch *Deploy to Staging* and *E2E Tests (Staging)* with
`gh run watch --exit-status`.

Reviewing the diff is where this phase can quietly cost more than the four subagents combined, so
review it by exception. Take `git diff HEAD --stat -- . ':!dist'` and set it against phase 0's
survey and the paths the phases reported. Everything that matches is accounted for; read the full
text only of what does not — a file no phase claimed, a source file in a batch whose phases were all
supposed to stay out of `src/`, a suspicious line count. Generated output (`dist/`, the pages under
`public/devlog-2026/`) is checked by its stat alone; reading a generated bundle proves nothing that
the build did not already.

Fixing CI failures is bounded at **two** fix-and-push cycles, and several classes of failure are out
of scope entirely — the reference file lists which. Never trigger *Promote to Live* or
*Rollback Live*; production is not part of this workflow at any point.

Do not proceed until *Deploy to Staging* has succeeded and the staging `/health` endpoint reports
the commit that was just pushed.

## Between 3 and 4 — Snapshot the log backlog

One command, on the main thread, and it must happen **before** phase 4:

```bash
node dev/scripts/playtest/serverMonitor.js history --app staging --top 20 > temp/release-train/backlog-<runID>.json
```

Redirect it; do not read it. The file is phase 5's ground truth — what this server was already
complaining about before the run touched it — and phase 5 is what parses it. Without one, every
long-standing entry in the log reads as something the release caused, and the playtest reports a
backlog of old noise as new findings.

It goes before phase 4 because phase 4 is the first thing in the run that touches the machine at
all. Anything that happens from there on — housekeeping, a restart the user approved, a log
rotation — moves the boundary the playtest measures against, so the boundary is fixed first. Hand
the file's path to phase 5.

## Phase 4 — VPS maintenance

Delegate to `vps-maintenance`. It audits the machine in one read-only pass and applies only
non-disruptive housekeeping.

Two boundaries, and the orchestrator enforces them as much as the phase does: **nothing reboots the
machine**, and package upgrades happen only with the user's approval and only with a dry-run plan in
hand. That VPS runs live as well as staging — every disruptive act there is an outage of
`app.thingspool.net`. Pending reboots and version mismatches get reported, not resolved.

## Phase 5 — Staging playtest

Delegate to `staging-playtest`, passing the backlog snapshot's path and the commit that phase 3
confirmed on the server. It seeds the database states ordinary play cannot produce, drives concurrent
browser sessions, and correlates everything against the server's logs.

Give it the change set, so it can aim at the parts of the system this release actually touched
rather than running a generic sweep.

## Final report

Assemble from the state file, in this order:

1. **Shipped** — the commit, what it contains, the deployment result, and the commit staging is
   serving.
2. **Findings that need the user** — CI failures left unfixed, VPS items requiring a human decision,
   new errors the playtest found. Each with its evidence. This section goes near the top because it
   is the reason to read the report.
3. **Changed** — skills, the dev-log post (with its URL and the pasteable text), and any rules
   checkpoint B's revisions wrote into the `devlog-post` skill.
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
  what actually happened across five phases nobody watched individually.
