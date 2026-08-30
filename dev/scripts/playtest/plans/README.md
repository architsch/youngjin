# Ready-made playtest plans

Each file here is a plan for `runPlan.js`. They are written against **staging**, which is the
harder case: no `baseURL` (the runner defaults to staging) and no `devUser`, because staging runs in
production mode and mints only guests.

To run one against the local dev server instead, add `"baseURL": "http://127.0.0.1:3000"` and — for
the admin scenarios — `"devUser": 4`, then drop the promotion step below. Locally the seeded
`DevAdmin` is reachable directly, which is what `?devuser=N` exists for.

## The admin scenarios

An admin cannot be created by playing. The account is minted as a guest through the real page,
promoted in the database, and resumed — which is why these plans share a `sessionFile`.

```bash
# 1. Mint a guest, leave the tutorial, and report who it is.
node dev/scripts/playtest/runPlan.js dev/scripts/playtest/plans/admin-session-open.json --out temp/playtest/open.json

# 2. Promote that account. The user id is in the `whoami` action's context.
node dev/scripts/playtest/stagingAdmin.js set-user-type --user <userID> --type admin --run <runID>

# 3. Everything else resumes the same session, and comes back as an admin.
node dev/scripts/playtest/runPlan.js dev/scripts/playtest/plans/admin-door-lifecycle.json
node dev/scripts/playtest/runPlan.js dev/scripts/playtest/plans/admin-door-destination.json
node dev/scripts/playtest/runPlan.js dev/scripts/playtest/plans/admin-door-remove.json

# 4. Put the account back, and clear what the run created.
node dev/scripts/playtest/stagingAdmin.js restore-user-type --user <userID>
node dev/scripts/playtest/stagingAdmin.js cleanup --run <runID>
```

`admin-door-lifecycle` hangs a door on a Hub wall, names it, and makes it the room's default
entrance — the three metadata keys the spawn logic reads. It walks away from the arrival point
first, deliberately: the wall a player is put down facing does not accept a door, and a plan that
searched only from there would report a refusal that is correct behaviour.

`admin-door-remove` expects the door `admin-door-lifecycle` left behind, so run them in order.

## The refusal scenarios

`guest-door-refusal` needs no promotion. It checks the permission boundary from the other side: a
guest standing in a Hub is offered the picture tool and not the door tool, because hanging a door is
world-building rather than room-editing.

For the check that turns on being *registered* rather than on being an admin, promote to `member`
rather than `admin` — a guest is refused a layer earlier and proves nothing about it.

## Writing a new one

The actions are listed in [docs/testing/playtest/workflow.md](../../../../docs/testing/playtest/workflow.md).
Two are easy to leave out and expensive to leave out: `skipTutorial` before anything multiplayer,
and `end` at the finish.
