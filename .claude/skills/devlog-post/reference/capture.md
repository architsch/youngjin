# Capturing the screenshots

`dev/scripts/devlog/captureRunner.js` boots a Chromium session against the local dev server, signs
in, waits until the game is actually standing in a room, and then hands control to a **shot
script** — a small module under `dev/scripts/devlog/shots/` that walks the game through whatever
the feature needs in order to be seen.

Shot scripts are kept in the repo alongside the posts they produced, so a post's images can be
taken again after the feature has moved on.

## Build the set; do not go looking for one

**A dev-log screenshot is a photograph, not a recording.** It has never been a claim that the room it
was taken in arose by itself. What it has to be honest about is the *thing it is of* — a material, a
shape, a doorway, the way two surfaces meet — and that thing is the real one either way: spawned,
drawn and lit exactly as the game does it. The room around it is scenery, in the sense a film set is.

So a run opens in the **sandbox**: an empty room, 32×32 cells of bare floor, whose camera is off the
player entirely and whose walls, floors, pictures and doors are stood up by asking for them. A shot is
then composed the way a photograph is — decide the frame, build what belongs in it, put the camera
where the picture wants it.

The alternative is what this replaced, and it is worth knowing why. Photographing a feature inside a
generated room means *searching* for it: a wall that will take a door, a staircase with a clear line
up it, a corner that is not blank. That search is most of a run's wall-clock time, it lands somewhere
slightly different every time, and — the real cost — the picture ends up taken from wherever the
search stopped, through an orbit that frames whatever is selected rather than whatever the picture
wanted. A sandbox shot takes about seven seconds, comes out identical every time, and is framed on
purpose.

**Two cases still need a generated room**, and they are the only two:

| | |
| --- | --- |
| The subject is a room the **generator** produced | How a hub is laid out, what two storeys look like, what procedural generation actually makes. A set built by hand cannot show that, because what it shows is what was built |
| The shot has to **perform a flow** | Entering edit mode, hanging a picture through the tools, walking through a door — where the picture is of the game being used |

Those set `freshRoom: true` and copy `shots/_generated-room-template.js`. Everything else copies
`shots/_template.js`, which is the sandbox one.

**"The sandbox cannot reach it yet" is not a third case — it is missing setup surface.** When a newly
built feature has no op that puts it in frame, add one rather than photographing it in a generated
room: the shortcut is taken once and then charged on every future post about that feature. What a
mock owes is the feature's *appearance* — the outlines it draws, the state it leaves standing — and
not its behaviour, which belongs in the game and its tests. It is honest on the same terms as the
rest of the sandbox: the thing in frame is spawned, drawn and lit by the game, and only the route to
it was arranged.

The `perform a flow` row is where that stops. When the picture is of the game *being used* — a hand
on the tools, a menu open over the thing it edits — the flow **is** the subject, and mocking it would
be photographing something that never happens. **Mock the state; never mock the act.**

## Running it

```bash
# Hold a browser open and drive it one step at a time. This is how a shot is worked out.
node dev/scripts/devlog/captureRunner.js --serve

# Run a shot script, writing into public/devlog-<year>/
node dev/scripts/devlog/captureRunner.js dev/scripts/devlog/shots/<slug>.js

# Same, but out of public/ while iterating
node dev/scripts/devlog/captureRunner.js dev/scripts/devlog/shots/<slug>.js --out=test-results/devlog-probe

# A generated room instead — for the two cases above only
node dev/scripts/devlog/captureRunner.js dev/scripts/devlog/shots/<slug>.js --fresh-room
node dev/scripts/devlog/captureRunner.js --serve --fresh-room [--room-type=hub] [--devuser=4]

# Boot and dump the screen — what is clickable, where it is. No shot script needed.
# Add --fresh-room when the point is to find the editing controls, which a set has none of.
node dev/scripts/devlog/captureRunner.js --probe

# Watch it happen in a real window (useful when a gesture is not landing)
node dev/scripts/devlog/captureRunner.js dev/scripts/devlog/shots/<slug>.js --headed
```

The runner never starts a dev server; it fails immediately with instructions if none answers.

The sandbox is dev-only — it is reached through `?sandboxuser=`, gated exactly as `?devuser=` is. Its
player is parked in a corner before `run()` starts so he is never in frame (put him back with
`setup.place` for a shot that wants a character in it), and `ctx.hideHUD()` takes the chat bar and
the name label out of the picture. Leave the HUD in only for a post about the interface itself.

### When the shot does need a generated room

`--fresh-room` seeds the room from a fixed seed before the run and removes it after, so it is the
same room on every machine and inherits nothing from the last run. Without it a run would open on
whatever the dev database happens to hold and keep whatever the last run built — a picture hung by an
earlier attempt still on the wall, and a click that used to select bare wall now selecting that
picture.

