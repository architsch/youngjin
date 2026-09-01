# The License Files Must Describe What Actually Ships

The rule in one line, as [`../../CLAUDE.md`](../../CLAUDE.md) states it: **when the set of things that
ship changes, the license files change in the same commit.** This page is why, and the checklist that
follows from it.

## Why drift here is not cosmetic

This repository is **dual-natured on purpose**: the code is open source under Apache-2.0, while the
written and illustrated works under `public/` are all rights reserved, and some bundled assets belong
to third parties under their own terms. That boundary exists only in
[`../../LICENSE-CONTENT.md`](../../LICENSE-CONTENT.md) and
[`../../THIRD-PARTY-NOTICES.md`](../../THIRD-PARTY-NOTICES.md). Nothing enforces it, no test fails
when it drifts, and a reader — or a court — has no other place to look.

It fails in one of two directions, and both are public:

- **Too wide**, and the repository appears to give away writing and artwork that were never meant to
  be licensed. A permissive grant, once published, is not reliably retractable.
- **Too narrow**, and the project claims rights over somebody else's asset, or ships one whose terms
  it never checked.

## The checklist

1. **A new dependency** — check its license before adding it. MIT / Apache-2.0 / BSD / ISC are fine.
   A copyleft or source-available license (GPL, AGPL, LGPL, MPL, SSPL, BUSL, PolyForm,
   "non-commercial") is a **decision for the user, not a default to accept**: it can force this
   project's own terms to change. Report it and stop. If the dependency is a substantive one, add it
   to the table in `THIRD-PARTY-NOTICES.md`.
2. **A new external asset** — a texture pack, image, model, sound, icon or font arrives with terms
   attached. Keep the license file it came with beside the asset, and add a row to
   `THIRD-PARTY-NOTICES.md` naming the author and the license. **Never add an asset whose terms are
   unknown**; "found on the internet" is not a license.
3. **A new `public/` directory** — a library section, a dev-log year, an arcade entry — is *content*.
   It is all rights reserved, and it belongs in the illustrative list in `LICENSE-CONTENT.md`.
4. **A new top-level code directory** belongs in the "What Apache-2.0 covers" table in
   `LICENSE-CONTENT.md`, so the open-source half of the boundary stays complete too.
5. **`LICENSE` is verbatim Apache-2.0 and is never edited.** Scope statements, exclusions and
   attributions go in the other three files. Editing the license text produces a licence that is no
   longer Apache-2.0 and that nobody can evaluate.
6. **Web fonts**: `THIRD-PARTY-NOTICES.md` currently states that none are used. Adding one makes that
   statement false, and it must be updated.

The `docs-and-tests-sync` skill is where this checklist is actually run against a batch of changes,
including the command that reports any non-permissive dependency license.
