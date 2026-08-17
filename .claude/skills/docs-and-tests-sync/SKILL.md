---
name: docs-and-tests-sync
description: Bring the documentation and the test suites back in line with recent code changes — survey everything committed-but-unpushed plus everything uncommitted, work out which /docs pages, CLAUDE.md sections, README entries and integration/e2e tests the change has made wrong or incomplete, then fix them and verify the suites still pass. Use before a release, when asked whether the docs are up to date, when tests need to catch up with a feature, or as the first phase of the release-train workflow.
---

# Docs and Tests Sync

Documentation and tests are the two things a codebase silently stops telling the truth about. This
closes that gap for one batch of changes: everything that is about to be pushed.

The job is **not** to review the code, propose refactors, or write documentation for its own sake.
It is narrower and more useful than that: find the places where the change that was just made has
left a doc describing behaviour that no longer exists, or left a behaviour with no test asserting
it, and fix exactly those.

## Step 1 — Establish the change set

Two sources, and both count:

```bash
git status --short
git diff origin/main...HEAD --stat     # committed here, not yet pushed
git diff HEAD --stat                   # uncommitted
git log origin/main..HEAD --oneline
```

Together these are "what this push will contain". Read the actual diffs of the source files, not
only the stat — a rename tells you nothing about whether the described behaviour moved.

**Ignore `dist/`.** The bundles are committed build output; they appear in every diff and say
nothing about intent.

Then write down, before touching anything, what *behaviour* changed — in the terms a reader of the
docs would use, not in terms of files. "Rooms now carry a fog setting" is a change to reason about;
"`roomConfig.ts` changed" is not. Everything downstream keys off this list.

## Step 2 — Map behaviour to documents

The documentation index in [README.md](../../../README.md) is the authoritative list of pages, and
each page owns a subject. For every behaviour change, ask which page's subject it falls under. A
change usually lands in one; occasionally it contradicts a sentence in a second page that mentions
the same mechanism in passing, and that second one is the one that gets missed — grep for the
concept across `/docs` rather than trusting the index alone.

Three documents sit outside `/docs` and are checked separately:

- **CLAUDE.md** — its project structure section and its architecture notes. A new top-level
  directory, a new subsystem under `/src`, or a new architectural invariant belongs here. Not
  individual features.
- **README.md** — its documentation index. **A new page under `/docs` that is not linked here does
  not exist**, so any page you add gets a line in the index in the same change.
- **`.claude/skills/*/SKILL.md`** — out of scope here. The `skill-upkeep` skill owns those.

### The rules that govern /docs

These come from [CLAUDE.md](../../../CLAUDE.md) and they are not stylistic preferences — they are
what keeps these pages from going stale:

- **Conceptual, not exhaustive.** Explain the idea, the purpose, the flow. Implementation detail a
  reader does not need in order to understand the concept goes stale the moment the code is tweaked.
- **Present tense only.** No "it used to work this way", no "once X is implemented". When a change
  makes a paragraph wrong, *replace* it. Never append a note about the change.
- **No exact numbers, no internal symbol names.** Not constant values, sizes, intervals, counts or
  thresholds; not local variables, functions or methods. Say "a short grace period", not "5
  seconds". Module, class and type names are fine — they are stable anchors — as is linking to a
  source file.
- **Exception:** `/docs/testing`, `/docs/devOps`, and DB/migration specifics elsewhere may carry
  concrete commands, schema and version steps. Precision genuinely matters there.
- **A small UI feature does not get its own page.** It gets a code comment, and a sentence in an
  existing page if it changes something that page describes. Adding a page per feature is how a
  documentation set becomes unreadable.

### One architectural check worth making every time

CLAUDE.md's rule that **room generation defines what a room is** is the invariant most easily broken
by a change that looks unrelated. If this change introduced a room-level parameter or a new kind of
placeable content, verify that `RoomGenerationUtil` and `ProceduralRoomGenerationUtil` decide it,
that every `SinglePlayerModeConfig` declares it, and that any curated data behind it covers every
option a room can be generated with. A parameter no generator sets is one that every room in the
game silently holds the default value of.

This is a *report* if it is unfixable within the scope of a doc/test pass — say plainly that the
feature is incomplete rather than documenting it as though it works everywhere.

## Step 3 — Map behaviour to tests

| Suite | Where | What belongs in it |
|---|---|---|
| Integration (Vitest) | `tests/integration/scenarios/` | Server logic through the real routers and socket handlers against a mocked DB; the `db.test.ts` suite runs against the Firestore emulator |
| E2E (Playwright) | `tests/e2e/` | Whole flows through a real browser against a running server |

Read [docs/testing/](../../../docs/testing/) before adding anything — the harness conventions
(`tests/integration/helpers/`) matter more than the assertions do, and a test that bypasses them is
a test that will break for reasons unrelated to what it covers.

Judge coverage by **behaviour, not by line count**. For each behaviour on the Step 1 list:

- Is there a test that would have failed before this change and passes now? If not, that behaviour
  is untested regardless of what the coverage of the surrounding file looks like.
- Did the change invalidate an existing test's *premise* — not just its assertions? A test still
  passing against a flow that no longer exists is worse than no test, because it reports safety.
- Are the error and rejection paths covered, or only the happy one? This is the usual gap.

Prefer extending an existing scenario file over adding a new one. New files are for genuinely new
subjects.

**What not to do:** do not add tests for behaviour the change did not touch, do not convert existing
tests to a different style, and do not add an e2e test for something an integration test can assert.
E2E runs are slow, share a real server, and are the suite that blocks a deployment.

## Step 4 — Verify

The integration suite is the gate that matters most, because the pre-commit hook runs it: a failure
here blocks the commit regardless of anything else.

```bash
npm run test:integration
```

Note that Vitest transpiles without type-checking, so a type error in a test file surfaces as a
runtime failure or not at all. The type gate is the build, which is what CI runs:

```bash
npm run build
```

Do **not** reach for a bare `npx tsc --noEmit` against the tsconfigs in `dev/config/`. Neither of
them includes `tests/`, and both emit a wall of pre-existing `node_modules` declaration errors that
have nothing to do with this change — it is a signal you would have to learn to ignore, which makes
it worse than no signal.

E2E only if the change plausibly affects a browser flow, and only against a local server:

```bash
npm run test:e2e:local
```

Local e2e runs need port 3000 clear first — a stale dev server left by an earlier run makes the
auth setup step time out in a way that looks like a test failure:

```bash
npm run stop || true
```

**Report failures as failures.** A suite that does not pass is the finding; do not weaken an
assertion to make it green, and do not describe a red run as "mostly working".

## Step 5 — Report

- Behaviours identified, and for each: the doc that was updated (or why none needed to be) and the
  test that now covers it (or why none was added).
- Docs edited, tests added or changed, with paths.
- Suite results, quoted.
- **Gaps you are deliberately leaving**, each with a reason — a behaviour that is genuinely
  untestable through these harnesses, a doc that needs a decision from the user, an architectural
  invariant the change broke that is out of scope to fix here. This section is the valuable one.
  An empty one had better be true.