`roomType: "hub"` (or `--room-type=hub`) is needed for anything upstairs or any door work: **a
Regular room is built one storey tall on purpose**, and doors answer to an admin in a hub and nowhere
else.

It plays as **seeded dev member 1** (`?devuser=1`), which only exists in dev mode. That account keeps
whatever first-time prompts it has already dismissed, so consecutive runs capture the same game
rather than a stranger's first visit. A fresh guest (`devUser: null`) is right only for a post about
what a new player meets.

**Seat 4 is a seeded admin**, and it is the only way to photograph anything admin-only — laying,
moving, labelling or re-wiring a hub's doors, opening a new hub, or the hub settings form. Nothing
in the product ever makes an admin, so a shot script that needs one sets `devUser: 4` and there is
no other route. A member seat standing in the same hub simply does not have the controls, and the
run fails looking for a button that was never rendered.

The session starts in a **hub**, which anybody standing in it may edit, whoever they are. So a shot
of the editing controls needs no room of one's own, and no travelling to reach one. **Doors are the
exception**: editing a room is
not enough to manage them, because a door is a join between rooms rather than a piece of a room's
contents. In a hub they answer to an admin only; in an owned room nobody rearranges them at all.

The tutorial is skipped by default via the browser's tutorial-finished cookie. A post about the
tutorial itself sets `tutorial: true`.

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

A run is in the sandbox unless it says otherwise. The four fields below apply only to the generated-
room case, and are unused without `freshRoom`:

```js
    freshRoom: true,          // a generated room instead of the sandbox
    devUser: 1,               // 1-3 members, 4 the admin, or null for a brand-new guest
    startPath: "/",           // or "/<roomID>" to open one room directly (ignored with freshRoom)
    roomType: "regular",      // "hub" for anything upstairs or any door work
    tutorial: false,          // true only for a post about the tutorial
```

## What `run(ctx)` is given

| | |
| --- | --- |
| `shot(label, opts?)` | Settles the frame, then writes `<slug>-<label>.jpg`. `opts.selector` shoots one element; `opts.settleMs` waits longer first |
| `drag(from, to, opts?)` | A pointer drag across the world. Moves in many small steps, because the game reads a drag as a gesture, not a jump |
| `clickAt(point, opts?)` | A tap on the world: selects a block, an object, a doorway |
| `clickId(id)` / `clickText(text)` | The UI's buttons are styled `div`s, **not** `<button>` elements, so role-based locators find nothing. Reach them by id where they have one (`editModeButton`, `startEditingButton`, `modeExitButton`, `configureMyRoomButton`, `addVoxelBlockButton`, `removeVoxelBlockButton`, `addCanvasButton`, `changeCanvasImageButton`, `changeCanvasFrameButton`, `chatTextInput`, `chatSendButton`) and by their exact label otherwise. The texture palette is a scrolling strip rather than a button: its id is `voxelQuadTextureOptions`, which is what `shot(label, {selector})` wants when the palette itself is the picture |
| `press(key)` / `hold(key, ms)` | A keystroke, or a key held down. Rarely what you want — see `setup` below |
| `center()` | The middle of the viewport, the usual anchor for a drag |
| `describeUI()` | Everything currently visible that can be clicked or read, with its position |
| `dismissPopups()` / `hideDebugUI()` | Both already done before `run()` starts; call again after something reopens one |
| `hideHUD()` / `showHUD()` | Takes the whole interface out of shot and gives it back. Called in almost every sandbox shot; leave the HUD in for a post about the interface itself |
| `setup.*` | **Arranges and builds the scene**: the set, the furniture, where the camera looks from. See below |
| `interact.*` | **Acts in it**: clicks aimed from what the page reports. Only for the generated-room case. See below |
| `sleep(ms)`, `page`, `log()` | The raw Playwright `Page` is there for anything the helpers do not cover |

### `ctx.setup` — arranging the scene

The player and the orbit camera, in either kind of room. In the sandbox these matter for one thing
only — putting a character in the frame, or keeping him out of it — and the section after this one is
where the set is actually built. In a generated room they are the whole of how a shot is arranged.

Standing somewhere is a precondition, not the thing being photographed, so it is set rather than
walked to. All of it is exact and immediate.

