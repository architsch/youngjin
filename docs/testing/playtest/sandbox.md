# Local Sandbox Playtest

A quick playtest against the local dev server, in a room built for the purpose instead of one reached by playing. It covers what the [staging playtest](workflow.md) cannot: admin tools without promoting an account, and any arrangement of blocks, objects and zones stood up on request.

Reference: @dev/scripts/playtest/sandboxRunner.js , @dev/scripts/lib/setup.js , @dev/scripts/lib/interact.js , @src/client/system/util/automationSetupUtil.ts

## The sandbox room
- A dev-only single-player room: bare floor under a ceiling, a free camera, and a player who does not walk. Edits stay on the client and nothing is stored (see [single_player_mode.md](../../networking/single_player_mode.md)).
- `?sandboxuser=<name>` opens it as a guest, `?sandboxadmin=<name>` as an admin. Each name is its own reusable account, dev mode only.
- An admin there gets the door tools a hub gives (`RoomValidationUtil`). Room settings stay hidden, since the room is not stored — those need `--fresh-room` or the staging playtest.
- Build calls refuse to run in any other room, so they can never fake evidence a real room would have refused.

## Running
```
node dev/scripts/e2eDevServer.js devnossg                        # a dev server first, if /health does not answer
node dev/scripts/playtest/sandboxRunner.js --serve [--admin]     # hold a session open and drive it
node dev/scripts/playtest/sandboxRunner.js <script.js> [--admin] [--headed] [--out=dir]
node dev/scripts/playtest/sandboxRunner.js --probe               # boot, dump the visible UI, one screenshot
node dev/scripts/playtest/sandboxRunner.js --serve --fresh-room [--room-type=hub] [--devuser=4] [--seed=N]
```
- The runner never starts a dev server; it exits with instructions if none answers.
- `--fresh-room` opens a generated room from a fixed seed, owned by a seeded dev user and removed afterwards — for what the sandbox cannot host: generation itself, travel between rooms, and anything stored.
- Screenshots land in `test-results/sandbox/` (git-ignored). **Read them.** The runner cannot tell a good frame from a half-loaded one.

## Driving a session
`POST /do {"op": ..., "args": [...]}` performs one step and returns the pose, camera, selection and game mode after it; `GET /ops` lists every op, `GET /state` looks without acting, `POST /end` finishes. A failed step returns the reason and leaves the session up.

```
curl -s -X POST http://127.0.0.1:4321/do -d '{"op":"stage","args":[{"row":14,"col":14,"rows":9,"cols":11,"layers":8,"wallTextureIndex":45,"floorTextureIndex":14,"open":["-z"]}]}'
```
The bare `:4321/...` shorthand does not work under zsh. Ops share their names with what a script's `run(ctx)` calls, so a sequence that works transcribes into a script line for line. A script exports `{slug?, run(ctx)}`; `ctx` carries `shot`, `clickId`, `clickText`, `describeUI`, `hideHUD`, plus `setup` and `interact`. Keep scratch scripts outside the repo — the dev server watches `dev/` apart from its ignored directories, and a write there restarts it mid-run.

| Build op | Stands up |
|---|---|
| `stage` | four walls around a floor rectangle; returns each wall's cells and its inward face |
| `addBlocks` / `removeBlocks` | a box of blocks, or a doorway cut through one already standing |
| `addObject` / `removeObject` | a canvas, a door, a lamp or a label on a cell's face (walls, or a block's top or underside), at the size the game adds it at, by the game's own metadata keys |
| `resizeObject` | a standing object at another size, in multiples of its type's step; the placement rule still applies, and the size it ended up with is returned |
| `restrictedZones` / `texturePack` / `roomLighting` | room-level state; each reports when called with nothing |
| `palettes` / `pictures` / `doorStyles` / `canvasFrameStyles` | the values to build out of, as the game uses them |
| `camera` / `cameraPose` | where the free camera stands and what it aims at, in world coordinates |
| `clearSandbox` | back to bare floor, between one test and the next |

## Traps
- **Arrange with `setup`, act with `interact`.** Build calls skip the permission check, so a door hung by `addObject` proves nothing about an admin's door tools — reach those through `ensureEditMode`, a real surface click and `uiClick` on the control.
- Hang objects on the cells `stage` reports, not on one worked out by hand: naming the cell *in front* of a wall hangs the object in mid-air, and it reads as deliberate until the camera moves.
- The room is lit by a light the camera carries, reaching as far as it is aimed, and past the built set there is only black.
- A canvas fetches its picture over the network, so a frame taken straight after one goes up catches a blank placeholder.
- Restricted-zone outlines are drawn in edit mode only; the zones themselves stand either way.
- Selection does not move the free camera, so a composed view survives entering edit mode.
- A drag that starts on the selected attached object's outline moves or resizes it rather than the view; a move follows the face under the pointer, so a drag can carry a lamp from a wall onto the floor. `bridge("selectionGizmo")` gives the points to drag from (its middle, and the outline's corners when it resizes), and `interact.orbit` starts beside the outline when it covers the canvas's middle.
