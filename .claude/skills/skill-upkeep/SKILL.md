---
name: skill-upkeep
description: Audit and repair this project's own development instructions and tooling — the skills under .claude, the shared writing-style page, the project rules in .claude/rules, the dev scripts under dev/scripts that run and drive the app, and the guideline pages in CLAUDE.md, docs/devOps and docs/testing — verifying every command, path, script flag, selector and factual claim still holds against the current codebase, fixing what has drifted, filling in what the app can now do and the tooling cannot reach, and tightening instructions that have proven ambiguous in practice. Use when a skill misbehaves or gives stale instructions, after changing a script a skill drives, when a dev script or setup guide has fallen behind the app, or as the first phase of the release-train workflow.
---

# Skill Upkeep

The skills in `.claude/skills/` are instructions that drive real tooling: script paths, flags,
JSON action names, element ids, character budgets, safety boundaries. Every one of those is a claim
about the codebase, and code changes without the skill noticing. A skill that has drifted is worse
than a missing one — it is confidently wrong, and the agent following it will not question it.

The same is true one layer down, of the tooling the skills drive and the guideline pages that
describe it: **the dev scripts under `dev/scripts/` — the ones used to run, open and drive the app —
and the guideline documents (`CLAUDE.md`, `docs/devOps/`, `docs/testing/`, and the READMEs beside the
scripts).** They are audited here for the same reason, and for one more: a script can be perfectly
accurate and still be *behind* the app, with no way to reach something the game has since grown.

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
changed under `dev/scripts/playtest/`, `dev/scripts/vps/` or `dev/scripts/lib/` means the skill that
drives it needs checking against the new behaviour.

