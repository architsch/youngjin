# Committing, pushing, and watching CI

Reference for phase 4 of the release train. Everything here happens on the **main thread**, never
in a subagent: the commit and the push are the two points where the user's approval is required,
and an approval prompt raised inside a subagent is one the user is answering without the context
that led to it.

## Before the commit

The pre-commit hook (`.husky/pre-commit`) runs two things, and both will reject a commit:

1. `dev/scripts/checkBeforeCommit.js` — verifies that `dist/client/bundle.js` and
   `dist/server/bundle.js` are **production** builds, and that the Node.js running the commit
   matches `.nvmrc` and `package.json`'s `engines.node`.
2. `npm run test:integration` — the full integration suite, with a Firestore emulator started for
   the run if none is up.

So the bundles have to be rebuilt before committing, or the hook rejects a changeset that is
otherwise fine:

```bash
npm run beforeCommit     # build (CSS + server + client bundles), then run the SSG
```

This matters more than it looks. `dist/` is committed, the deployment builds from source but the
committed bundles are what a rollback and the local dev flow rely on, and the SSG step is what turns
`public/devlog-2026/source.txt` into the published pages. A devlog post written in phase 3 is not in
the changeset until this has run.

If `checkBeforeCommit.js` reports a Node.js mismatch, stop. `nvm use` fixes it in a shell, but the
hook runs in whatever environment the editor captured at launch — see
[docs/devOps/vps/maintenance.md](../../../../docs/devOps/vps/maintenance.md#switching-your-own-machine-over).
That is a user-side fix, not one to work around.

Then review what is about to be committed, in full:

```bash
git status --short
git diff HEAD --stat
```

Read the non-`dist/` diff before proposing a commit. Anything unexpected in it — a debug print, a
scratch file, a change nobody asked for — is a reason to stop and ask, not to commit and mention it
afterwards.

## The commit

Propose the commit message and let the user approve the command. Match the existing subject style,
which is a short summary of the batch joined with ` + ` rather than a conventional-commits prefix:

```
Occlusion issue fix + Additional edit-mode UI flow for convenience + More UI glitch fix
```

One commit for the whole batch is the norm here. Do not split into several without being asked.

## The push

`git push` to `main` is what triggers deployment, so it is the point of no return for staging:

| Workflow | Trigger | Runs on |
|---|---|---|
| **Deploy to Staging** | push to `main` | self-hosted runner (the VPS itself) |
| **Deploy static content to Pages** | push to `main` | GitHub-hosted |
| **E2E Tests (Staging)** | completion of *Deploy to Staging*, only when it succeeded | GitHub-hosted |

`Promote to Live` and `Rollback Live` are `workflow_dispatch` only. **Never trigger either.** They
move production, and they are not part of this workflow at any point.

## Watching the run

```bash
gh run list --branch main --limit 10
gh run watch <run-id> --exit-status
gh run view <run-id> --log-failed
```

Start by listing, because a single push produces two independent runs and the interesting one is
not always the first. Watch the staging deployment to completion, then wait for the e2e run — note
that e2e is triggered by the *completion event* of the deploy, so it appears a little after the
deploy finishes rather than instantly. A deploy that failed means no e2e run will ever appear;
waiting for one is waiting forever.

Do not poll in a tight loop. `gh run watch --exit-status` blocks until the run ends and exits
non-zero on failure, which is both cheaper and more accurate than repeated listing.

## When something fails

Read the failing step's log before forming a theory. The failures divide cleanly, and the division
decides whether fixing it is in scope:

**In scope — fix, rebuild, recommit, push again:**

- A test failure, integration or e2e, caused by this changeset.
- A TypeScript or build error.
- A missing file, a bad import, a stale reference in a page the SSG generates.

**Not in scope — stop and report:**

- `Verify runtime Node.js version` failing. The VPS runtime disagrees with `.nvmrc`, and the fix is
  a documented manual procedure on the machine, in a specific order —
  [maintenance.md](../../../../docs/devOps/vps/maintenance.md#how-to-upgrade-the-nodejs-version).
- The self-hosted runner being offline or the job queueing indefinitely. That is a VPS problem; the
  `vps-maintenance` audit will say more, but resolving it is not automatic work.
- Anything touching secrets, Google Secret Manager, or Firebase credentials.
- A flaky e2e failure that does not reproduce locally. Report it as flaky with the evidence; do not
  keep pushing to see whether it goes away.

**Bound the fixing.** At most **two** fix-and-push cycles. A third failure means the problem is not
the kind this workflow can resolve — stop, leave the branch in a known state, and report what
failed, what was tried, and what the log said. Repeatedly pushing to production infrastructure while
guessing is the specific failure mode this bound exists to prevent.

## Proceeding

Phase 5 begins only when *Deploy to Staging* has succeeded. The e2e suite is allowed to be still
running at that point — the VPS audit does not depend on it — but phase 6's playtest must not start
until the deployment is confirmed on the server itself:

```bash
curl -s https://staging.thingspool.net/health
git rev-parse --short HEAD
```

The commit those two report must match. If it does not, the code under test is not on the server,
and every finding from a playtest against it would be about the previous build.
