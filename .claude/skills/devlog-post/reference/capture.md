# Capturing the screenshots

`dev/scripts/devlog/captureRunner.js` boots a Chromium session against the local dev server, opens
the **sandbox**, and hands control to a **shot script** — a small module under
`dev/scripts/devlog/shots/` that builds a set and photographs it. Shot scripts are kept in the repo
beside the posts they produced, so a post's images can be taken again later.

## 1. Always shoot in the sandbox

A dev-log screenshot is **for exhibition, not for testing** — nobody has to play the game to take
one. So every capture run happens in the sandbox single-player room: 32×32 cells of bare floor,
whose camera is off the player entirely and whose walls, floors, blocks, pictures and doors are
stood up by asking for them. Decide the frame, build what belongs in it, put the camera where the
picture wants it.

The picture stays honest because the thing it is *of* — a material, a shape, a doorway, the way two
surfaces meet — is spawned, drawn and lit exactly as the game does it. Only the room around it was
arranged, the way a film set is.

**When the sandbox cannot show a feature yet, add the way to show it before shooting.** That is a
case in `dev/scripts/lib/setup.js` plus the matching entry on the client-side automation bridge
behind it (`@src/client/system/util/automationSetupUtil.ts`). What the new op owes is the feature's
**appearance** — a couple of convincing visual artifacts — and not its behaviour, which belongs in
the game and its tests. Give it the narrowest signature that puts the feature in frame. It is done
once per feature rather than once per post.

## Running it

```bash
# Hold a browser open and drive it one step at a time. This is how a shot is worked out.
node dev/scripts/devlog/captureRunner.js --serve

# Run a shot script, writing into public/devlog-<year>/
node dev/scripts/devlog/captureRunner.js dev/scripts/devlog/shots/<slug>.js

# Same, but out of public/ while iterating
node dev/scripts/devlog/captureRunner.js dev/scripts/devlog/shots/<slug>.js --out=test-results/devlog-probe

# Watch it happen in a real window (useful when something is not landing)
node dev/scripts/devlog/captureRunner.js dev/scripts/devlog/shots/<slug>.js --headed
```

The runner never starts a dev server; it fails immediately with instructions if none answers.

The sandbox is dev-only, reached through `?sandboxuser=` and gated exactly as `?devuser=` is. Its
player is parked in a corner before `run()` starts so he is never in frame (put him back with
`setup.place` for a shot that wants a character in it), and `ctx.hideHUD()` takes the chat bar and
the name label out of the picture. Leave the HUD in only for a post about the interface itself.

## What a shot script exports

```js
module.exports = {
    slug: "orbit-camera",     // names every file: shot("overview") -> orbit-camera-overview.jpg
    // viewport: { width: 1280, height: 800 },
    // hideDebugUI: true,     // hides the in-game debugger; leave on
    // dismissPopups: true,   // clears any welcome popup before run() starts
    async run(ctx) { /* ... */ },
};
```

Copy `shots/_template.js` and rewrite `run()`. A run never inherits what the last one built — the
sandbox is generated empty each time — so `run()` can assume it starts from nothing.

## What `run(ctx)` is given

| | |
| --- | --- |
| `shot(label, opts?)` | Settles the frame, then writes `<slug>-<label>.jpg`. `opts.selector` shoots one element; `opts.settleMs` waits longer first |
| `setup.*` | **Builds the set and aims the camera.** The main working surface — see below |
| `hideHUD()` / `showHUD()` | Takes the whole interface out of shot and gives it back. Called in almost every shot |
| `clickId(id)` / `clickText(text)` | For the few visuals that only appear inside edit mode — `clickId("gameModeToggleSwitch")` enters it. The UI's controls are styled `div`s, not `<button>`s, so role-based locators find nothing |
| `describeUI()` | Everything currently visible that can be clicked or read, with its position |
| `dismissPopups()` / `hideDebugUI()` | Both already done before `run()` starts; call again after something reopens one |
| `sleep(ms)`, `page`, `log()` | The raw Playwright `Page` is there for anything the helpers do not cover |

### `ctx.setup` — building the set

**This table is meant to grow** (see point 1 above). All of it refuses to act outside the sandbox
room, with a named error.

