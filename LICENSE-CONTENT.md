# Content License

Copyright 2019-2026 ThingsPool. All rights reserved.

This repository contains two different kinds of work, under two different sets of
terms. The [LICENSE](LICENSE) file — the Apache License, Version 2.0 — covers the
**software**. This file covers everything else.

## What Apache-2.0 covers

The source code and the machinery that builds and runs it:

| | |
|---|---|
| `src/` | client, server and shared TypeScript |
| `views/` | EJS templates |
| `dev/` | build configuration and helper scripts, but not the images in `dev/assets/`, which are copies of the game's pictures on the same terms as them (below) |
| `tests/` | E2E and integration tests |
| `docs/` | technical documentation |
| `.github/` | workflows |
| root config | `package.json`, `webpack` and `tsconfig` files, `firebase.json`, and the like |

Compiled and generated output derived from those files is covered on the same
terms.

## What Apache-2.0 does not cover

**The published works this site exists to present, and the game's original
artwork, are all rights reserved.** They may not be copied, redistributed,
modified or used commercially without written permission.

This is a distinction between *code* and *content*, not between directories, and
it holds wherever the content appears — including inside generated HTML.
Concretely, it covers:

- **The ThingsPool library** — the essays, articles, analyses and translations
  published under `public/`, each of which is a written work in its own right.
  At the time of writing these are `bridge-to-math/`, `blockchains/`,
  `concepts-of-plan/`, `essays/`, `game-analysis/`, `game-design/`,
  `gamedev-journey/`, `infsoc/`, `metaphysics/`, `morsels/`, `read-rec/`,
  `reality/`, `sandwich/` and `software-development/`. **The list is
  illustrative, not exhaustive** — a section added later is covered by the same
  rule.
- **Illustrations, cartoons and photographs** — including `public/illustrations/`
  (2009–2014) and `public/cartoons/` (2011–2015), and any image accompanying a
  library post.
- **The arcade showcase pages** — the descriptions and screenshots of other games
  under `public/ArtRaider/`, `public/HuntLand/`, `public/PoliceChase/`,
  `public/SpaceTown/` and `public/Water-vs-Fire/`.
- **Dev-log prose and its screenshots** — `public/devlog-2026/` and later years.
- **Original game artwork** — the textures, pictures, character atlases,
  icons and logos authored for ThingsPool under `public/app/assets/` and
  `public/`, excluding the third-party packs and photographs listed below. This includes the
  authored descriptions of that artwork as well as the images themselves —
  `public/app/assets/instanced_mesh_composition/`, which is the source the
  game's object appearances are composed from.
- **Authored rooms** — the room files under `public/app/assets/rooms/`, each a
  room built by hand for the game, the tutorial's among them.
- **The ThingsPool name and logo.** Apache-2.0 grants no trademark rights
  (section 6), and none are granted here either.

## Third-party material

Some assets in this repository belong to neither category above: they are
third-party works redistributed under their own terms. The texture packs and the
label font under `public/app/assets/resources/` are the main examples: the packs
are public domain, and the font is under the SIL Open Font License. So are the
photographs of everyday objects in the pictures' subfolder `2/` whose entries in
`public/app/assets/pictures/manifest.json` name a source and license, which ship
under `public/app/assets/pictures/2/` once enabled and are parked under
`dev/assets/disabled_pictures/2/` until then, and the full-resolution samples
of them under `dev/assets/pictures/2/`, all used under the Unsplash License.
The other photographs in `2/` are ThingsPool's own, covered above as original
game artwork, as are the photographs in `1/` whose entries name thingspool as
their author, with their samples and parked copies under `dev/assets/`.
(`dev/assets/pictures/1/` also holds copies of the paintings under
`public/app/assets/pictures/1/`, which keep those images' terms.) See
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) for the full list.

## In short

You may read, fork, modify, self-host and build upon **the code**, commercially
or otherwise, under the terms of Apache-2.0.

You may not republish **the writing, the artwork or the illustrations** without
permission. If you fork this repository to build something of your own, replace
them with your own.

For permission beyond these terms, ask: <https://thingspool.net>
