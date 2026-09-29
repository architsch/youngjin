---
name: image-map-sampling
description: Turn a list of source photo URLs (usually Unsplash pages) into picture map entries (the everyday objects props show, or paintings for canvases) — add the photos to the image map editor's source library, survey each one with a grid, plan samples that read well as flat pictures at the game's scale, cut them out of their backgrounds, straighten, retouch and color-correct them, write the keywords a search finds each by (its categories first, the kinds of place it belongs in, then its kind), and save them as disabled entries for the user to review. Use when the user hands over image URLs to be sampled into the picture map.
---

# Image Map Sampling

Turns photos into entries of the picture map (`public/app/assets/pictures/manifest.json`) through the
image map editor's own pipeline (`dev/scripts/imageMapEditor`, see its `server.js` for every command). This skill
only proposes entries: **the user reviews each one and enables what they keep.**

## Hard rules

- **Every entry made here is disabled.** `--save-samples` saves it so, every time. Never enable an entry, and
  never touch one this batch didn't make, unless the user asks.
- **Never delete or renumber an entry.** A stored canvas or prop names its image by path, so a path is never reused.
- **Only photos whose terms are on offer** (`IMAGE_LICENSES` in `dev/scripts/imageMapEditor/core/imageLicenses.ts`;
  on Unsplash, the free photos). A download Unsplash refuses (403, an Unsplash+ photo) is skipped and reported,
  never swapped for a lookalike.
- The photos themselves are gitignored (only `dev/assets/picture_sources/index.json` is committed); an
  entry's sample and parked game image are committed with it. `THIRD-PARTY-NOTICES.md` lists only enabled
  entries, and the editor rewrites that table itself.
- Changes under `src/` (the click map) go through Edit, never a script.

## Scale

**1 world unit = 40 cm = 256 px** (two 128 px atlas cells). An everyday object (the Objects tab, subfolder `2`, shown
by a prop) keeps its scale, at one of three sizes:

| `cells` | World units | Real size shown |
|---|---|---|
| `[2, 2]` | 1 × 1 | 40 × 40 cm |
| `[2, 1]` | 1 × ½ | 40 × 20 cm |
| `[1, 2]` | ½ × 1 | 20 × 40 cm |

Estimate centimeters per pixel from something of known size in the photo: a drinks can 12 cm tall, a 750 ml
bottle 30 cm, a 12″ record 30 cm, a dartboard 45 cm, a book spine 20–25 cm, a keyboard key pitch 19 mm, a
dinner plate 26 cm, a playing card 6.3 × 8.8 cm, a brick 21.5 × 6.5 cm, an A4 sheet 21 × 29.7 cm, a wall
socket plate 8 × 8 cm, a door 80 cm wide, a stop sign 75 cm across.

## What makes a good sample

- **True to scale.** Neither shrunk nor blown up: the sample covers the real-world patch its size says.
  Something larger than 40 cm gives **one distinct part** (a vending machine's drink window, an oven's control
  panel, one shelf compartment) rather than being squeezed whole; if no part stands on its own, skip it.
- **Reads as flat.** A prop is a flat surface, so no convex object that pops out of the wall, unless it sits
  inside a concave space (bottles in a fridge, goods on a shelf). Front views; a face seen at an angle is
  squared up with `corners`.
- **Distinct.** It has edges: a standalone object, or a self-contained collection (a shelf compartment, a
  crate, a drawer front), not an arbitrary crop of texture.
- **Background.** Take it out (transparent) around a standalone object: a clock, a telephone, a sign. Keep it
  where the sample is a space of its own: the inside of a shelf, a fridge, a display case, an aisle.
- **No margins.** A rect as wide as the object, with its height following the cells' shape, fills the image.
  A cut-out keeps its true size with transparent margins instead (rect with a height, plus `background` or
  `selections`); `align` places it in those margins (standing on the bottom, say) and `margin` shows it smaller.
- **Clean.** Straighten a tilt (`rotation`), fix dim or harsh color (`adjust`), and paint out prominent logos
  and brand plates (`retouches`; the Unsplash License grants no trademark rights). Small incidental labels on
  goods may stay. No recognizable faces.
- **Titled** in a few words of Title Case naming what is shown ("Oven Control Panel", "Crate of Red Peppers").
  The title and author only credit the photo in the notices; the game never shows or searches them.

## Keywords

The prop's image chooser searches keywords only, so they are how a player finds a sample. Every everyday object
needs them (`--save-samples` refuses one without); a painting has none, since it is found by its title and author.
Write them from the sample as it came out, not from the photo or the title.

