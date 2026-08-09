# Capturing the screenshots

`dev/scripts/devlog/captureRunner.js` boots a Chromium session against the local dev server, signs
in, waits until the game is actually standing in a room, and then hands control to a **shot
script** — a small module under `dev/scripts/devlog/shots/` that walks the game through whatever
the feature needs in order to be seen.

Shot scripts are kept in the repo alongside the posts they produced, so a post's images can be
taken again after the feature has moved on.

## Running it

```bash
# Boot and dump the screen — what is clickable, where it is. No shot script needed.
node dev/scripts/devlog/captureRunner.js --probe

# Run a shot script, writing into public/devlog-2026/
node dev/scripts/devlog/captureRunner.js dev/scripts/devlog/shots/<slug>.js

# Same, but keep the output out of public/ while iterating
node dev/scripts/devlog/captureRunner.js dev/scripts/devlog/shots/<slug>.js --out=test-results/devlog-probe

# Watch it happen in a real window (useful when a gesture is not landing)
node dev/scripts/devlog/captureRunner.js dev/scripts/devlog/shots/<slug>.js --headed
```

The runner never starts a dev server; it fails immediately with instructions if none answers.

By default it plays as **seeded dev member 1** (`?devuser=1`), which only exists in dev mode. That
account owns a room, may edit rooms, and keeps whatever first-time prompts it has already
dismissed — so consecutive runs capture the same game rather than a stranger's first visit. A
fresh guest (`devUser: null`) is right only for a post about what a new player meets.

The tutorial is skipped by default via the browser's tutorial-finished cookie. A post about the
tutorial itself sets `tutorial: true`.

## What a shot script exports

```js
module.exports = {
    slug: "orbit-camera",     // names every file: shot("overview") -> orbit-camera-overview.jpg
    devUser: 1,               // 1-3, or null for a brand-new guest
    startPath: "/",           // or "/<roomID>" to open one room directly
    tutorial: false,          // true only for a post about the tutorial
    // viewport: { width: 1280, height: 800 },
    // hideDebugUI: true,     // hides the in-game debugger; leave on
    // dismissPopups: true,   // clears any welcome popup before run() starts
    async run(ctx) { /* ... */ },
};
```

## What `run(ctx)` is given

| | |
| --- | --- |
| `shot(label, opts?)` | Settles the frame, then writes `<slug>-<label>.jpg`. `opts.selector` shoots one element; `opts.settleMs` waits longer first |
| `drag(from, to, opts?)` | A pointer drag across the world. Moves in many small steps, because the game reads a drag as a gesture, not a jump |
| `clickAt(point, opts?)` | A tap on the world: selects a block, an object, a doorway |
| `clickId(id)` / `clickText(text)` | The UI's buttons are styled `div`s, **not** `<button>` elements, so role-based locators find nothing. Reach them by id where they have one (`modeExitButton`, `configureMyRoomButton`, `customizePlayerButton`, `addVoxelBlockButton`, `removeVoxelBlockButton`, `addCanvasButton`, `changeCanvasImageButton`, `changeCanvasFrameButton`, `chatTextInput`, `chatSendButton`) and by their exact label otherwise |
| `press(key)` / `hold(key, ms)` | A keystroke, or a key held down — how the player is walked somewhere |
| `center()` | The middle of the viewport, the usual anchor for a drag |
| `describeUI()` | Everything currently visible that can be clicked or read, with its position |
| `dismissPopups()` / `hideDebugUI()` | Both already done before `run()` starts; call again after something reopens one |
| `sleep(ms)`, `page`, `log()` | The raw Playwright `Page` is there for anything the helpers do not cover |

## How the game is driven

Dragging on the world is the game's primary gesture, and it means different things depending on
what is going on. In ordinary play it is a **joystick**: what steers the player is the offset the
pointer is *held* at, not the distance it travelled, so a quick flick across the screen barely
turns at all. A turn is a press, a move away from the press point, and then a wait — the ctx
helper's `drag` releases too soon to be one, so hold the pointer yourself through `ctx.page.mouse`
when the shot needs the view brought round.

With something selected, the same drag orbits the camera around the selection instead, following
the pointer 1:1, and the mouse wheel scales the view around it. That is the only way to see
anything from outside itself: **the default camera is first-person**, sitting at the player's eye
with the player's own body hidden, so a script that never selects anything can only ever
photograph a wall. Selecting a block or a picture is what pulls the camera back and makes a shot
of a room — or of the room's editing controls — possible at all. (The user's own character is
visible in one orbit only: the one the character-customization UI puts the camera into.)

The arrow keys and WASD also walk the player, which is the steadier way to cover ground without
turning. They are ignored while a text field has focus.

A single click on the world raycasts into it: that is what selects a block, an object or a
doorway, and what puts the editing controls on screen. Which controls appear depends on what was
hit — a wall face offers the block tools and the texture palette, a picture offers the canvas
tools — so a script that assumes one and lands on the other will fail looking for a button.

## Making the shots worth publishing

Most people who meet the post will look at the picture and read at most a line of it, so the images
carry more of the invitation than the prose does. A frame that shows something worth walking into
is doing the post's main job.

- **Look at every image with the Read tool.** The runner cannot tell a good frame from a bad one.
  Re-shoot anything showing a loading indicator, a room whose meshes have not all arrived, an open
  debugger, an empty canvas, or a camera pointed away from the thing the post is about.
- Move the camera before shooting. The default spawn view is the same in every post; an angle
  chosen for the feature is what makes the images look like they were taken on purpose.
- Show the feature in use, not merely the menu that opens it. Where something changes state, a
  before/after pair says more than either half.
- Give shots labels that describe what is in them (`overview`, `palette`, `before`, `after`), not
  their order.
- Keep 2-4 per post.

## While you are iterating

- Keep the half-finished script **outside the repo** — in the scratchpad directory — and point the
  runner at it there. The dev server watches its own files and restarts on every write under
  `dev/`, costing a wait each time. Copy it into `dev/scripts/devlog/shots/` once it works, and run
  it once more from there.
- Rooms are saved, so a run inherits whatever the last one did: a picture hung by an earlier
  attempt is still on the wall, and clicking where a bare wall used to be now selects that picture.
  Write `run()` so it tolerates what it finds rather than assuming a fresh room.

## When something will not click

- Check `describeUI()` output for the element's real position, then use `clickAt` with those
  coordinates rather than fighting a locator.
- A drag that does nothing is usually too short: the game ignores travel under a few pixels, so it
  cannot tell a slightly sloppy tap from a drag.
- A control that is not on screen is usually gated on state — the game hides editing controls
  unless the player may edit the room they are in, and hides the top bar entirely while a selection
  or a form is open.
- Console errors from the run are printed at the end. A capture that looks wrong often explains
  itself there.