| | |
| --- | --- |
| `stage({row, col, rows?, cols?, layers?, wallTextureIndex?, floorTextureIndex?, open?})` | **Start here.** Four walls around a rectangle of floor, with `open: ["-z"]` leaving the near side out for the camera to look in through. Returns the rectangle, its `centre`, its `floorY` and its `walls` |
| `addBlocks({row, col, collisionLayer, rows?, cols?, layers?, textureIndex?})` | A box of blocks. `rows`/`cols`/`layers` default to 1, so this is equally a single block, a plinth, a step or a pillar |
| `removeBlocks({row, col, collisionLayer, rows?, cols?, layers?})` | Takes one away again — how a doorway or a window is cut into a wall already standing |
| `addObject({type, row, col, face?, collisionLayer?, y?, metadata?})` | Hangs a `"Canvas"` or a `"Door"` on a face of a cell. Metadata by the game's own key names — `{ImagePath: "1/14"}`, `{Label: "Library"}` |
| `removeObject(objectId)` | Takes one down |
| `restrictedZones([{rowMin, rowMax, colMin, colMax}, ...])` | The stretches of a room only its superuser may edit. Called with nothing it reports what the room holds |
| `texturePack(path?)` | What the whole set is finished in; re-dresses everything already standing. Called with nothing it reports the current pack and the ones on offer |
| `palettes(path?)` | The `{floor, ceiling, wall, prop}` texture indices the game finishes its **own** rooms in |
| `pictures()` / `doorStyles()` | The paintings a canvas can carry; the finishes a door can be given, each ready to spread into `metadata` |
| `camera({x?, y?, z?, atX?, atY?, atZ?})` | Where the camera stands and what it is aimed at, in **world** coordinates. Either half alone: moving without re-aiming keeps the subject in frame |
| `cameraPose()` | Where it is now, with the distance and unit direction between the two |
| `place(x, z, opts?)` / `face(x, z)` | Stands the player somewhere and turns him — only for a shot that wants a character in it |
| `clearSandbox()` | Back to bare floor, everything hung taken down, zones dropped, camera reset — between one shot and the next |

Six things that otherwise cost a run:

- **Hang things off `stage().walls`, never off a cell you worked out yourself.** Each entry is that
  wall's own cells and the face of them that looks into the room, so only the position along the
  wall is left to choose. Naming the cell one *in front* of a wall hangs the object in mid-air, and
  it reads as deliberate until the camera moves.
  ```js
  const hall = await setup.stage({ row: 12, col: 11, rows: 12, cols: 14, layers: 15, ... });
  await setup.addObject({ ...hall.walls["+z"], type: "Door", col: 14, metadata: { Label: "Cellar" } });
  ```
- **Dress out of a palette, not out of freehand indices.** `textureIndex` is a position in the
  texture pack, and the packs are not organised by material — index 7 in one pack is nothing like
  index 7 in another. A set built from a palette looks like somewhere the game would build; one
  built from hand-picked numbers looks like a paint chart.
