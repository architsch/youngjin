---
name: image-upscale-remap
description: Prepare pictures of things so they read as flat pictures on a flat surface (what a prop or a canvas shows) — cut a thing out of a photo and make everything else transparent, by a model that tells the thing's own pixels from the rest (Segment Anything 2) and never by color, enlarge one smaller than 512 px or redraw a soft one crisp (Real-ESRGAN), square up a face photographed at an angle to its true proportions, make something round seen at an angle round again, paint out a part that stands up from the face with the surface around it (a faucet off a sink's rim), and keep one part alone when asked, all through the picture preparation tool (npm run imagePrep), which writes finished PNGs no larger than 512 x 512 px and nothing into the picture map. Use when the user hands over image files (photos, or their own pictures already cut out) and asks to remove, erase or make transparent the background of them, to cut out, isolate or keep only one object in them, to upscale, enlarge, sharpen or raise the resolution of them, to shrink ones that are too large, to straighten, flatten, un-skew, re-map or reshape them, to fix their perspective, to erase, remove or paint out a part that sticks out, or to make them fit a flat surface, and before sampling a picture seen steeply into the picture map with image-map-sampling.
---

# Image Upscale and Remap

The game shows a picture on a flat quad: one thing, seen head-on, with nothing of its photo around it. A photo
gives neither. The thing stands among others, and seen at an angle it looks wrong on a quad: a sink photographed
from the front lies on a counter as a trapezoid. This skill cuts the thing out of its photo, re-maps it to what a
head-on view would show, and enlarges or sharpens the ones that need it, with the picture preparation tool
(`dev/scripts/imagePrep`; see its `prep.js` for the commands and `core/prepOrder.ts` for what an order may ask).
The image map editor's own `corners` straightens a face too, but takes its shape from the quad's sides, so
anything seen steeply comes out squashed front to back there. Prepare it here first.

## Hard rules

