---
name: skill-upkeep
description: Audit and repair this project's own Claude skills under .claude/skills — verify every command, path, script flag, selector and factual claim a SKILL.md makes still holds against the current codebase, fix what has drifted, and tighten instructions that have proven ambiguous in practice. Use when a skill misbehaves or gives stale instructions, after changing a script a skill drives, or as the first phase of the release-train workflow.
---

# Skill Upkeep

The skills in `.claude/skills/` are instructions that drive real tooling: script paths, flags,
JSON action names, element ids, character budgets, safety boundaries. Every one of those is a claim
about the codebase, and code changes without the skill noticing. A skill that has drifted is worse
than a missing one — it is confidently wrong, and the agent following it will not question it.

This is an audit against reality, not a rewrite. **Prose that is still accurate stays as it is.**
Rewording a working instruction costs review attention and risks losing a hard-won caveat; the
sentences in these files that read like odd trivia are usually the scar tissue from a run that went
wrong once.

## Step 1 — Find what moved

If a change set is in play (a release-train run, or a recent commit), start from it:

```bash
git diff origin/main...HEAD --stat -- dev/scripts src
git diff HEAD --stat -- dev/scripts src
```

`dev/scripts/` is the high-risk surface, because the skills drive those scripts directly. Anything
changed under `dev/scripts/devlog/`, `dev/scripts/playtest/` or `dev/scripts/vps/` means the skill
that drives it needs checking against the new behaviour.

Then enumerate the skills themselves:

```bash
ls .claude/skills/*/SKILL.md .claude/skills/*/reference/*.md .claude/writing-style.md
```

Every one gets checked, not only the ones the diff touched — drift accumulates from changes made
long before this batch.

`.claude/writing-style.md` sits outside the skills tree because two skills share it: `devlog-post`
and `distribution-push` both write public copy against it. Audit it like any other file here, and
treat a style rule that has migrated into one of those skills as drift to reverse — rules about
*how* to write belong in the shared file, rules about what a particular piece must contain belong
in the skill that owns it.

## Step 2 — Verify every checkable claim

This is the substance of the skill. Work through each file and treat every concrete assertion as a
claim to test, not text to read. In practice that means:

- **Script paths and flags.** Does the file exist? Does the script still accept that verb and that
  flag? The scripts print usage on a bad invocation, so `node <script>` with no arguments is usually
  the fastest check. Compare the skill's documented flags against the script's actual argument
  parsing.
- **Names that cross the boundary between prose and code.** Action type names in a playtest plan,
  element ids a plan clicks, npm script names, environment variables, file locations a skill writes
  to. Grep for each in the source. A renamed action type is invisible until a run silently does
  nothing.
- **Numbers.** Character budgets, rate limits, page sizes, thresholds. These come from a constant
  somewhere — find it and compare. A budget that has drifted produces work that fails validation at
  the last step.
- **Referenced documents.** Every relative link resolves; every `/docs` page it points at still
  covers what the skill says it covers.
- **Claims about behaviour.** "Staging runs in production mode, so the dev OAuth bypass is off",
  "guest creation is capped per IP and User-Agent" — these are the load-bearing sentences. Confirm
  each against the code that implements it. When one is now false, the instruction built on top of
  it is usually also wrong.

Fix what is broken. Where a claim can no longer be verified either way, say so in the report rather
than deleting it.

## Step 3 — Improve what practice has shown to be weak

Only after the audit, and only where you have evidence. The legitimate sources of evidence are: a
step that has gone wrong in an actual run, a capability the underlying script gained that the skill
never mentions, and an instruction genuinely open to two readings.

Improvements that are usually worth making:

- **A new capability the skill does not mention.** A script grew a verb or a flag and the skill
  still describes the old way round. This is the most valuable fix available here.
- **A failure mode that cost a run.** Write down the symptom, not only the rule — "the room list
  silently tests nothing until the tutorial is left" teaches; "call skipTutorial first" does not,
  and gets skipped when it seems unnecessary.
- **An ambiguous instruction.** If two readings lead to different work, pick one and say which.
- **A missing boundary.** Anything a skill could plausibly do that would be destructive, expensive,
  or irreversible, and that it is not currently told to avoid.

Improvements to resist:

- Restructuring a skill that works. Section order is not a defect.
- Adding detail the agent can read from the code anyway. Skills carry judgement and non-obvious
  constraints; source-level facts belong in the source.
- Growing a skill indefinitely. Length costs attention on every invocation. When a section becomes
  long and is needed only sometimes, move it to `reference/` and link it — that is exactly what the
  `devlog-post` skill's `reference/` files are for.
- Rewriting the description frontmatter without cause. It is what decides whether the skill is found
  at all; change it only when the skill's actual trigger conditions have changed, and keep naming
  the situations a user would describe rather than the mechanism.

## Step 4 — Check the frontmatter

Each `SKILL.md` needs a `name` matching its directory, and a `description` that names both what the
skill does and *when to use it*. A description that describes only capability gets the skill
overlooked; one that lists trigger phrasings gets it found. Verify the file is reachable — the
directory name is what the user types after the slash.

## Step 5 — Report

- Per skill: verified clean, or the specific claims that had drifted and what they were corrected to.
- Improvements made, each with the evidence that motivated it.
- Claims you could not verify, named individually.
- Anything you deliberately left alone that a reader might expect to have been changed, with the
  reason.

Do not report a skill as audited if you only skimmed it. An unchecked claim in a skill is exactly
the failure this exists to prevent.