- **Give the set its own ceiling** (`addBlocks` at the top layer in the palette's `ceiling`). The
  sandbox room has one, but it is finished in an unrelated palette and shows above your walls as a
  band of the wrong colour.
- **Past the set there is black.** The sandbox has no walls and no sky, so a subject shot without a
  set around it reads as a small grey shape in a void.
- **The room is lit by a light the camera carries, reaching as far as the camera is aimed.** A
  camera aimed at a point much nearer than its subject leaves the subject dark. Aim at the subject.
- **A canvas fetches its picture over the network.** A frame taken straight after one goes up
  catches a blank white placeholder, which reads as a broken game. Pass `shot(label, {settleMs:
  2500})` for any frame with a picture in it, and **look at the image** afterwards.

A collision layer is **half a cell** tall, so a wall as tall as a person is five of them and a
comfortable room is eight. A `floorTextureIndex` on `stage` lays a *layer of blocks* over the room's
own floor, so everything standing on it starts at layer 1 — which is what `stage`'s returned `floorY`
is for. Build near the middle of the 32×32 room (around row/col 14-18), which keeps room on every
side for the camera to stand back into. `addObject` refuses a door with no floor under it and
anything with a block standing in front of it, naming the cells at fault.

**A restricted zone's red outlines belong to edit mode.** The zones stand either way, but the lines
over them are drawn only inside the mode — so that shot lays the zones and then calls
`clickId("gameModeToggleSwitch")`. The sandbox camera is bound to no selection, so the frame stays exactly
where it was composed; `hideHUD()` afterwards, since the mode brings its own controls up.

## 2. A few shots, made to look different

**Two to four per post.** They have to differ from each other **and** from the images already in
`public/devlog-<year>/` — read the recent ones with the Read tool before choosing vantages, since
the reader meets the new post beside them.

Differ **in kind**, not by distance: high and looking down over the set; through a doorway, so an
opening frames the shot and there is depth beyond it; close and oblique at the subject's own level,
where its material reads. Changing the texture pack or the palette between two sets is a legitimate
way to make them differ and costs one call. Two kinds is the minimum, three is better; the same
walk-up shot at three distances is not variety.

**Different is not the same as exhaustive.** Choose the palette and the vantages up front, shoot
them, and stop. Working through the texture packs or the picture list to see which comes out best
turns a composition decision into a survey: it costs many times the run it replaced and ends with a
picture no better than the first good one. **The post needs a couple of good-looking images, not the
best obtainable ones.**

**Read every JPEG with the Read tool as you go.** The runner cannot tell a good frame from a bad
one, and neither can the pose. Re-shoot for a **fault** — a loading indicator, a half-arrived room,
an open debugger, an empty canvas, a camera pointed away from the subject, or a frame that fails the
rules below — and never to learn whether some other arrangement might be marginally nicer.

Give shots labels that describe what is in them (`overview`, `palette`, `before`, `after`), not their
order. The first image in the post becomes its share preview, so lead with the one that reads best at
a glance.

## 3. Composing the frame

Most readers meet the post as a thumbnail on a phone. In the sandbox the camera and everything in
front of it are both yours, so composition is a decision rather than a consequence — which is why
these rules are worth *more* attention here, not less.

- **The rule of thirds.** Aiming `at` the subject puts it dead centre. Offset the aim point a little
  to one side, or a little above or below, so the subject falls on a third and the rest of the room
  fills the frame beside it — but not so far that the subject leaves the light the camera carries. A
  wall edge or a horizon cutting the frame exactly in half is the same fault in another form.
- **Decent contrast, in colour rather than brightness.** Brightness is already being spent by
  distance and by the camera's own light. Let the parts of the frame differ in hue — a floor from the
  palette's `floor` against walls from its `wall`, a band of another material at the subject's own
  height — while staying inside one scheme. Colours that clash wildly are as bad as a frame that is
  all one tone.
- **No dead margin; keep the frame balanced.** Half the frame taken up by one blank wall, a bottom
  third of empty floor, or a dark unlit void along an edge means the set was not finished. Every
  quarter of the frame should hold something. The subject itself should fill roughly a third to a
  half of the frame's shorter side — in the sandbox that is four to eight units back from it, and
  `cameraPose()` reports the distance you actually got.
- **Variety in what the set is made of.** Three or four things at different depths: a wall behind the
  subject and a second running away to one side, so the room has a corner and a vanishing point; a
  picture to carry a wall that would otherwise be blank; a plinth, a step or a pillar; a doorway cut
  with `removeBlocks`, giving the eye somewhere to go beyond the set. A room dressed until it is busy
  is as bad a photograph as a bare one — the test is whether the eye finds the subject in about a
  second and still has somewhere else to go afterwards.
- **Come at the subject obliquely.** A camera square onto a wall photographs a flat rectangle:
  the edges stay parallel, nothing recedes, and the room reads as a painted backdrop. Stand off to
  one side and a little above (or below), so the wall runs away toward a vanishing point. Two limits:
  a canvas has a front and nothing else, so too far round it is a view of a blank rectangle; and
  rooms are drawn without their ceilings for the camera, so from too high the frame fills with the
  black above them.

## While you are iterating

**Work each shot out in a session, then write the script.** Editing a whole shot script and
re-running it from boot to find out what one step did costs a full run per guess.

```bash
node dev/scripts/devlog/captureRunner.js --serve &
```

Then send one step at a time; every response carries the resulting camera, pose and selection.

```bash
curl -s -X POST http://127.0.0.1:4321/do -d '{"op":"hideHUD"}'
curl -s -X POST http://127.0.0.1:4321/do -d '{"op":"palettes"}'
curl -s -X POST http://127.0.0.1:4321/do -d '{"op":"stage","args":[{"row":14,"col":14,"rows":9,"cols":11,"layers":8,"wallTextureIndex":45,"floorTextureIndex":14,"open":["-z"]}]}'
curl -s -X POST http://127.0.0.1:4321/do -d '{"op":"addObject","args":[{"type":"Canvas","row":22,"col":19,"face":"-z","collisionLayer":4,"metadata":{"ImagePath":"1/14"}}]}'
curl -s -X POST http://127.0.0.1:4321/do -d '{"op":"camera","args":[{"x":14.5,"y":3.4,"z":11.5,"atX":19.5,"atY":1.7,"atZ":19}]}'
curl -s -X POST http://127.0.0.1:4321/do -d '{"op":"shot","args":["try"]}'   # writes into test-results/devlog-probe/
curl -s -X POST http://127.0.0.1:4321/do -d '{"op":"clearSandbox"}'          # and start the next one
curl -s http://127.0.0.1:4321/ops        # every op this session accepts
curl -s -X POST http://127.0.0.1:4321/end
```

The ops are the same functions a shot script calls, under the same names, so a sequence that works
transcribes into `run(ctx)` line for line. Note the shell form: the bare `:4321/...` shorthand does
not work under zsh.

- Iterate on the script **in place**, in `dev/scripts/devlog/shots/`. The dev server's watcher
  ignores that directory, so writing there does not restart the server mid-run. Writes elsewhere
  under `dev/` still do.
- `clearSandbox` between shots in one session, or the second is composed against the first one's
  scenery.
- A call that fails says why in a sentence — "this is not the sandbox room", "cell [row 40, col 3] is
  outside the room", "'stone' is not a texture pack. The packs are default, country, garden, aqua,
  inferno, prison" — and that sentence is generally the whole answer. Console errors from the run are
  printed at the end.