- **One comma-separated string** of lowercase single words, 6–12 of them, most important first:
  `"commercial, kitchen, crate, pepper, bell, red, vegetable, produce, market, grocery"`.
- **The order is how alike images end up side by side.** The chooser orders images by the keywords they share, a
  keyword counting for less the later it comes (the first outweighs the rest together). So lead with its categories
  (see Categories), then its **kind**: what the image shows as a whole, in the word every image of that kind uses in
  that place. That is the thing itself (`clock`, `television`, `oven`, `vending, machine`, `sign`), or what holds the
  rest (`plate, dish` for food served on one; `bowl`, `tray`, `board`, `crate`, `bottle`, `pantry, shelf`,
  `bookshelf` for a row of books). Before choosing a kind word, look up the kinds the manifest already uses and reuse
  the same word. Then what it holds, then the words below. A plated steak starts `kitchen, plate, dish, steak, meat`,
  which puts it among the plated dishes, not among the steaks and hams on boards.
- **No keyword inside another.** A search matches each word typed anywhere in the keywords, so a keyword found
  inside another finds nothing the longer one doesn't: `bell pepper, pepper` is `bell, pepper`,
  `bookshelf, book, shelf` is `bookshelf`, `payphone, phone` is `payphone`. Split a phrase into its words (a
  search for `bell pepper` needs both).
- **No grammatical words** (`and`, `of`, `the`, `no`, `off`, …; `PICTURE_SEARCH_FILLER_WORDS` in
  `src/shared/system/sharedConstants.ts`): a search passes over them in what is typed, so `sweet and sour` finds
  `sweet, sour`. `--save-samples` and the editor tidy keywords this way on saving, but write them so.
- **What it is, in the words a player would type**: its names and common synonyms (`television, tv`;
  `faucet, tap`; `fridge, refrigerator`), then what kind of thing it is (`appliance`, `food`, `sign`,
  `furniture`), where else it belongs (`bar`, `library`, `school`) and what it is for (`music`, `time`).
- **What stands out in it**, last: its main colors, material or era (`wooden`, `rusty`, `retro`, `70s`).
- **Singular nouns.** The search tries a typed word's singular ("peppers", "boxes"), so a plural keyword adds
  nothing; add an irregular plural only (`knives`, `shelves`).
- **Nothing a player wouldn't search for**: no author, no brand or product names, no words about the photo
  (`photo`, `unsplash`, `sample`), and no words for what isn't visible.

## Categories

The Objects tab's categories (`categories` on its subfolder in the manifest) are the kinds of place a thing usually
belongs in; read the manifest for the current list:

| Category | For |
|---|---|
| `living` | Furniture, personal gadgets, bookshelves, decor |
| `kitchen` | Ovens, toasters, fridges, sinks, food, dining equipment |
| `bathroom` | Toilets, faucets, bathing equipment |
| `office` | Computers, calculators, notebooks, cabinets |
| `commercial` | Vending machines, shopping aisles, fridges, cash registers, bookshelves, public fixtures |
| `industrial` | Industrial equipment, workshop signs |

A category is simply a keyword. An image is under every tab its keywords name, so name each place it usually belongs
in (one or two, most typical first) at the front of its keywords. **Every image of a kind names the same categories in
the same order** (both clocks are `living, office, clock`): the leading keywords outweigh the rest, so a clock led by
other categories would sit among other things, far from the other clock. `picture.test.ts` checks this. So look up the
categories its kind already has before choosing. Name none for something no category fits, which the chooser shows
under Misc. Don't let a category word slip in as an ordinary keyword ("post office" boxes would land under Office).
`--save-samples` and the editor move the category words to the front on saving. A painting has none.

## Steps

1. **Add the photos.**
   `npm run imageMapEditor -- --add-sources <url> ...`
   Downloads are spaced out and a refusal (429) is waited out, so a long list takes minutes: run it in the
   background. A photo already in the library is kept. The author comes from the download's file name, which
   drops accents and capitals: where a name probably lost them (Czech, Polish, Spanish, …), check the photo's
   page and correct `author` in `dev/assets/picture_sources/index.json` before saving, since entries take
   it from there.
