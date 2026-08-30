# Local Development

## Prerequisite

1. Log into Google Cloud by running the following command. This will allow `devRunner.js` to fetch secrets from Google Secret Manager based on the local credentials. For the full picture of the project, service account, and secrets, see [Firebase & Google Cloud](firebase.md).
```
gcloud auth application-default login
```

2. Install the two CLIs the dev scripts invoke as executables:
```
npm install -g firebase-tools pm2
```
These are global rather than `package.json` dependencies because nothing imports them — `firebase` is spawned to run the Firestore and Storage emulators, and `pm2` supervises the dev runner as a process that outlives the npm command that started it. The rest of the toolchain is a local dev dependency and needs no separate install.

Being global ties them to the Node.js version that was active when you installed them, so **changing Node.js versions strands them and breaks `npm run dev`** until they are reinstalled on the new runtime. This is the most common cause of the dev script exiting immediately after a version bump — see [Global CLIs do not survive a Node.js switch](vps/maintenance.md#global-clis-do-not-survive-a-nodejs-switch).

3. Make sure a JDK is on `PATH` (`java -version`), since the Firestore and Storage emulators run on the JVM.

## How to Run the Project Locally

1. Open up the terminal and navigate to the project's root directory.

2. Run one of the following commands:
    - `npm run dev` - for full development test
    - `npm run devcss` - for testing the CSS only
    - `npm run devclient` - for testing the client only
    - `npm run devserver` - for testing the server only
    - `npm run devnossg` - for full development test except the SSG

3. Open up the browser and visit `http://127.0.0.1:3000` to access the app on `dev` mode (In the production environment (VPS), the app runs on `prod` mode and is accessible via either `https://app.thingspool.net` (live server) or `https://staging.thingspool.net` (staging server)).

4. If you want to terminate the local instance, press `Ctrl+C` to exit the inner console and then run `npm stop` to terminate the PM2 process.

### If the Emulator Ports Stay Open

`Ctrl+C` is the part of that which ends the run, and it ends all of it: the signal reaches the whole process group at once — the Firebase CLI, which takes its two Java emulators down with it, and the PM2 process supervising the server. `npm stop` afterwards clears the stopped app out of PM2.

`npm stop` on its own is not a substitute, so a run with no terminal to press `Ctrl+C` in — started detached, in a background job, or from a terminal that has since been closed — has to be ended by hand. Its `pm2 stop all` does end the server and free port `3000`, but the `pm2 start --no-daemon` process supervising it stays up with nothing left to supervise, so `concurrently -k` never sees either half exit and never kills the other: the emulators keep `8080` (Firestore), `9199` (Storage), `4400` (emulator hub), `4500` (reserved), `9150` (Firestore websocket) and `4000` (emulator UI), and the next `npm run dev` cannot start them.

To find such a run and end it as `Ctrl+C` would:

```
lsof -nP -iTCP -sTCP:LISTEN | grep -E ':(3000|4000|4400|4500|8080|9150|9199)\b'
ps -o pgid= -p <pid of the concurrently process>
kill -INT -<that process group id>
```

Signalling the group rather than any single process is what makes this equivalent to `Ctrl+C`. Send `SIGINT` or `SIGTERM`, never `SIGKILL`: the Firebase CLI takes its two Java processes down with it when asked to stop, and orphans them when killed outright.

E2E runs handle this themselves — Playwright boots the stack through `dev/scripts/e2eDevServer.js`, which frees these ports before starting and sweeps them again on teardown.

## Dev User Accounts

When `npm run dev` starts, the server automatically seeds 4 user accounts in the local Firestore emulator: three **Member** accounts and one **Admin**. These accounts bypass Google OAuth and let you quickly test member-only features (creating rooms, changing texture packs, registering editors) and admin-only ones (laying and wiring up a hub's doors, opening a new hub, re-skinning one — see [The Admin Privilege](../gameplay/admin.md)).

Nothing in the product ever makes an admin — one is promoted by hand in the database — so this is the only way to reach the admin UI locally.

### Seeded Accounts

| Index | Username    | Email                 | Type   |
|-------|-------------|-----------------------|--------|
| 1     | DevMember1  | devmember1@test.com   | Member |
| 2     | DevMember2  | devmember2@test.com   | Member |
| 3     | DevMember3  | devmember3@test.com   | Member |
| 4     | DevAdmin    | devadmin@test.com     | Admin  |

### How to Use

Append `?devuser=N` to the game page URL to log in as a specific dev user:

- `http://127.0.0.1:3000?devuser=1` — logs in as DevMember1
- `http://127.0.0.1:3000?devuser=2` — logs in as DevMember2
- `http://127.0.0.1:3000?devuser=3` — logs in as DevMember3
- `http://127.0.0.1:3000?devuser=4` — logs in as DevAdmin

This sets a JWT cookie, so subsequent visits to `http://127.0.0.1:3000` (without the query param) will remain logged in as that user. To switch to a different dev user, simply visit with a different `?devuser=N` value.

**Note:** The `?devuser` parameter is only available in `dev` mode and has no effect in staging or production.

## Cookie Reset Across Dev Restarts

The local Firestore emulator does not persist data: every fresh `npm run dev` starts with an empty DB (re-seeded dev users get brand-new document IDs). Auth cookies, however, live in the browser and survive across restarts — so without intervention a new runtime would try to resolve a user that no longer exists, or replay browser-scoped state (e.g. the "tutorial finished" flag) against a clean DB.

To prevent this, the server stamps each browser with a **boot id** identifying the current DevRunner runtime (stored in the `thingspool_dev_boot_id` cookie). The matching server-side id is kept in a marker document in the emulated DB, so its lifetime tracks the DB itself:

- **Full restart** (`npm stop` + `npm run dev`, or `Ctrl+C` then restart) resets the emulator → the marker is gone → a new boot id is minted. On the next page load the server sees the browser's stale boot id, clears its auth-related cookies, and treats it as a brand-new browser.
- **Hot reload** (an automatic restart triggered by a file change) leaves the emulator running → the marker persists → the same boot id is reused → existing cookies stay valid and your session is undisturbed.

This is dev-only; nothing of the sort runs in staging or production.

## How to Push to GitHub

1. Stage the changes you want to commit.

2. Run `npm run beforeCommit` to make sure that the app bundles are production bundles.

3. Run `git commit -m "[Your Comment]"`

4. Run `git push` (Make sure that the remote origin is set)