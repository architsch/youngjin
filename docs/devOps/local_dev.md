# Local Development

## Prerequisites
1. `gcloud auth application-default login`. `devRunner.js` reads secrets from Secret Manager with these credentials (see [firebase.md](firebase.md)).
2. `npm install -g firebase-tools pm2`. Both are global CLIs, so **switching Node.js versions strands them and breaks `npm run dev`**. Reinstall them after a switch (see [maintenance.md](vps/maintenance.md#global-clis-do-not-survive-a-nodejs-switch)).
3. A JDK on `PATH` (the Firestore and Storage emulators run on the JVM).

## Running
| Command | Purpose |
|---|---|
| `npm run dev` | full stack (SSG, client, server, emulators) |
| `npm run devnossg` | full stack without SSG |
| `npm run devclient` / `devserver` / `devcss` | one part only |

Open `http://127.0.0.1:3000`. Stop with `Ctrl+C`, then run `npm stop`.

### If the emulator ports stay open
`Ctrl+C` signals the whole process group. `npm stop` alone does not: it frees port 3000, but the emulators keep 8080, 9199, 4400, 4500, 9150 and 4000. To end a detached run the way `Ctrl+C` would:
```
lsof -nP -iTCP -sTCP:LISTEN | grep -E ':(3000|4000|4400|4500|8080|9150|9199)\b'
ps -o pgid= -p <pid of the concurrently process>
kill -INT -<that process group id>
```
Use SIGINT or SIGTERM, never SIGKILL, which orphans the Java emulators. E2E runs clear these ports themselves (`dev/scripts/e2eDevServer.js`).

## Dev users
`npm run dev` seeds users into the emulator. Log in as one with `?devuser=N`, which sets the auth cookie. This works in dev mode only, and it is the only way to reach the admin UI locally.

| N | Username | Type |
|---|---|---|
| 1–3 | DevMember1–3 | Member |
| 4 | DevAdmin | Admin |

## Cookie reset across restarts
The emulator DB is empty on every fresh start, but browser cookies persist. The server stamps each browser with a boot id (`thingspool_dev_boot_id` cookie) that matches a marker document in the emulated DB. After a full restart the marker is gone, so stale browsers have their auth cookies cleared. A hot reload keeps the marker, so sessions survive. Dev only.

## Committing
Run `npm run beforeCommit` (so production bundles are committed), then commit and push.