| | |
| --- | --- |
| `place(x, z, {collisionLayer?, faceX?, faceZ?})` | Stands the player at a point, at that cell's own standing height. Returns the pose reached — assert against that, not against what you passed |
| `vantage({x, z}, {distance?})` | Stands him a few paces off a point, facing it. Usually what a shot wants: the subject is rarely somewhere to stand |
| `face(x, z)` / `faceDeg(deg)` | Turns him, without moving him. Degrees are clockwise from +Z |
| `pose()` | Where he is and which way he faces, with his grid cell |
| `standingSpots({near?, collisionLayer?, limit?})` | **Everywhere in the room he could stand**, nearest first, read off the grid the room was built from |
| `look({azimuthDeg?, polarDeg?, zoom?})` | The view the orbit takes up. `zoom` runs 0 (furthest the mode allows) to 1 (closest) |
| `swing({azimuthDeg?, polarDeg?, zoom?})` | The same, *relative* to the view the mode opened at — which is usually what a shot means |
| `view()` | Where the orbit is looking from now |
| `lookAt(x, y, z)` / `clearLookAt()` | Holds the orbit on a point rather than on the selection |

`standingSpots` is how a script finds its way around a room it has never seen. A room's two storeys
have floors at the bottom and the middle of its height and **nothing else does**, so of the places
the player can stand, the lowest layer is the ground floor, the middle layer (`collisionLayer: 8`) is
the storey above, and everything in between is the treads of a staircase. `shots/second-floor.js`
finds a flight, a gallery edge and a two-storey hall this way, in any room, with no coordinates.

Two things to know, because both otherwise cost a run:

- **`look` speaks to the orbit, which belongs to edit mode.** In play mode the camera sits at the
  player's eye and rides his object; a view set there is taken up when the mode next is.
- **`place` is exact on this client, and the server keeps its own copy.** For a photograph that is
  all that matters. Do not lean on it for anything a server-side position depends on.

### `ctx.setup` in the sandbox — building the set

**This is the main working surface of a capture run.** All of it refuses to act outside the sandbox
room, with a named error: in a room the game generated, a wall that exists because a script asked for
one would not be evidence that walls can be built, and a playtest has to keep that line.

**This table is meant to grow.** A newly built feature with nothing here is one that cannot be
photographed in the sandbox at all, which is what quietly sends every post about it into a generated
room. Adding an op is small — a case in `dev/scripts/lib/setup.js` and the matching entry on the
client-side automation bridge behind it (`@src/client/system/util/automationSetupUtil.ts`) — and it
is done once per feature rather than once per post. Give it the narrowest signature that puts the
feature's appearance in frame; the game keeps the real path in, and this is only the way to a
photograph of it.

| | |
| --- | --- |
| `stage({row, col, rows?, cols?, layers?, wallTextureIndex?, floorTextureIndex?, open?})` | **Start here.** Four walls around a rectangle of floor, with `open: ["-z"]` leaving the near side out for the camera to look in through. Returns the rectangle, its `centre`, its `floorY` and its `walls` |
| `addBlocks({row, col, collisionLayer, rows?, cols?, layers?, textureIndex?})` | A box of blocks. `rows`/`cols`/`layers` default to 1, so this is equally a single block, a plinth, a step or a pillar |
| `removeBlocks({row, col, collisionLayer, rows?, cols?, layers?})` | Takes one away again — how a doorway or a window is cut into a wall already standing |
| `addObject({type, row, col, face?, collisionLayer?, y?, metadata?})` | Hangs a `"Canvas"` or a `"Door"` on a face of a cell. Metadata by the game's own key names — `{ImagePath: "1/14"}`, `{Label: "Library"}`. Returns its `objectId` |
| `removeObject(objectId)` | Takes one down |
| `restrictedZones([{rowMin, rowMax, colMin, colMax}, ...])` | The stretches of a room only its superuser may edit. A zone reaches the room's whole height, so rows and columns are the whole of one. The list replaces whatever is standing; called with nothing it reports what the room holds |
| `texturePack(path?)` | What the whole set is finished in; re-dresses everything already standing. Called with nothing it reports the current pack and the ones on offer |
| `palettes(path?)` | The `{floor, ceiling, wall, prop}` texture indices the game finishes its **own** rooms in. Dress a set out of one of these |
| `pictures()` | The paintings a canvas can carry, each with its title and painter |
| `doorStyles()` | The twelve finishes a door can be given, each ready to spread into `metadata` |
| `camera({x?, y?, z?, atX?, atY?, atZ?})` | Where the camera stands and what it is aimed at, in **world** coordinates. Either half alone: moving without re-aiming keeps the subject in frame |
| `cameraPose()` | Where it is now, with the distance and unit direction between the two |
| `clearSandbox()` | Back to bare floor, everything hung taken down, zones dropped, camera reset — between one shot and the next |
| `sandboxActive()` | Whether this run is in the sandbox at all |

**Hang things off `stage().walls`, never off a cell you worked out yourself.** Each entry is that
wall's own cells and the face of them that looks into the room, so only the position along the wall
is left to choose:

```js
const hall = await setup.stage({ row: 12, col: 11, rows: 12, cols: 14, layers: 15, ... });
await setup.addObject({ ...hall.walls["+z"], type: "Door", col: 14, metadata: { Label: "Cellar" } });
```

