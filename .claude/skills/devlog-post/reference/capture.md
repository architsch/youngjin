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

# Run a shot script, writing into public/devlog-<year>/
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

**Seat 4 is a seeded admin**, and it is the only way to photograph anything admin-only — laying,
moving, labelling or re-wiring a hub's doors, opening a new hub, or the hub settings form. Nothing
in the product ever makes an admin, so a shot script that needs one sets `devUser: 4` and there is
no other route. A member seat standing in the same hub simply does not have the controls, and the
run fails looking for a button that was never rendered.

The session starts in a **hub**, where the identity bar reads "Visitor" but everyone may edit all
the same — hubs are open to anyone standing in them. So a shot of the editing controls needs no
room of one's own, and no travelling to reach one. **Doors are the exception**: editing a room is
not enough to manage them, because a door is a join between rooms rather than a piece of a room's
contents. In a hub they answer to an admin only; in an owned room nobody rearranges them at all.

The tutorial is skipped by default via the browser's tutorial-finished cookie. A post about the
tutorial itself sets `tutorial: true`.

## What a shot script exports

```js
module.exports = {
    slug: "orbit-camera",     // names every file: shot("overview") -> orbit-camera-overview.jpg
    devUser: 1,               // 1-3 members, 4 the admin, or null for a brand-new guest
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
| `clickId(id)` / `clickText(text)` | The UI's buttons are styled `div`s, **not** `<button>` elements, so role-based locators find nothing. Reach them by id where they have one (`editModeButton`, `startEditingButton`, `modeExitButton`, `configureMyRoomButton`, `addVoxelBlockButton`, `removeVoxelBlockButton`, `addCanvasButton`, `changeCanvasImageButton`, `changeCanvasFrameButton`, `chatTextInput`, `chatSendButton`) and by their exact label otherwise. The texture palette is a scrolling strip rather than a button: its id is `voxelQuadTextureOptions`, which is what `shot(label, {selector})` wants when the palette itself is the picture |
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

**Release the pointer away from where it was pressed.** A gesture that returns to its press point
before letting go is not a small turn; it is a click, and the game acts on it as one — selecting
whatever was under it, or walking the player through a doorway into another room entirely. A steering
routine that recentres the pointer "to stop turning" therefore fires a click at the end of every
burst. Stop the turn by releasing where the pointer already is, or by moving it back only part of
the way.

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

**A room stands two storeys tall, and half of it is over the player's head.** Generated rooms —
hubs included — put a floor across the middle of their height, open some spaces through both
storeys as galleries, and join the two with staircases. So a walk that only ever crosses the ground
floor is photographing half the room, and a subject the probe reports as unreachable may simply be
upstairs. Stairs are walked up the same way as flat ground, with the held walk key; the player
climbs them by himself, there being no jump. The upper storey is the better vantage for a shot of
the room as a whole, since a gallery edge is somewhere the first-person camera tilts down of its
own accord.

**Climbing looks exactly like being stuck.** Going up a flight, the player advances a fraction of
the distance per second that he covers on the flat, because he is gaining height with every step. To
anything watching his position that is indistinguishable from walking into a wall, so a script that
detects a stall and turns aside to get around it will steer him off the side of the staircase every
time. Any such detour logic has to be suspended for the length of a climb.

A single click on the world raycasts into it: that is what selects a block, an object or a
doorway. Which controls appear depends on what was hit — a wall face offers the block tools and
the texture palette, a picture offers the canvas tools — so a script that assumes one and lands
on the other will fail looking for a button.

**A door is the one thing a click does not merely select.** To anybody but an admin, clicking a door
he is standing next to is a journey: the client leaves for the destination room, and the next shot is
of somewhere else entirely. Only on the admin seat does the click take hold of the door instead — and
it enters edit mode along with the selection, which is where `changeDoorLabelButton`,
`changeDoorDestinationButton`, `customizeDoorButton`, `doorSettingsButton` and `enterDoorButton`
appear. `addDoorButton` sits with the block tools on a selected wall face, admin-only and in a hub
only.

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

**The set has to vary, and that is a separate judgement from whether each frame is good.** A group of
shots can pass every rule below individually and still fail together, because the reader meets them
at once: three frames of the same subject, at the same distance, from the same height, differing only
in which controls happen to be open, read as one picture printed three times. So choose the vantages
before shooting any of them and make them differ **in kind** — from the storey above over a gallery
edge; through an opening, so a doorway frames the shot and the room has depth beyond it; close and
oblique at the subject's own level, where its material reads; from across an open space with the room
around it. Two kinds is the minimum and three is better; the same walk-up shot at three zoom levels
is not variety. Lay the finished images side by side and ask whether they look like three views of a
place or one view taken three times.

## Composing the frame

A capture that merely contains the feature is not yet a photograph of it. Two things decide whether a
frame works — **where the camera stands**, and **what fills the frame besides the subject** — and
nearly every bad frame this runner produces fails one of them. Both have their fix in the camera
controls at the end of this section.

### 1. Get close, and come at the subject obliquely

**The thing the shot is about should occupy something like a third to a half of the frame's shorter
side.** A painting that is a postage stamp in the middle of a wall shows a reader nothing, and most
of them are looking at the image on a phone, at a fraction of the size it was captured at.

The trap is the selection reach. Reaching something across the room means pulling the camera back,
so a script that clicks a distant thing ends up shooting from wherever the reach forced it to stand.
**Pulling back is a way of reaching something, never the view a shot is taken from** — wheel back in
once the selection has landed, and take the shot from there.

An orbit will not go closer than about two fifths of its framing distance, and for a block or a
picture that framing distance is deliberately set so the wall around it stays in view. Near the
close end of that range is where a picture-sized subject reads properly; anywhere near the far end
it is a speck.

A camera square onto a wall photographs a flat rectangle: the wall's edges stay parallel, nothing
recedes, and the room looks like a painted backdrop. **Come round 30-60 degrees off the surface's
normal, and lift the camera above the subject's own level** (or drop it below). Then the wall runs
away toward a vanishing point, the floor and ceiling lines converge, and the frame acquires depth.

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

**Where the room does not supply the contrast, build it.** Generated rooms are mostly bare, and a bare
room photographs as a flat expanse of one repeated block whatever the camera does — but dressing the
stretch of room a shot will use takes a few edit-mode clicks, and it is a feature the post is
describing anyway. Hang a picture on a bare wall; stand a few decorative blocks near the subject, so
the frame holds an object at a different depth from the wall behind it; retexture a floor or run a
band of another material at the subject's own height, so two or three materials meet inside the frame;
put a second door or another picture further along the wall to carry a corner that would otherwise be
blank. Choosing a different room instead is the cheaper option when the room is being picked anyway.

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

| Gesture | What it does |
| --- | --- |
| Horizontal drag | Swings the orbit. About 960 px of travel is a full turn, so ~120 px is 45 degrees. Dragging right carries the camera one way around, left the other |
| Vertical drag | Raises and lowers the camera. Dragging the pointer **down** lifts the camera above the subject; dragging up drops it below. Clamped short of straight above and below |
| `page.mouse.wheel(0, -100)` | One notch **closer**. Negative is closer, positive is further — the sign is easy to get backwards, and getting it backwards is what produces a tiny subject |
| `page.mouse.wheel(0, +100)` | One notch further away |

The whole zoom range runs from about two fifths of the framing distance to twice it, which is
roughly a dozen notches end to end, with the framing distance itself in the middle. **Do not count
notches from a presumed middle**: edit mode opens at whatever distance the camera already stood
from what it is now framing, so an orbit that begins on something across the room begins near the
far end. Read the on-screen zoom slider instead — it shows where in the range the camera currently
is, and a handle sitting at the left of it, in a shot that was supposed to be close, is the sign
that the wheel went the wrong way.

## While you are iterating

- Iterate on the script **in place**, in `dev/scripts/devlog/shots/`. The dev server's watcher
  ignores that directory, so writing to it no longer restarts the server mid-run. Writes elsewhere
  under `dev/` still do, so keep any throwaway helper out of the watched part of the tree.
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

## Read the room's plan instead of hunting for it

Wandering a generated room to find where its staircase or its gallery stands is the most expensive
way to answer the question, and the answer is written down. The room's saved grid sits in the
storage emulator at `rooms/<roomID>/content.bin`, and it can simply be fetched:

```
curl -H "Authorization: Bearer owner" \
  "http://127.0.0.1:9199/v0/b/thingspool.firebasestorage.app/o/rooms%2F<roomID>%2Fcontent.bin?alt=media"
```

Decoding the per-cell collision-layer mask out of it takes a few dozen lines — the format is in
`@src/shared/voxel/types/voxelGrid.ts` — and it gives exact coordinates for every staircase, every
space open through both storeys, and every solid wall. Write the route from those coordinates rather
than steering by what the camera happens to show.

**Do not navigate by timing.** The headless renderer's frame rate varies by more than tenfold
between runs and within a single run, while the client clamps its own frame time, so the same held
key covers a wildly different distance each time and a route tuned by stopwatch works once and never
again. Drive in a closed loop instead: the client reports its own transform over the socket
(`setObjectTransformSignal`), so a script can watch its actual position and heading and stop when it
has arrived. `dev/scripts/devlog/shots/nav.js` already does this and is the thing to reuse.
