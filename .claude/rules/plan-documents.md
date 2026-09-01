# Plan Documents Are Historical Records

The rule in one line, as [`../../CLAUDE.md`](../../CLAUDE.md) states it: **files under `/docs/plans`
are never edited after the day they were written.** This page is why, and what to do at the moments
the rule actually gets broken.

## What these files are

`/docs/plans` is the one part of `/docs` that is not describing the present. Each file is dated, and
it records **what was known, intended and uncertain on that day** — the problem as it was then
understood, the approach chosen, the open questions, the author's own wording and reasoning. That
snapshot is the entire value of the file. A plan reconciled with what was eventually built records
nothing at all; the repository already has the built thing.

This is why the Documentation Guidelines in [`../../CLAUDE.md`](../../CLAUDE.md) exclude them, in
their heading and in their opening. Plans legitimately contain internal symbol names, exact numbers, speculation,
first-person reasoning, abandoned ideas, and things that turned out to be wrong. None of that is a
defect to be cleaned up — it is the record.

## How the rule gets broken

Not by anyone deciding to rewrite history. It is always a sweep that was correct everywhere else and
did not stop at the directory boundary:

- **A rename.** A symbol is renamed in `src/`, a repo-wide find-and-replace follows it into a plan
  from months ago, and the plan now claims the author was reasoning about a name that did not exist
  yet. A rename is precisely the kind of change a dated record is supposed to be able to predate.
- **A docs-sync pass.** A behaviour changed, so every `/docs` page describing it gets corrected —
  including the plan that proposed the behaviour that was later abandoned.
- **A tidy-up.** Applying the conceptual-outline rules, fixing a stale link or path, updating a
  number, normalising formatting.
- **An annotation.** Appending an outcome, a status marker, a correction, or a "this was later
  revised" note. These feel additive and are not: the file stops being a snapshot the moment it
  contains something from after its date.

The damage is quiet. No test fails, no reviewer is prompted, and what was lost — the state of the
author's thinking on a specific day — cannot be reconstructed from the code that eventually shipped.

## What to do instead

- **When a mechanical edit matches a file under `/docs/plans`, skip it and leave the file untouched.**
  Do not apply it "for consistency". Inconsistency with today's code is the correct state for a
  historical document.
- **When a plan is genuinely misleading someone, write a new dated plan that supersedes it.** Never
  revise the old one, and do not add a pointer to the new plan from the old one either — a superseded
  plan is still an accurate record of its own day.
- **Do not add plans to the documentation index in `README.md`.** The rule that every `/docs` page
  must be linked there does not reach `/docs/plans`; the index lists the conceptual pages that
  describe the present.
- **Do not cite a plan as evidence of how the system currently works.** It is evidence of what was
  intended on one date. The `/docs` pages and the source are the present tense.

## The only legitimate edits

Both require the user to ask:

1. Writing a **new** dated plan.
2. Editing a plan **on the day it was written**, while it is still being drafted.

Anything else — including a correction the user would probably agree with — is a change to the
historical record, and it is theirs to authorise, not yours to infer.