2. **Survey.**
   `npm run imageMapEditor -- --survey` draws every source no entry is sampled from yet at 1600 px with a grid
   in fractions of the photo, to `temp/image_map_editor/survey/<id>.jpg`. Read each one. For precise edges on a
   small object, survey just that part (the grid keeps the photo's fractions):
   `npm run imageMapEditor -- --survey <id>:x,y,w,h`
3. **Plan** the samples in `temp/image_map_editor/batches/<name>.json`, an array of `SampleOrder`
   (`dev/scripts/imageMapEditor/core/sampleOrder.ts`). Positions in the photo are fractions, as the survey is
   labeled; positions inside the sample (`retouches`, and those in `background`, `selections` and `alphaEdits`) are
   fractions of the sample.
   ```json
   [
     {"source": "aPoF91L-n6k", "subfolder": "2", "title": "Oven",
      "keywords": "kitchen, oven, stove, cooker, appliance, stainless, steel, metal, drawer, baking",
      "cells": [2, 2], "rect": [0.284, 0.507, 0.41]},
     {"source": "L0xOtAnv94Y", "subfolder": "2", "title": "Wall Clock",
      "keywords": "living, office, clock, wall, time, hour, minute, round, white", "cells": [2, 2],
      "rect": [0.221, 0.075, 0.565], "background": {"fromBorder": true, "seeds": [], "tolerance": 12,
      "step": 4, "keepLargest": true}},
     {"source": "1Bdsg4xqdYs", "subfolder": "2", "title": "Dartboard",
      "keywords": "living, dartboard, game, target, bullseye, pub, bar, sport, round", "cells": [2, 2],
      "rect": [0.35, 0.288, 0.29], "selections": [{"shape": "ellipse", "rect": [0, 0, 1, 1], "radius": 0}]},
     {"source": "-I8lDurtfAo", "subfolder": "2", "title": "Portable TV",
      "keywords": "living, television, tv, portable, screen, retro, vintage, orange, knob", "cells": [2, 2],
      "rect": [0.235, 0.207, 0.671, 0.583], "selections": [{"shape": "rect", "rect": [0, 0, 1, 1], "radius": 0.03}],
      "retouches": [[0.83, 0.05, 0.15, 0.16]], "align": [0.5, 1]}
   ]
   ```
   - `rect` is `[x, y, w]` (height from the cells' shape) or `[x, y, w, h]`; `corners` replaces it for a
     slanted face. `rotation` is degrees clockwise.
   - `background` flood-fills from the border (`fromBorder`) and/or clicked `seeds`, within `tolerance` of the
     start's color and `step` of its neighbor's (CIELAB), keeping the largest piece. See
     `core/recipeBackground.ts`.
   - `selections` cut to rectangles (corners rounded by `radius`, a fraction of the shorter side) or ellipses,
     each turned `angle` degrees clockwise about its middle; outside any goes transparent, or its `fill` color
     (so a square and the same square at 45° cut an octagon, a stop sign). `alphaEdits` erase or restore by
     brush, or erase a color. See `core/recipeSelection.ts`, `core/recipeAlphaEdit.ts`.
   - With `cells`: `align` is where the sample sits in the room its cells leave, across and down, 0 (left, top)
     to 1 (right, bottom), centred when absent; `margin` keeps that share of the width and height clear besides.
   - `adjust`: brightness, contrast, saturation and warmth from -100 to 100, hue in degrees, sharpness 0–100.
   - `keywords` as above, its categories first, with every order that has `cells`.
   - A painting for the Arts tab (subfolder `1`, shown by a canvas) is fitted to its canvas: `longSide`
     (pixels) instead of `cells`, and no `keywords`. Only when the user asks for one.
4. **Save.**
   `npm run imageMapEditor -- --save-samples temp/image_map_editor/batches/<name>.json`
   Each order becomes a disabled entry, its path written back into the plan (so running it again remakes the
   same entries), then the map is rebuilt and `temp/image_map_editor/contact_sheet.png` shows the batch at
   scale on a checkerboard. Read the sheet, and the full-size images under
   `dev/assets/disabled_pictures/<path>.webp` where detail matters; fix the orders and save again until
   each one holds up against the guidelines, its keywords included (the manifest holds them as saved: single
   lowercase words, none inside another and no grammatical ones). A background `tolerance` too low leaves halos and shadows; too
   high, it eats into the object's pale parts (a light wood edge, a white rim). A plan holding only the orders
   being fixed remakes just those.
5. **Click map.** An interactable thing (vending machine, bookshelf, store shelf, fridge, card catalog,
   cassette shelf, payphone) gets its path under the matching callback in
   `src/client/object/maps/playModeClickCallbackMap.ts` (the Prop entry). A new kind gets a new empty callback
   only when none fits.
6. **Report** to the user: each entry (path, title, keywords, source), the photos skipped and why, and
   any author names still worth checking. They review in the editor (`npm run imageMapEditor`, where disabled
   entries show dimmed and keywords can be edited, with the tabs they put it in shown beneath), enable the keepers,
   and run `npm run beforeCommit` before committing.
