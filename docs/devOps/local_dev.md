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
| `npm run imageMapEditor` | edit the picture map (what canvases and props show) from samples of photos in its source library (`dev/assets/picture_sources/`, added in its Sources tab by file or address, where one can also be preprocessed into another: a cut-out there uses the model `npm run imagePrep` fetches, and asks before fetching it), at `http://127.0.0.1:3200`; `-- --workspace <dir>` edits a scratch copy with its own library, `-- --render-samples` / `--render-game-images` / `--contact-sheet` run without the page, as do `--add-sources <url or file> ... [--author <name>] [--url <page> --license <license>]` / `--survey [<source>[:x,y,w,h] ...]` / `--save-samples <plan.json>` (batch sampling, saved disabled; a file is one's own picture by `--author`, or made from the photo at `--url`; see the `image-map-sampling` skill and [image_map.md](../graphics/image_map.md)) |
| `npm run imagePrep` | prepare pictures for flat use, writing only under `temp/image_prep/`: `-- --survey <file>[:x,y,w,h] ...` draws them with a grid, `-- --shades <file>[:x,y,w,h] ...` reads their brightness out cell by cell, and `-- --run <plan.json>` carries out a plan (a thing cut out of its background by Segment Anything 2, run on ONNX Runtime, both fetched there on first use, about 1 GB; a picture enlarged with Real-ESRGAN, fetched likewise, macOS only; a face seen at an angle squared up; something round made round; a part painted over with surface from elsewhere in the picture; one part kept; each result fitted within 512 px) and draws a contact sheet (see the `image-upscale-remap` skill) |
| `npm run compositionEditor` | edit `pre_encoding_source.json` with live thumbnails, at `http://127.0.0.1:3100` (see [instanced_mesh_composition.md](../graphics/instanced_mesh_composition.md#indexed-compositions)) |
| `npm run particleEffectEditor` | edit `particleEffects.json` (the particle effects) with a live preview, at `http://127.0.0.1:3300`; `-- --source <path>` edits a copy instead (see [particles.md](../graphics/particles.md)) |

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
`npm run dev` seeds users into the emulator. Log in as one with `?devuser=N`, which sets the auth cookie. Dev mode only.

| N | Username | Type |
|---|---|---|
| 1–3 | DevMember1–3 | Member |
| 4 | DevAdmin | Admin |

## Sandbox seats
`?sandboxuser=<name>` opens the sandbox — an empty single-player room — as a guest, and `?sandboxadmin=<name>` as an admin. Either player is the sandbox's superuser, so it is the quick way to reach the door and label tools without a hub. Each name is its own reusable account, and these too are dev mode only. See [sandbox.md](../testing/playtest/sandbox.md).

## Cookie reset across restarts
The emulator DB is empty on every fresh start, but browser cookies persist. The server stamps each browser with a boot id (`thingspool_dev_boot_id` cookie) that matches a marker document in the emulated DB. After a full restart the marker is gone, so stale browsers have their auth cookies cleared. A hot reload keeps the marker, so sessions survive. Dev only.

## Committing
Run `npm run beforeCommit` (so production bundles are committed), then commit and push.