- **The tool writes under `temp/image_prep/` and nowhere else, and a result leaves it only when the user asks**:
  into the picture map (the editor's Sources tab takes a file; `image-map-sampling` covers the rest), or beside
  its source when they ask for the file itself to be turned into the result ("turn this file into a .png"). Move
  the result there under the source's name, and leave the source as it is. Never over the user's files.
- **No result is larger than 512 x 512 px.** The tool fits whatever comes out bigger within that, keeping its
  shape, and refuses a `maxSide` above it. That is the size the user keeps finished pictures at, twice the
  largest image a prop shows (`image-map-sampling` has the scale). Left at four times its source, an upscale is
  megabytes of file that nothing ever shows.
- **`temp/image_prep/out/` is the user's folder too.** They keep finished pictures of their own there beside the
  results, and move results out of it. List it before planning, and name each result after its source and what
  was done (`food_fish_squared`, `basin_upscaled_no_faucet`), never as a file already there. The tool refuses to
  replace a file it didn't write, or one changed since it wrote it; give the order another name, don't remove
  the file. A second version of a picture is a new name beside the first. When the user asks for one of their
  own pictures there to be redone in place (made smaller, say), move it to `temp/image_prep/originals/` and run
  an order on it from there under its own name, so the original stays whole.
- **Only pictures whose terms are known**: the user's own, or ones under a license the picture map accepts
  (`.claude/rules/license-files.md`). Preparing a picture doesn't change whose it is.
- **Say what was invented or guessed.** An upscale draws in detail the picture never held: lettering comes out
  as made-up glyphs, and fine patterns are redrawn. A part painted over shows surface that was never
  photographed there. A cut-out's edge is the model's judgement, and a guess wherever the thing and what lies
  behind it look alike. Report each wherever it shows.

## Cutting a thing out

`cutOut` names the things an order keeps. Everything else goes see-through, and the result is trimmed to them.
A model (Segment Anything 2) is shown each thing by a rect around it and points on it, and tells its pixels from
the rest by what the thing is, so a busy background, or one of the thing's own color, is no harder than a plain
one. Never cut a thing out by color here (the image map editor's `background` flood fill does that, for a plain
backdrop).

- **One part for each thing the eye takes as one**: a machine with its handle and wand; each stack of cups and
  the cloth under them as seven parts, not one rect around the lot. The model looks at each part again up close,
  so its edge comes out several times finer, and parts that touch are joined.
- **A rect close around the thing, and a point `on` each stretch of it that looks unlike the rest** (a cup's dark
  side and its white rims; a machine's panel, its tray, its wand). Read them off a survey of that part alone: on
  the whole picture a thin thing is misplaced by more than its own thickness, and a strip of cloth got its points
  on the rims above it.
- **It is wrong at both ends, and a point each mends it.** It leaves out a stretch that looks unlike the rest
  (the rims in shadow at a stack's foot): put a point `on` it. It takes in something of the same look beside the
  thing (the machine's dark rail, along with a cloth lying on it): put a point `off` it. Something in front of
  the thing that is to go is a part of its own with `"drop": true`, after the part it is taken out of.
- **Each part's line gives the model's score for it, up to 1, and the share of it that is faint.** Under 0.9, or
  more than a tenth faint, is a part the model was unsure of: look at it up close before trusting it.
- **It keeps or drops each pixel whole**, so it finds things with an outline: not hair, fur or smoke, nothing
  seen through glass, and nothing much thinner than a hundredth of the thing. Say so, and leave it.

The first cut-out fetches ONNX Runtime (MIT, about 115 MB) and the model (Apache-2.0, about 910 MB) into
`temp/image_prep/tools`; tell the user when that happened. A part takes some ten seconds the first time. Its mask
is kept, so a plan run again asks the model only for the parts that changed.

## What re-mapping can do

- **One flat face can be squared, and everything in planes parallel to it** (a sink's rim, and its drain below).
  Whatever stands up from that face leans away and stretches: a faucet behind a sink ends up lying on its back.
  **Paint it over with the surface around it (`cover`), so the thing keeps its whole outline.** Cut the picture
  down to one part (`keep`) only when the user asks for that part alone.
- **Something round seen at an angle is made round** by stretching across its short axis. A handle or a spout
  shears a little with it.
- **A thing with no flat face can't be flattened** (a shower head seen from below). Say so, and leave it.
- A picture already seen head-on needs none of this.

## When to upscale

Upscaling redraws a picture at four times its size, and the result is then fitted within 512 px like any other.
What that gives depends on the size the picture has:

- **Longer side well under 512 px: upscale it.** It comes out at 512 px (or what re-mapping leaves of that),
  crisper than a plain enlargement would be.
- **Already 512 px or more: it comes out no larger, only redrawn**, its noise gone and its soft edges crisp. That
  helps a soft or noisy picture (blurred coil burners came out sharp at their own size) and does nothing for a
  sharp one. A face seen steeply gains too, since squaring stretches its far side.

The detail it draws is the model's guess, not the picture's (see "Say what was invented or guessed"): blur is
redrawn, not recovered. When in doubt, run the order twice under two names, with and without `upscale`, and keep
the plain one unless the other is visibly better, on the contact sheet at the game's size and on a survey of
each at its own. The first upscale fetches Real-ESRGAN (BSD-3-Clause, about 50 MB, macOS) into
`temp/image_prep/tools`; tell the user when that happened.

## Steps

1. **Survey.**
   `npm run imagePrep -- --survey <file> ...` draws each picture at 1600 px with a grid in fractions of it, to
   `temp/image_prep/survey/`. Magenta is what is see-through. Read each one. A whole picture is too coarse to
   read corners or a small round thing off: survey that part alone (the grid keeps the whole picture's fractions):
   `npm run imagePrep -- --survey <file>:x,y,w,h`
   A survey hides what is faint. On a pale or even surface, read the brightness out in numbers, whole or part:
   `npm run imagePrep -- --shades <file>:x,y,w,h` prints a table of cells. A soft shadow that looks like
   nothing on a white ledge can be forty levels deep, and its reach is what sets a painted part's edges.
2. **Plan** the orders in `temp/image_prep/plans/<name>.json`. Paths are from the repository's root.
   ```json
   [
     {"source": "img_temp/cups.jpg", "name": "cups_cut_out",
      "cutOut": [{"rect": [0.265, 0.171, 0.125, 0.157], "on": [[0.325, 0.218], [0.325, 0.301]]},
                 {"rect": [0.370, 0.156, 0.077, 0.169], "on": [[0.405, 0.198], [0.400, 0.323]], "off": [[0.325, 0.250]]},
                 {"rect": [0.130, 0.3235, 0.646, 0.010], "on": [[0.300, 0.329], [0.620, 0.328]], "off": [[0.160, 0.326]]}]},
     {"source": "img_temp/sink.png",
      "square": {"sides": {"left": [[0.40, 0.90]], "right": [[0.50, 0.88]], "top": [[0.20, 0.38]], "bottom": [[0.10, 0.90]]},
                 "circle": [[0.407, 0.762], [0.580, 0.760], [0.498, 0.665], [0.497, 0.866], [0.44, 0.682], [0.56, 0.831]]},
      "cover": [{"shape": "rect", "rect": [0.335, -0.03, 0.175, 0.108], "radius": 0.3, "from": [0.545, -0.03]},
                {"shape": "rect", "rect": [0.803, -0.06, 0.227, 0.2645], "radius": 0.38, "from": "mirror"}]},
     {"source": "img_temp/basin.png", "tidy": true, "upscale": true,
      "square": {"corners": [[0.160, 0.236], [0.939, 0.249], [0.998, 0.934], [0.036, 0.928]], "aspect": 1.07},
      "cover": [{"shape": "rect", "rect": [0.365, -0.05, 0.255, 0.337], "from": "across"}]},
     {"source": "img_temp/pan.png",
      "round": {"outline": [[0.47, 0.228], [0.20, 0.325], [0.016, 0.63], [0.30, 0.877], [0.55, 0.80], [0.752, 0.47]],
                "turn": -3}}
   ]
   ```
   - `cutOut` takes the parts kept, each in turn: a `rect` (x, y, width, height), points `on` the thing, points
     `off` it, and `drop` (see "Cutting a thing out"), in fractions of the source picture. **Every step after it
     is placed on the cut-out as trimmed**: run the order with `cutOut` alone, survey the result, then add them.
   - `square` takes the face's `corners` (top-left, top-right, bottom-right, bottom-left, which may lie off the
     picture), or, for a cut-out whose outline is the face's own edge, its `sides`: the stretches of each side
     where the outline runs straight, clear of rounded corners and of whatever stands in front. The tool fits a
     line to each and prints the corners it found, which is far closer than reading rounded corners by eye.
   - **The face's shape can't be read off a steep view**, so give it: its `aspect` (width over height) where the
     real size is known, or else a `circle`, five or more points spread around the outline of something round in
     the face's plane or parallel to it (a drain, a burner, a plate, a knob's base). The tool prints the shape it
     came to beside what the sides alone say. With neither it uses the sides, which holds only nearly head-on.
   - `extend` keeps room past the face's left, top, right and bottom, each as a share of the face.
   - `round` takes five or more points spread around the round thing's `outline`, and a `turn` in degrees
     clockwise for the result.
   - `cover` paints parts over, each in turn: a `rect` (x, y, width, height; corners rounded by `radius`, a
     fraction of its shorter side) or an `ellipse`, with the surface it gets named by `from`. **Its positions,
     like `keep`'s, are fractions of the re-mapped picture**, so run the order without it, survey the result
     (each part up close), then add it and run again.
     - **A surface with grain (metal, wood, stone) is copied.** `"from": "mirror"` brings the same place across
       the picture's upright middle line, flipped: the other side of something symmetric, which rebuilds a corner
       or an edge the thing hid. `"from": [x, y]` brings a region of the same size from elsewhere: a clean
       stretch of the same surface, taken along the way its lines run, so they carry on through the part. Either
       is shaded to match where it lands. A copied line only meets its own end where it runs straight: across a
       curved edge it steps, so keep the part off that edge.
     - **A plain surface (glazed ceramic, paint, plastic) is run across.** `"from": "across"` paints each row
       with the surface just outside the part's left and right edges, from the one to the other (`"down"`: each
       column, from above and below). Whatever runs that way carries on wherever it lies on each side, a curved
       edge included, so the part may cross it. Grain is lost, which a plain surface doesn't show.
     - **Set the part a little wider than the thing, with its edge on clean surface.** The new surface fades in
       over a narrow band inside the edge, and takes its shade from what lies just outside it. An edge that
       touches the thing leaves a ghost of it; one that runs along a bright rim or another object shades the
       part wrongly. Where the thing runs off the picture, let the rect run off it too.
     - **The thing's shadow goes with it.** A faint one may stay beside a copied part, which darkens toward it
       and reads as shading. A deep one is left hanging with nothing to cast it: widen the part until its edge
       lies past the shadow's reach (`--shades` shows where). A stain the mirror brought along is covered by a
       later part, from clean surface beside it.
   - `keep` cuts the result to one part, shaped as a `cover` part is. Set it a hair inside the part's edge, so
     no sliver of what was removed shows.
   - `tidy` drops the specks a rough cut-out left (every piece of some size stays); `upscale` redraws it at four
     times its size, before the re-mapping; `maxSide` asks for a result smaller than 512 px; `name` is the
     result's file name.
3. **Run.**
   `npm run imagePrep -- --run temp/image_prep/plans/<name>.json`
   Each result is fitted within 512 px and written to `temp/image_prep/out/<name>.png`, what the tool found is
   printed, and `temp/image_prep/contact_sheet.png` shows every source beside its result, fitted into 256 px (a
   prop's largest image) and drawn at twice that. Read the sheet, then fix the orders and run again until each
   holds up: nothing of the background kept and nothing of the thing cut away, round things round, straight
   edges square to the frame, nothing left of a part covered or removed and no step in shade along its edge, no
   fringe along a cut-out's edge. Upscales are kept, so a second run is quick.
   **A cut-out is also drawn over its source**, which is where its misses show and where the next points are
   read off: `temp/image_prep/survey/<name>_cut_out.jpg` has what was kept in its own colors and what was cut
   away under magenta, with each part's rect and points numbered, and `temp/image_prep/cut_out/<name>.jpg` is
   the whole of that to survey parts of up close, its grid still in the source's fractions. Go along every edge
   that way: what shows in its own colors and isn't the thing gets a point `off`, what lies under magenta and is
   the thing a point `on`.
   **Check a result's edges on a survey of it, not by opening the PNG**: an image viewer shows the colors left
   under its transparency, so parts that were cut away look as if they were still there.
4. **Report** to the user: each result (path, size, what was done to it), which figures were estimates (a shape
   taken from a small or blurry circle, a real size guessed), what a cut-out kept and left out, the parts the
   model was unsure of and the edges that are guesses, what was painted over and with what, what couldn't be
   flattened or cut out and why, what an upscale invented and which results came out no larger than their
   source, and whether the upscaler or the model was fetched. Adding the results to the picture map is theirs to
   ask for.
