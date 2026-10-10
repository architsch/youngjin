# Local Sandbox Playtest

A quick playtest against the local dev server, in a room built for the purpose instead of one reached by playing. It covers what the [staging playtest](workflow.md) cannot: superuser tools without promoting an account, and any arrangement of blocks, objects and zones stood up on request.

Reference: @dev/scripts/playtest/sandboxRunner.js , @dev/scripts/lib/setup.js , @dev/scripts/lib/interact.js , @src/client/system/util/automationSetupUtil.ts

## The sandbox room
- A dev-only single-player room: bare floor under a ceiling, a free camera, and a player who walks only once `cameraMode("firstPerson")` hands the view to their eyes (movement keys then steer). Edits stay on the client and nothing is stored (see [single_player_mode.md](../../networking/single_player_mode.md)).
- `?sandboxuser=<name>` opens it as a guest, `?sandboxadmin=<name>` as an admin. Each name is its own reusable account, dev mode only.
- Its player, guest or admin, is its superuser and gets the door and label tools a hub's admin has (`RoomValidationUtil`). Room settings stay hidden, since the room is not stored — those need `--fresh-room` or the staging playtest.
- Build calls refuse to run in any other room, so they can never fake evidence a real room would have refused.

## Running
```
node dev/scripts/e2eDevServer.js devnossg                        # a dev server first, if /health does not answer
node dev/scripts/playtest/sandboxRunner.js --serve [--admin]     # hold a session open and drive it
node dev/scripts/playtest/sandboxRunner.js <script.js> [--admin] [--headed] [--out=dir]
node dev/scripts/playtest/sandboxRunner.js --probe               # boot, dump the visible UI, one screenshot
node dev/scripts/playtest/sandboxRunner.js --serve --fresh-room [--room-type=hub] [--devuser=4]
```
- The runner never starts a dev server; it exits with instructions if none answers.
- `--fresh-room` opens a newly generated room, owned by a seeded dev user and removed afterwards — for what the sandbox cannot host: generation itself, travel between rooms, and anything stored.
- Screenshots land in `test-results/sandbox/` (git-ignored). **Read them.** The runner cannot tell a good frame from a half-loaded one.

## Driving a session
`POST /do {"op": ..., "args": [...]}` performs one step and returns the pose, camera, selection and game mode after it; `GET /ops` lists every op, `GET /state` looks without acting, `POST /end` finishes. A failed step returns the reason and leaves the session up.

```
curl -s -X POST http://127.0.0.1:4321/do -d '{"op":"stage","args":[{"row":14,"col":14,"rows":9,"cols":11,"layers":8,"wallTextureIndex":45,"floorTextureIndex":14,"open":["-z"]}]}'
```
The bare `:4321/...` shorthand does not work under zsh. Ops share their names with what a script's `run(ctx)` calls, so a sequence that works transcribes into a script line for line. A script exports `{slug?, run(ctx)}`; `ctx` carries `shot`, `clickId`, `clickText`, `describeUI`, `hideHUD`, plus `setup` and `interact`. Answer a confirm popup with `ui.confirm`, not `clickText`: its Yes takes no click for the popup's first moment and shows no sign of it. Keep scratch scripts outside the repo — the dev server watches `dev/` apart from its ignored directories, and a write there restarts it mid-run.

| Build op | Stands up |
|---|---|
| `stage` | four walls around a floor rectangle, two cells thick so that a door can hang on them; returns each wall's innermost cells and its inward face |
| `addBlocks` / `removeBlocks` | a box of blocks, or a doorway cut through one already standing |
| `addObject` / `removeObject` | a canvas, a prop, a door, a lamp or a label on a cell's face (walls, or a block's top or underside), at its type's default size (a prop at its image's), by the game's own metadata keys |
| `resizeObject` | a standing object at another size, in multiples of its type's step; the placement rule still applies, and the size it ended up with is returned |
| `restrictedZones` | the room's zones, each a volume of whole cells kept for a user (from floor to ceiling and for nobody, unless given); reports them when called with nothing |
| `texturePack` / `roomLighting` | room-level state; each reports when called with nothing |
| `palettes` / `pictures` / `doorStyles` / `canvasFrameStyles` | the values to build out of: a pack's curated palettes (`RoomPaletteMap`), and the rest as the game uses them (each picture with the type that shows it) |
| `camera` / `cameraPose` | where the free camera stands and what it aims at, in world coordinates |
| `cameraMode` | `"firstPerson"` to walk the player (e.g. to test movement or the view on stairs), `"free"` to go back |
| `clearSandbox` | back to bare floor, between one test and the next |

