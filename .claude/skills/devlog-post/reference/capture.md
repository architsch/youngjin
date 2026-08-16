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
account keeps whatever first-time prompts it has already dismissed, so consecutive runs capture the
same game rather than a stranger's first visit. A fresh guest (`devUser: null`) is right only for a
post about what a new player meets.

The session starts in a **hub**, where the identity bar reads "Visitor" but everyone may edit all
the same — hubs are open to anyone standing in them. So a shot of the editing controls needs no
room of one's own, and no travelling to reach one.

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
| `clickId(id)` / `clickText(text)` | The UI's buttons are styled `div`s, **not** `<button>` elements, so role-based locators find nothing. Reach them by id where they have one (`editModeButton`, `modeExitButton`, `configureMyRoomButton`, `customizePlayerButton`, `addVoxelBlockButton`, `removeVoxelBlockButton`, `addCanvasButton`, `changeCanvasImageButton`, `changeCanvasFrameButton`, `chatTextInput`, `chatSendButton`) and by their exact label otherwise |
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

Inside edit mode, the same drag orbits the camera around whatever is selected, following the
pointer 1:1, and the mouse wheel scales the view around it. That is the only way to see anything
from outside itself: **the default camera is first-person**, sitting at the player's eye with the
player's own body hidden, so a script that never enters edit mode can only ever photograph a wall.

The arrow keys and WASD also walk the player, which is the steadier way to cover ground without
turning. They are ignored while a text field has focus.

**The player covers ground slowly, and a walk that looks like plenty is not.** A few seconds of a
held walk key moves him about a pace: crossing an ordinary room takes something closer to fifteen
or twenty seconds of it, split into several `hold` calls. This is the single likeliest reason a
subject is too far away — the script meant to walk up to a wall, walked a fraction of the way, and
photographed the room from where it happened to stop. Where a walk *ends* is worth checking with a
frame before any coordinate is written down against it.

A single click on the world raycasts into it: that is what selects a block, an object or a
doorway. Which controls appear depends on what was hit — a wall face offers the block tools and
the texture palette, a picture offers the canvas tools — so a script that assumes one and lands
on the other will fail looking for a button.

### Edit mode is what a shot of the room needs

A click on its own is not an edit any more (see `docs/gameplay/game_mode.md`). In play mode it
selects the thing and says what it is — a picture's title and author, and nothing else — while the
camera stays at the player's eye. The orbit, the editing controls and the character-customization
strip all belong to **edit mode**, which a script enters by clicking `editModeButton`. Four
consequences, each of which will otherwise cost a run:

- **The way in disappears while anything is selected.** `editModeButton` lives on the identity bar,
  which steps aside for the mode menu the moment a selection is up. Give the selection up first
  (`modeExitButton`) and the button comes back.
- **Edit mode opens on the player's own character**, not on whatever the script wanted. Selecting
  something else is a second click, after the mode is up.
- **How far the user may reach into the room grows with how far the orbit has been pulled back.**
  Something across the room can be plainly visible and still out of reach at the mode's opening
  distance, and answer no click at all. Wheel the camera back before clicking anything distant —
  and then wheel it back in before shooting, because that pulled-back view is a reach, not a frame.
- **The orbit's angle and zoom carry over** into the next selection and across leaving and
  re-entering the mode. A click point that worked from one view is wrong from another, so a shot
  that leaves the view somewhere new should put it back — swing and wheel the same amounts in
  reverse — before the next shot relies on a fixed coordinate.

A miss is what makes this bite: a click meant for a picture that lands on the wall behind it
selects that wall and swings the orbit onto it, so the retry is aiming from a view the first
attempt moved. Prefer a starting position the game itself pins down — walking the player into a
wall until he stops leaves him somewhere that does not vary between runs, where a timed walk
across open floor does.

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

## Composing the frame

A capture that merely contains the feature is not yet a photograph of it. Three faults account for
almost every bad frame this runner produces, and each has a fix in the camera controls below.

### 1. Fill the frame with the subject

