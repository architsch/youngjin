---
name: docs-and-tests-sync
description: Bring the documentation, the license files and the test suites back in line with recent code changes — survey everything committed-but-unpushed plus everything uncommitted, work out which /docs pages, CLAUDE.md sections, README entries, LICENSE-CONTENT/THIRD-PARTY-NOTICES entries and integration/e2e tests the change has made wrong or incomplete, then fix them and verify the suites still pass. Use when asked whether the docs are up to date, when tests need to catch up with a feature, when a new dependency or external asset or public/ directory has been added, or to catch up a batch of work whose docs and tests were not kept in step as it was built.
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

**Rewrite the passage that is now wrong; do not append the new behaviour beside it.** A page that
grows a paragraph per change becomes a sedimentary record rather than a description of the present,
which is the failure CLAUDE.md's documentation guidelines are written against. "How an improvement is
written" in [`skill-upkeep/SKILL.md`](../skill-upkeep/SKILL.md) states the rule in full; it applies to
every page this skill touches.

Three documents sit outside `/docs` and are checked separately:

- **CLAUDE.md** — its project structure section and its architecture notes. A new top-level
  directory, a new subsystem under `/src`, or a new architectural invariant belongs here. Not
  individual features.
- **README.md** — its documentation index. **A new page under `/docs` that is not linked here does
  not exist**, so any page you add gets a line in the index in the same change.
- **`.claude/skills/*/SKILL.md`** — out of scope here. The `skill-upkeep` skill owns those.

### The license files are documentation too

`LICENSE-CONTENT.md` and `THIRD-PARTY-NOTICES.md` describe *what ships and under whose terms*, and
they go stale exactly the way a `/docs` page does — except that nothing fails when they do, and the
consequence is legal rather than confusing. CLAUDE.md's **"The License Files Must Describe What
Actually Ships"** section is the rule; this is where the pass enforces it.

Four questions, answered from the Step 1 change set:

1. **Did a dependency arrive or leave?** Diff `package.json`. Check the license of anything new:

   ```bash
   node -e 'const fs=require("fs"),p=require("path"),k=require("./package.json");for(const d of Object.keys({...k.dependencies,...k.devDependencies,...k.optionalDependencies})){try{const j=JSON.parse(fs.readFileSync(p.join("node_modules",d,"package.json"),"utf8"));const l=typeof j.license==="string"?j.license:(j.license||{}).type||"UNKNOWN";if(!/^(MIT|ISC|Apache-2\.0|BSD-[23]-Clause|0BSD|Unlicense|CC0-1\.0)$/.test(l))console.log(d,"->",l)}catch(e){console.log(d,"-> NOT INSTALLED")}}'
   ```

   Silence means every dependency is permissive. (`NOT INSTALLED` lines are noise from an optional
   platform-specific package, not a licensing finding.)

   Anything else it prints is a finding to **report, not to absorb**. A copyleft or source-available
   dependency (GPL, AGPL, LGPL, MPL, SSPL, BUSL, PolyForm, "non-commercial") can force this
   project's own terms to change, and that is the user's decision. A substantive new dependency also
   earns a row in `THIRD-PARTY-NOTICES.md`.

2. **Did an external asset arrive?** A texture pack, image, model, sound, icon or font came with
   terms. Confirm its license file sits beside it and that `THIRD-PARTY-NOTICES.md` names the author
   and the license. An asset with no discoverable terms is a finding, not something to document
   around.

3. **Is there a new directory under `public/`?** A library section, a dev-log year, an arcade entry —
   that is content, all rights reserved, and it belongs in the illustrative list in
   `LICENSE-CONTENT.md`.

4. **Is there a new top-level code directory?** It belongs in the "What Apache-2.0 covers" table in
   `LICENSE-CONTENT.md`, so the open-source half of the boundary stays complete.

**Never edit `LICENSE`.** It is verbatim Apache-2.0. Every scope statement, exclusion and
attribution goes in the other files.

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
by a change that looks unrelated. If this change introduced a room-level parameter, verify that
`RoomGenerationUtil` and the procedural `RoomBuilder`s decide it, that every `SinglePlayerModeConfig`
declares it on its `RoomBuilderParams`, and that any curated data behind it covers every option a
room can be generated with. A parameter no generator sets is one that every room in the game silently
holds the default value of.

Contents are the narrower half of that rule, and reading it as "generation must place everything" is
the usual overcorrection. A new kind of *placeable object* owes generation nothing — a room is meant
to be furnished by the people who use it. A new kind of *voxel* content does, and so does anything
that has become structurally necessary in the way the room's own door is: a room with no door is a
room nobody can leave.

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
- **Licensing**: dependencies or assets that arrived, their licenses, and whether the notice files
  needed changing. Say "nothing shipped that changes the boundary" when that is the answer — it is a
  check that was made, not a section to omit. Any non-permissive license goes here as a decision for
  the user.
- Suite results, quoted.
- **Gaps you are deliberately leaving**, each with a reason — a behaviour that is genuinely
  untestable through these harnesses, a doc that needs a decision from the user, an architectural
  invariant the change broke that is out of scope to fix here. This section is the valuable one.
  An empty one had better be true.