## Traps
- **Arrange with `setup`, act with `interact`.** Build calls skip the permission check, so a door hung by `addObject` proves nothing about the superuser's door tools — reach those through `ensureEditMode`, a real surface click and `uiClick` on the control.
- Rows, columns and layers count cells half a world unit wide and high, so a block is a cube that size and a wall a world unit thick is two cells. `restrictedZones` counts the same cells.
- An object is centred on the face of the cell named, and one a world unit wide reaches half a cell past it on either side: it needs wall behind all of that, and a door needs it two cells deep.
- Hang objects on the cells `stage` reports, not on one worked out by hand: naming the cell *in front* of a wall hangs the object in mid-air, and it reads as deliberate until the camera moves.
- The room is lit by a light the camera carries, reaching as far as it is aimed, and past the built set there is only black.
- A canvas or prop fetches its picture over the network, so a frame taken straight after one goes up catches a blank placeholder.
- A click goes through a prop wherever its image is see-through, its middle included, and selects the face behind. `interact.clickObject` aims where it doesn't, and `bridge("clickPoint", objectId)` gives that pixel to a script that clicks by hand.
- Restricted-zone outlines are drawn in edit mode only; the zones themselves stand either way.
- Selection does not move the free camera, so a composed view survives entering edit mode. For the game's own orbit instead, hand the camera back before entering it (`cameraMode("firstPerson")`, then `place` and `ensureEditMode`).
- `place` takes its `faceX` and `faceZ` as a heading, not as a point to face.
- In edit mode `press` with a movement key (`"ArrowRight"`, `"KeyW"`) steps the selection the way the key points in that view, round a corner where the surface turns one, and `bridge("selection")` says where it went. A face turned away from the camera is passed over for the one beyond it, and the press goes nowhere when that is turned away too: under the free camera, judged from where that stands.
- In edit mode `press("Control+z")` undoes the latest edit a tool or a drag made, or the latest selection a click or a movement key made, and `press("Control+y")` redoes it (see [game_mode.md](../../gameplay/game_mode.md#undo-and-redo)); `bridge("hasBlock", …)`, `bridge("objects")` and `bridge("selection")` say what a step did. A build op enters nothing to undo, leaving edit mode empties what could be, and the keys reach nothing under a popup or while a text field has the keyboard (blur it first).
- A script that holds the page for seconds on end (probing the whole canvas in one `page.evaluate`) misses the server's ping. The reconnect hands the sandbox back bare and in play mode, and the next step fails for no visible reason: probe a band of the screen at a time.
- A drag that the selection's outline takes edits the selection rather than turning the view. An attached object moves by its inside (following the face under the pointer, so a drag can carry a lamp from a wall onto the floor) and resizes by its corners; a block face's outline takes no press, so a drag from it turns the view. `bridge("selectionGizmo")` gives the points to drag from (the `kind`, the middle, the outline's `corners`, and the `handles` by `id`: only those a drag could resize the selection by), `interact.dragBetween` drags between two of them, and `interact.orbit` starts beside the outline when it covers the canvas's middle.
- No handles are on offer further from the camera than `SELECTION_HANDLE_MAX_DISTANCE` (`canResize` reads false, and a drag from an object's corner moves it): bring the free camera nearer, or zoom the orbit in.
- Under the game's own orbit, a drag of an object by its inside that holds the pointer near the top or bottom edge of the view (or over the bottom tools), or in the wider margin at either side (a share of its width, see `SelectionEditGizmoUtil`), has the camera slide toward the place pointed at for as long as it is held there, and turn once the object is on a face looking another way. So `dragBetween`'s end point lands further on in the room the longer the drag lasts: read `camera` and `view` while it is held (`hold: true`). The free camera never moves.
- The handles on offer follow the selection being announced. A build op announces nothing, so after an `addObject`, `resizeObject` or `addBlocks` near the selection, select something else and come back before reading them.
- A drag asking for what the selection can't do turns its outline and handles red while it is held (`dragBetween` with `hold: true`, then a `shot`).
- Read `selectionGizmo` only once the orbit camera has come to rest (after an `orbit`, a `zoom` or a new selection): its points are where things show now, and a press on a stale one lands beside the handle and turns the view instead.
- `dragBetween` with `hold: true` leaves the pointer down, to look at the room mid-drag; end it with `interact.releaseDrag`. A second press would abandon the drag instead.
- `bridge("selection")` names a selected face's `facing`, and `bridge("hasBlock", row, col, collisionLayer)` says whether a cell layer holds a block.