Naming the cell one *in front* of a wall is the easy mistake, and it is silent from most angles — the
object hangs in mid-air and reads as deliberate until the camera moves. `addObject` refuses it, along
with two other faults that are much cheaper to be told about than to find in a finished image:

- **Anything standing in front of the object.** A pilaster across a third of a door, or a step in
  front of a picture. The error names the blocking cells, so the fix is to move along the wall.
- **A door with no floor to stand on.** A door is never hung at a height — its bottom edge meets the
  line where the wall meets the floor, and `addObject` takes the height from the floor in front of
  it. So a step running along a wall raises the doors standing on it automatically, and **omitting
  `y` is almost always right**. Pass one only for a door that deliberately sits somewhere else.

**Dress out of a palette, not out of freehand indices.** `textureIndex` is a position in the texture
pack, and the packs are not organised by material — index 7 in one pack is nothing like index 7 in
another. `palettes()` returns the combinations the game's own room generation picks from, each a
floor, a ceiling, a wall and a prop chosen to go together. A set built from one looks like somewhere
the game would build; one built from numbers picked by hand looks like a paint chart.

**Give the set its own ceiling** (`addBlocks` at `collisionLayer: 15` in the palette's `ceiling`).
The sandbox room has one, but it is finished in whatever palette the room was generated from, and it
shows above your walls as a band of an unrelated colour.

**A restricted zone's red outlines belong to edit mode.** The zones stand whether or not anybody is
in the mode, but the lines the game draws over the cells they cover are shown only inside it — so a
shot of them lays the zones and then enters the mode with `clickId("editModeButton")`, in either
order relative to building the set. The sandbox camera is bound to no selection, so entering the mode
leaves the frame exactly where it was composed; `hideHUD()` afterwards, since the mode brings its own
controls up.

**Choose the door finishes.** A door given none takes one of the twelve at random, seeded from its
own id — fine in a room, but over four or five doors the dice regularly hand two or three of them the
same paint, in a post whose subject is that doors can be told apart.

A collision layer is **half a cell** tall, so a wall as tall as a person is five of them and a
comfortable room is eight; layer 0 sits on the room's floor. Note that a `floorTextureIndex` on
`stage` lays a *layer of blocks* over the room's own floor, so everything standing on it starts at
layer 1 — which is what `stage`'s returned `floorY` is for.

Two things about the empty room the set is built in:

- **It has no walls and no sky.** Carved to the grid's edge, so past the set there is black. That is
  what `stage`'s walls are for; a subject shot without them reads as a small grey shape in a void.
- **The room is lit by a light the camera carries**, and the light reaches as far as the camera is
  aimed. So a camera stood well back still lights its set — but a camera aimed at a point much nearer
  than the thing it is photographing will leave the thing dark. Aim at the subject.
- **A canvas fetches its picture over the network** and draws it when it arrives. A frame taken
  straight after one goes up catches the placeholder — a blank white rectangle in the middle of the
  shot, which reads as a broken game rather than a bad photograph. Pass `shot(label, {settleMs:
  2500})` for any frame with a picture in it, and **look at the image** afterwards.

The set is built in a room 32 cells square with a ceiling 8 units up. Building near the middle
(around row/col 14-18) keeps room on every side for the camera to stand back into.

### `ctx.interact` — acting in it

**For the generated-room case.** These produce a real gesture on the canvas, aimed from what the page
reports, and they are how a shot of the game *being used* is taken. A sandbox shot needs none of
them: nothing in the set was clicked into being, so there is nothing to click.

| | |
| --- | --- |
| `find(target)` / `findAll(target)` | Objects by `{objectId}`, `{objectType}`, `{metadata}` or `{index}`, nearest first, each with its screen position and whether a click would reach it |
| `clickObject(target, {approach?})` | Clicks one, refusing with a named reason if it cannot be reached. Pass `{approach: false}` when the player has already been placed within reach |
| `clickSurface({objectType, filter?})` | Clicks a face of wall or floor found by casting through the view |
| `clickSurfaceUntilEnabled(elementId, {objectType})` | Keeps trying surfaces, moving the view between rounds, until that control lights up. **This is how you find a wall that will take a door or a picture** |
| `ensureEditMode()` / `gameMode()` | Edit mode *is* the selection, so it has to be recovered after anything that drops it |
| `ui.click/fill/isEnabled/exists(id)` | The HUD's controls, which are `div`s with `aria-disabled` |
| `call(method, ...args)` | The read-only bridge directly: `probe`, `probeGrid`, `objects`, `camera`, `context`, `selection` |

**The tools live inside edit mode.** In play mode a click on a wall offers only "Start Editing";
`addDoorButton`, `addCanvasButton` and the block tools do not exist until the mode does. A
`clickSurfaceUntilEnabled` waiting on one of them from play mode will try every surface in the room
and report that no wall would take a door. Call `ensureEditMode()` first.

## How the game is driven

Everything from here to the end of this section is about the **generated-room** case. In the sandbox
none of it applies: there is no walking, no orbit and no click, and the camera is stated outright.

**Set the scene; perform the act.** Where the player stands and where the camera looks from are
preconditions — set them with `ctx.setup`, exactly and instantly. What the post is actually about —
a click, a selection, an edit — is performed as a real gesture through `ctx.interact`, so that what
the shot shows is the game working rather than the harness working.

Getting this backwards is the single largest waste in a capture run. The player covers about a pace
in a few seconds, so crossing a room by held key takes the better part of a minute and lands
somewhere slightly different every time; steering is a joystick whose gain varies more than tenfold
between runs; the orbit is measured in pixels of drag from a starting angle nothing reports. A route
built out of those has to be re-tuned every time it is run. `place`, `face` and `look` do the same
job in one call each, exactly, and the same way twice.

So:

- **Never walk to compose a shot.** `setup.vantage({x, z}, {distance: 5})` puts the player a few
  paces off the subject facing it. `shots/nav.js` still holds a closed-loop `walkTo` for the rare
  post where the walking *is* the subject, and nothing else should use it.
- **Never count wheel notches or drag pixels.** `setup.look({azimuthDeg, polarDeg, zoom})` sets the
  view outright; `setup.swing({azimuthDeg: -50})` comes round off whatever the mode opened at, which
  is what "oblique to the wall" actually means.
- **Never write down a click coordinate.** Where anything falls on screen depends on the room that
  was generated and on where the camera ended up. `interact.clickObject`, `interact.clickSurface`
  and `interact.clickSurfaceUntilEnabled` aim from what the page reports, and say why when they
  cannot.
- **Never sleep and hope.** The runner waits for the room through the bridge before `run()` starts.

A single click on the world raycasts into it: that is what selects a block, an object or a doorway.
Which controls appear depends on what was hit — a wall face offers the block tools and the texture
palette, a picture offers the canvas tools — so a script that assumes one and lands on the other
will fail looking for a button.

**A door is the one thing a click does not merely select.** To anybody but an admin, clicking a door
he is standing next to is a journey: the client leaves for the destination room, and the next shot is
of somewhere else entirely. Only on the admin seat does the click take hold of the door instead — and
it enters edit mode along with the selection, which is where `changeDoorLabelButton`,
`changeDoorDestinationButton`, `customizeDoorButton`, `doorSettingsButton` and `enterDoorButton`
appear. `addDoorButton` sits with the block tools on a selected wall face, admin-only and in a hub
only.

**A room stands two storeys tall, and half of it is over the player's head.** Hubs put a floor across
the middle of their height, open some spaces through both storeys as galleries, and join the two with
staircases; a **Regular room is deliberately one storey only**. `setup.standingSpots()` reports both
storeys and the stairs between them, so there is no need to go looking for either.

### Edit mode is what a shot of the room needs

A click on its own is not an edit any more (see `docs/gameplay/game_mode.md`). In play mode it
selects the thing and says what it is — a picture's title and author, and nothing else — while the
camera stays at the player's eye. The orbit, the editing controls and the character-customization
strip all belong to **edit mode**, which there are two ways into:

- `editModeButton`, on the identity bar, opens the mode **on the player's own character** — not on
  whatever the script wanted. It is the only way in while nothing is selected.
- `startEditingButton` ("Start Editing"), on the mode menu, opens the mode **on whatever is already
  selected**. It appears once a play-mode click has picked something out, and only in a room the
  user may edit — so it is absent in a room he is only visiting, where the identity bar's way in
  still works because his own character is always his to change.

So a shot of one particular thing is: click it in play mode, then `startEditingButton`. Prefer that
to entering on the player and clicking the subject afterwards. It is the same two actions, but the
orbit opens already framing the subject instead of swinging onto it from the player — which is one
fewer view the script has to guess a click coordinate from. Four consequences of the mode, each of
which will otherwise cost a run:

- **The identity bar's way in disappears while anything is selected.** `editModeButton` lives on
  that bar, which steps aside for the mode menu the moment a selection is up — that menu is where
  `startEditingButton` then is. To get the identity bar back instead, give the selection up first
  (`modeExitButton`, labelled "Deselect" in play mode and "Stop Editing" inside the mode).
- **Clicking the thing already selected leaves the mode.** Inside edit mode a second click on the
  current selection is read as being done with it, and the mode ends along with the selection. A
  script that re-clicks a subject to "make sure" it is selected drops itself back into play mode.
- **How far the user may reach into the room grows with how far the orbit has been pulled back.**
  Something across the room can be plainly visible and still out of reach at the mode's opening
  distance, and answer no click at all. Better than pulling back is standing closer:
  `setup.vantage({x, z}, {distance: 4})` puts the player within reach of the subject, after which
  `interact.clickObject(target, {approach: false})` will land.
- **The orbit's angle and zoom carry over** into the next selection and across leaving and
  re-entering the mode. This is why the view is *set* rather than dragged to: `setup.look` puts it
  where the shot wants it whatever the last selection left behind, and `setup.swing` comes off
  whatever the mode has just opened at.
- **Every selection moves the camera.** Inside edit mode the orbit follows whatever is picked out,
  so a screen coordinate measured before a selection means nothing after it. Anything that dresses
  several faces in turn has to find each one immediately before using it (`interact.clickSurface`
  re-probes every time), not work out a list of points in advance.

A miss is what makes this bite: a click meant for a picture that lands on the wall behind it selects
that wall and swings the orbit onto it, so the retry is aiming from a view the first attempt moved.
`interact.clickObject` refuses rather than missing, and names the reason, which is what keeps a run
from wandering off after one bad aim.

## Making the shots worth publishing

Most people who meet the post will look at the picture and read at most a line of it, so the images
carry more of the invitation than the prose does. A frame that shows something worth walking into
is doing the post's main job.

- **Look at every image with the Read tool.** The runner cannot tell a good frame from a bad one.
  Re-shoot anything showing a loading indicator, a room whose meshes have not all arrived, an open
  debugger, an empty canvas, or a camera pointed away from the thing the post is about — and
  anything that fails the composition rules below, which is the commoner fault by far.
- Show the feature in use, not merely the menu that opens it. Where something changes state, a
  before/after pair says more than either half.
- Give shots labels that describe what is in them (`overview`, `palette`, `before`, `after`), not
  their order.
- Keep 2-4 per post.

**The set has to vary, and that is a separate judgement from whether each frame is good.** A group of
shots can pass every rule below individually and still fail together, because the reader meets them
at once: three frames of the same subject, at the same distance, from the same height, differing only
in which controls happen to be open, read as one picture printed three times. So choose the vantages
before shooting any of them and make them differ **in kind** — high and looking down over the set;
through an opening, so a doorway frames the shot and there is depth beyond it; close and oblique at
the subject's own level, where its material reads; from well back with the whole room around it. Two
kinds is the minimum and three is better; the same walk-up shot at three distances is not variety.
Lay the finished images side by side and ask whether they look like three views of a place or one
view taken three times.

In the sandbox this is cheap and there is no excuse for failing it: `clearSandbox` and build a
different set, or leave the set standing and move the camera somewhere genuinely different. Changing
the texture pack between two shots of the same set is a legitimate way to make them differ, and it
costs one call.

**Cheap to vary is not licence to search.** Choose the vantages and the palette up front, shoot them,
and stop. A run that works through the texture packs to see which comes out best has turned a
composition decision into a survey: it costs many times the run it replaced and ends with a picture
no better than the first good one, because there was never a right answer to find. Re-shoot a frame
for a **fault** — the list above — and never to learn whether some other arrangement might be
marginally nicer. **The post needs a couple of good-looking images, not the best obtainable ones.**

## Composing the frame

A capture that merely contains the feature is not yet a photograph of it. Two things decide whether a
frame works — **where the camera stands**, and **what fills the frame besides the subject** — and
nearly every bad frame this runner produces fails one of them.

In the sandbox both are settled directly: `setup.camera({x, y, z, atX, atY, atZ})` puts the camera
where the picture wants it, and `setup.stage` / `addBlocks` / `addObject` build what fills the rest of
the frame. That is the whole advantage of shooting there — the composition is a decision rather than
a consequence — so the rules below are worth *more* attention, not less. In a generated room the same
two are settled by `setup.vantage` and `setup.look`, whose numbers are at the end of this section.

### 1. Get close, and come at the subject obliquely

**The thing the shot is about should occupy something like a third to a half of the frame's shorter
side.** A painting that is a postage stamp in the middle of a wall shows a reader nothing, and most
of them are looking at the image on a phone, at a fraction of the size it was captured at.

In the sandbox this is a matter of how far back the camera stands: four to eight units off the
subject is the usual range, and `cameraPose()` reports the distance. Come at it from off to one side
and a little above — a camera on the subject's own axis photographs a flat rectangle, whatever room
is around it. Aim `at` the subject rather than at a point in front of it, because the light the
camera carries reaches as far as it is aimed.

In a generated room the trap is the selection reach. Reaching something across the room means pulling the camera back,
so a script that clicks a distant thing ends up shooting from wherever the reach forced it to stand.
**Pulling back is a way of reaching something, never the view a shot is taken from** — better still,
do not reach across the room at all: `setup.vantage({x, z}, {distance: 4})` stands the player beside
the subject, and the shot is then taken from where it was composed rather than from where the reach
forced it.

An orbit will not go closer than a fraction of its framing distance, and for a block or a picture
that framing distance is deliberately set so the wall around it stays in view. `zoom: 0.8` and up is
where a picture-sized subject reads properly; near 0 it is a speck.

A camera square onto a wall photographs a flat rectangle: the wall's edges stay parallel, nothing
recedes, and the room looks like a painted backdrop. **Come round 30-60 degrees off the surface's
normal, and lift the camera above the subject's own level** (or drop it below) — which is
`setup.swing({azimuthDeg: -50, polarDeg: 65})`, in one call, from whatever view the mode opened at.
Then the wall runs away toward a vanishing point, the floor and ceiling lines converge, and the frame
acquires depth.

Three limits worth knowing before swinging. A canvas has a front and nothing else, so a view from
too far around it is a view of a blank rectangle. Rooms are drawn without their ceilings for the
camera, so past a certain height the frame fills with the black above them. And anything else
standing between the camera and what it is framing is taken out of the room for as long as it
stands there — which, for a subject on the ground floor shot from above, is the storey floor over
it. That is the mode working as intended, but it leaves a hole in the frame, so look at the
resulting image before writing the swing down as the shot's vantage.

### 2. Fill the rest of the frame, and make its parts differ in color

The subject is only part of the picture. What decides whether the rest of the frame reads as a place
is that it holds **several things the eye can tell apart** — and what separates them is color, not
brightness, because brightness is already being spent by distance and by the camera's own light.

In edit mode the camera looks *straight at* the selection, so the subject sits in the middle of the
view whatever the script does; where the subject sits is not a choice. **What is choosable is what
stands around it**, and that is where the composition is won or lost. Pick the vantage from which
each quarter of the frame has something in it — a doorway, another painting, the player's own
character, a wall running away into the distance, a lit stretch of floor.

What to shoot away from: half the frame taken up by one blank wall, a bottom third of empty floor, a
dark unlit void along an edge, and a horizon or a wall edge cutting the frame exactly in half. Rooms
are lit by a light that rides with the camera, so anything far from it goes dark — a subject shot
from close, with its surroundings inside that light, is also the frame that is properly lit.

**Frame something near the end of a wall rather than the middle of it**, so that coming round off the
square-on view opens the room, its doorway and its other pictures into the shot instead of yet more
of the same wall.

**In the sandbox, everything in the frame besides the subject is yours, so build it.** This is the
work a sandbox shot actually consists of, and skipping it is how a set-piece comes out looking like a
grey box with a thing in it. Give the frame three or four things at different depths: a wall behind
the subject and a second one running away to one side, so the room has a corner and a vanishing
point; a picture (`addObject` with a `"Canvas"`) to carry a wall that would otherwise be blank; a
band of another material at the subject's own height, or a floor from the palette's `floor` against
walls from its `wall`, so two or three materials meet inside the frame; a doorway cut into a wall
with `removeBlocks`, which gives the eye somewhere to go beyond the set.

The same applies in a generated room, where the rooms are mostly bare — dressing the stretch of room
a shot will use takes a few edit-mode clicks, and it is usually a feature the post is describing
anyway.

Aim for **moderate contrast, well balanced**: three or four elements differing in color and size,
spread across the frame rather than crowded into its middle. A room dressed until it is busy is as bad
a photograph as a bare one. The test is whether the eye finds the subject in about a second and still
has somewhere else to go afterwards.

This is also what makes a shot carry **height**. A frame containing both storeys only *shows* two
storeys if the eye can separate them, and when the floor below and the floor beyond are the same
blocks in the same palette, the drop between them flattens into one continuous surface — a photograph
of a two-storey room that argues against the thing it was taken for. A warm floor below and a cool one
above, or a patterned storey against a plain one, is what fixes it. Brightness alone will not.

In play mode the camera is first-person, and only half of it is the script's to aim. Turning the
player swings the view left and right, so where the subject sits **across** the frame is a choice —
put it on a third rather than dead center, and let a doorway or a receding wall carry the rest. How
high or low the view points is not: the game decides the pitch itself, and dragging the pointer up
or down walks the player forward and back rather than tilting the camera.

What the game does with the pitch is worth knowing, because it is the only way to aim it:

- **A selection pulls the camera onto it.** While something is picked out in play mode, the view
  tilts toward it and holds there. A shot of something above or below eye level is taken by
  selecting it, not by trying to look up at it. The hold is not indefinite — once the selection
  leaves the frame it is dropped automatically, and the camera returns to its resting pitch.
- **Otherwise the camera reads the ground ahead** and tilts down in proportion to how far it falls
  away over the next few paces. On flat floor that is level; standing at a gallery edge or at the
  top of a flight of stairs it looks down over the drop. So the way to shoot down into a room is to
  walk to somewhere the floor actually falls away.

### The controls, in numbers

In the sandbox the camera is a position and a point it is aimed at, both in world coordinates, so the
numbers that matter are: **4-8 units** back from the subject, **1.5-4 units** up, and off its axis
rather than square onto it. `cameraPose()` reports the distance you actually got.

In a generated room the orbit is set outright rather than dragged to, and these are its numbers:

| | |
| --- | --- |
| `azimuthDeg` | Which way round the subject the camera sits. **30-60 degrees off the surface's normal** is what makes a wall recede instead of reading as a flat backdrop; `setup.swing({azimuthDeg: -50})` comes that far round from wherever the mode opened |
| `polarDeg` | How high the camera is. Around 90 is level with the subject; smaller looks down on it. Past about 40 the frame starts filling with the black above a ceilingless room |
| `zoom` | 0 is as far back as the mode allows, 1 as close as it allows. A picture-sized subject reads properly at 0.8 and up; near 0 it is a speck |

Reaching something across the room still means pulling back, because the selection reach grows with
the orbit distance — but that is a reach, not a frame. Wind back in with `setup.look({zoom})` before
the shot.

## While you are iterating

**Work it out in a session, then write the script.** Editing a whole shot script and re-running it
from boot to find out what one click did costs a full run per guess, and most guesses are wrong the
first time. Instead:

```bash
node dev/scripts/devlog/captureRunner.js --serve &
```

Then send one step at a time. Every response carries the resulting pose, view, selection and game
mode, so the next step is chosen from what the game actually did:

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

For the generated-room case the same session takes `--fresh-room [--room-type=hub] [--devuser=4]`,
and the steps are `standingSpots` / `vantage` / `ensureEditMode` / `clickSurface` / `look` instead.

The ops are the same functions a shot script calls, under the same names, so a sequence that works
transcribes into `run(ctx)` line for line. **Read the JPEGs with the Read tool as you go** — the
runner cannot tell a good frame from a bad one, and neither can the pose.

Note the shell form: `curl -s -X POST http://127.0.0.1:4321/...`. The bare `:4321/...` shorthand
does not work under zsh.

Two more things about iterating:

- Iterate on the script **in place**, in `dev/scripts/devlog/shots/`. The dev server's watcher
  ignores that directory, so writing to it does not restart the server mid-run. Writes elsewhere
  under `dev/` still do.
- `clearSandbox` between shots in one session. Otherwise the second shot is composed against the
  first one's scenery, which is exactly the kind of thing that only shows up in the finished image.
- A run never inherits what the last one built — the sandbox is generated empty each time, and
  `--fresh-room` seeds and removes its room — so `run()` can assume it starts from nothing.

## When something will not click

Both sections below are about the generated-room case. In the sandbox nothing is clicked, and a call
that fails says so in a sentence — "this is not the sandbox room", "cell [row 40, col 3] is outside
the room", "'stone' is not a texture pack. The packs are default, country, garden, aqua, inferno,
prison" — which is generally the whole answer.

Ask the page rather than guessing. `interact.clickObject` and `clickSurface` already say why an aim
failed — "behind the camera", "outside the camera's field of view", "hidden behind something", "out
of reach (12 away)", "covered by div#addDoorButton, which would take the click instead" — and those
sentences are usually the whole answer.

- **A control that is not on screen is usually gated on state.** The commonest case by far: the
  block, canvas and door tools exist only inside edit mode. Call `interact.ensureEditMode()`.
- **A click that selects nothing, from a view where the target is plainly visible,** is the selection
  reach. `interact.call("camera")` reports `maxSelectDistance`; stand closer with `setup.vantage`.
- **A control that is present but does nothing** may be disabled rather than absent —
  `interact.ui.isEnabled(id)` tells them apart.
- `interact.call("probe", x, y)` says what a click at one pixel would meet; `probeGrid` asks the
  same across the whole view in one round trip.
- `describeUI()` lists everything on screen that can be clicked or read, with its position.
- Console errors from the run are printed at the end, and a session returns the ones each step
  provoked.

## Read the room, do not wander it

For the generated-room case. The room's own grid is already in the page, and `setup.standingSpots()` reports it: every place the
player can stand, with its cell and its storey. That answers where the floors are, where the
staircases are (the standable layers *between* the two storey floors) and where a gallery edge is (an
upper-storey cell whose neighbour is floor below and nothing above), without walking a step.

What the grid cannot say is what is *visible* — a cell with a wall standing on it and a cell open to
the storey below look identical in it. That question has one answer, and it is
`interact.call("probe", x, y)`: stand somewhere, look, and see what the ray meets. `shots/second-floor.js`
picks both its staircase and its gallery edge this way, trying candidates until one has a clear view.