The `src/` half of that diff is read differently: not for what the tooling says about it, but for
**what the app can now do that the tooling cannot reach** (Step 2's last check).

Then enumerate the instructions themselves:

```bash
ls .claude/skills/*/SKILL.md .claude/skills/*/reference/*.md .claude/writing-style.md .claude/rules/*.md
ls dev/scripts/*.js dev/scripts/*/*.js docs/devOps/*.md docs/devOps/*/*.md docs/testing/*/*.md
```

Every one gets checked, not only the ones the diff touched — drift accumulates from changes made
long before this batch. `docs/plans/` is never touched, whatever a sweep here turns up
([`../../rules/plan-documents.md`](../../rules/plan-documents.md)), and the other `/docs` pages —
the subject maps — belong to `docs-and-tests-sync`, not here.

`.claude/writing-style.md` sits outside the skills tree because two skills share it: `devlog-post`
and `distribution-push` both write public copy against it. Audit it like any other file here, and
treat a style rule that has migrated into one of those skills as drift to reverse — rules about
*how* to write belong in the shared file, rules about what a particular piece must contain belong
in the skill that owns it.

`.claude/rules/` holds the project invariants that CLAUDE.md states in short and delegates the
reasoning for — room generation, the license files, plan documents. They are instructions like any
other file here, and they make the same checkable claims (module and type names, paths, which files
a rule reaches), so they drift the same way. Two extra checks for these: the summary of each rule
in CLAUDE.md must still say the same thing as the page it links to — a rule that has been sharpened
in one place and not the other is worse than one written down once — and every link between
CLAUDE.md and `.claude/rules/` must resolve in both directions.

The **dev scripts and the guideline pages** are the same job in a different register. The scripts are
what a session actually runs — the dev server launcher, the local sandbox runner, the playtest and
VPS tooling, the shared automation libraries — and their usage strings and header comments are
instructions like any other, read far more often than the code beneath them. The guideline pages
(`CLAUDE.md`, `docs/devOps/`, `docs/testing/`, the READMEs beside the scripts) are how somebody finds
the scripts at all, and they carry commands and flags on purpose, so they go stale in exactly the
places that matter. Hold them to the documentation guidelines in `CLAUDE.md`: fix the line that is
now wrong rather than adding a note beside it.

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
- **Referenced documents.** Every relative link and `#anchor` resolves; every `/docs` page it points
  at still covers what the skill says it covers. Those pages are deliberately short maps (CLAUDE.md's
  Documentation Guidelines), so a skill that needs a precise detail the page does not carry should
  cite the source file or script instead, rather than asking for the page to grow.
- **Claims about behaviour.** "Staging runs in production mode, so the dev OAuth bypass is off",
  "guest creation is capped per IP and User-Agent" — these are the load-bearing sentences. Confirm
  each against the code that implements it. When one is now false, the instruction built on top of
  it is usually also wrong.
- **Reach.** The checks above ask whether what is written is still *true*. This one asks whether it
  is still *enough*: can the tooling still get to everything the app does? A dev script is
  out of date the moment the game grows something it cannot open, drive or show — a new kind of
  object the sandbox cannot stand up, a control the runner cannot click, a room parameter no seeder
  sets, a seat no local run can take. **Nothing fails when this happens**; the gap shows up only as
  a session that has to reproduce a whole course of play to reach one case.

  The worked example: door tools were admin-only, the sandbox opened only as a guest, and so every
  admin case had to be played out in a generated hub or seeded on staging — until `?sandboxadmin=`
  and `--admin` closed it. Ask the same question of each script in turn, against the `src/` half of
  Step 1's diff: what did this batch add, and which of these could reach it today?

Fix what is broken, and close the gaps that are yours to close: the scripts under `dev/scripts/` and
the guideline pages are edited here. A gap that can only be closed inside `src/` — an automation
bridge with no method for the new thing, a missing dev-only parameter — is a finding to report and,
when the user asks for it, a change made with the file-editing tools like any other source change
([`../../rules/source-edits.md`](../../rules/source-edits.md)). Inside a release-train run, `src/`
is out of bounds entirely and the gap is reported, not closed.

Where a claim can no longer be verified either way, say so in the report rather than deleting it.

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
- Rewriting the description frontmatter without cause. It is what decides whether the skill is found
  at all; change it only when the skill's actual trigger conditions have changed, and keep naming
  the situations a user would describe rather than the mechanism.

### How an improvement is written: consolidate, never accrete

**This governs every edit to a skill, a reference page or a guideline — here, and anywhere else
feedback gets written down.** It is the rule that keeps all the other rules readable, and the one
most often broken, because appending is always the easier edit and always looks harmless on its own.

**Fold the note into an existing principle. Do not append a new rule for the case at hand.** When
feedback arrives — from the user, or from a run that went wrong:

1. **Find the principle it is an instance of.** Nearly every specific correction is a general rule
   already on the page, failing to bite. "The screenshots all look the same" is not a new rule; it is
   the composition guidance never saying that a set of images is judged as a set.
2. **Sharpen that principle until it would have caught this case**, and let the case be its
   illustration if it needs one. One worked example inside a principle teaches more than three
   bullets beside it.
3. **Write a genuinely new rule only when no principle covers it** — and then ask which two existing
   ones should merge to make room for it.

Symptoms that a page has been accreting, all of which are grounds to consolidate it: a numbered list
that has outgrown its own introduction ("three faults account for…" above six of them), several
bullets that are the same advice at different levels of detail, and worked examples outnumbering the
rules they illustrate.

**State the present only.** No account of what an earlier version said, banned, or got wrong. Git
keeps that history; in the page it doubles the length and buries the rule that is actually in force.

**Where a question is really about style or taste, point at the examples instead of enumerating
rules.** No page captures a voice, a visual composition, or a house convention in prose, and each
attempt adds a rule that only half-applies. Name the principle, then send the reader to the corpus —
the published dev-log posts, the ready-made playtest plans, the tests already in the suite — with the
instruction to read **several and imitate the pattern running through them**, not to copy the most
recent one.

Length costs attention on every invocation. When a section is long and needed only sometimes, move it
to `reference/` and link it — that is what the `devlog-post` skill's `reference/` files are for.

## Step 4 — Check the frontmatter

Each `SKILL.md` needs a `name` matching its directory, and a `description` that names both what the
skill does and *when to use it*. A description that describes only capability gets the skill
overlooked; one that lists trigger phrasings gets it found. Verify the file is reachable — the
directory name is what the user types after the slash.

## Step 5 — Report

- Per skill, script and guideline page: verified clean, or the specific claims that had drifted and
  what they were corrected to.
- Improvements made, each with the evidence that motivated it.
- **Gaps in reach**: what the app can now do that the tooling still cannot, each with what closing
  it would take, and which of them were closed here.
- Claims you could not verify, named individually.
- Anything you deliberately left alone that a reader might expect to have been changed, with the
  reason.

Do not report a file as audited if you only skimmed it. An unchecked claim in a skill is exactly
the failure this exists to prevent.