**The thing the shot is about should occupy something like a third to a half of the frame's shorter
side.** A painting that is a postage stamp in the middle of a wall shows a reader nothing, and most
of them are looking at the image on a phone, at a fraction of the size it was captured at.

The trap is the selection reach. Reaching something across the room means pulling the camera back,
so a script that clicks a distant thing ends up shooting from wherever the reach forced it to stand.
**Pulling back is a way of reaching something, never the view a shot is taken from** — wheel back in
once the selection has landed, and take the shot from there.

An orbit will not go closer than half its framing distance, and for a block or a picture that
framing distance is deliberately set so the wall around it stays in view. Near the close end of that
range is where a picture-sized subject reads properly; anywhere near the far end it is a speck.

### 2. Face the subject from an oblique angle

A camera square onto a wall photographs a flat rectangle: the wall's edges stay parallel, nothing
recedes, and the room looks like a painted backdrop. **Come round 30-60 degrees off the surface's
normal, and lift the camera above the subject's own level** (or drop it below). Then the wall runs
away toward a vanishing point, the floor and ceiling lines converge, and the frame acquires depth.

Two limits worth knowing before swinging. A canvas has a front and nothing else, so a view from too
far around it is a view of a blank rectangle. And rooms are drawn without their ceilings for the
camera, so past a certain height the frame fills with the black above them.

### 3. Balance the whole frame, not just the middle

In edit mode the camera looks *straight at* the selection, so the subject sits in the middle of the
view whatever the script does; where the subject sits is not a choice. **What is choosable is what
stands around it**, and that is where the composition is won or lost. Pick the vantage from which
each quarter of the frame has something in it — a doorway, another painting, the player's own
character, a wall running away into the distance, a lit stretch of floor.

What to shoot away from: half the frame taken up by one blank wall, a bottom third of empty floor, a
dark unlit void along an edge, and a horizon or a wall edge cutting the frame exactly in half. Rooms
are lit by a light that rides with the camera, so anything far from it goes dark — a subject shot
from close, with its surroundings inside that light, is also the frame that is properly lit.

Two habits do most of the work here. **Frame something near the end of a wall rather than the middle
of it**, so that coming round off the square-on view opens the room, its doorway and its other
pictures into the shot instead of yet more of the same wall. And when the stretch of wall the player
has reached is bare, **hang a picture on it** rather than photographing something across the room:
the nearest surface gives the largest subject, and hanging one is a feature the post is describing
anyway.

In play mode the camera is first-person and steering points it anywhere, so there the frame is free
to be composed outright. Use it: put the subject on a third rather than dead center, and let a
doorway or a receding wall carry the rest.

### The controls, in numbers

| Gesture | What it does |
| --- | --- |
| Horizontal drag | Swings the orbit. About 960 px of travel is a full turn, so ~120 px is 45 degrees. Dragging right carries the camera one way around, left the other |
| Vertical drag | Raises and lowers the camera. Dragging the pointer **down** lifts the camera above the subject; dragging up drops it below. Clamped short of straight above and below |
| `page.mouse.wheel(0, -100)` | One notch **closer**. Negative is closer, positive is further — the sign is easy to get backwards, and getting it backwards is what produces a tiny subject |
| `page.mouse.wheel(0, +100)` | One notch further away |

The whole zoom range is about ten notches wide, running from half the framing distance to twice it,
so five notches from where an orbit opens reaches either end. The on-screen zoom slider shows where
in that range the camera currently is: a handle sitting at the left of it, in a shot that was
supposed to be close, is the sign that the wheel went the wrong way.

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
- A control that is not on screen is usually gated on state — the editing controls belong to edit
  mode and to a room the player may edit, and the identity bar gives the top corner up to the mode
  menu while a selection or a form is open.
- A click on the world that selects nothing at all, from a view where the target is plainly
  visible, is the selection reach: pull the orbit further back and try again.
- Console errors from the run are printed at the end. A capture that looks wrong often explains
  itself there.
