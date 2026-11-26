# Content License

Copyright 2019-2026 ThingsPool. All rights reserved.

This repository contains two different kinds of work, under two different sets of
terms. The [LICENSE](LICENSE) file — the Apache License, Version 2.0 — covers the
**software**. This file covers everything else.

## What Apache-2.0 covers

The source code and the machinery that builds and runs it: the generator of this
site's pages (`ssg/`), and the game Robot Rooms, which is the project in
`robot-rooms/`:

| | |
|---|---|
| `ssg/` | the generator of this site's pages (TypeScript), with its EJS templates (`ssg/views/`), tests and configuration |
| `robot-rooms/src/` | client, server and shared TypeScript |
| `robot-rooms/views/` | the game's EJS templates |
| `robot-rooms/dev/` | build configuration and helper scripts, but not the images in `robot-rooms/dev/assets/`, which are copies of the game's pictures on the same terms as them (below), nor `robot-rooms/dev/clawhub/` (below the table) |
| `robot-rooms/tests/` | E2E and integration tests |
| `robot-rooms/docs/` | technical documentation |
| `.github/` | workflows |
| `robot-rooms/` config | `package.json`, `webpack` and `tsconfig` files, `firebase.json`, `server.json`, and the like |
| `public/RobotRooms/skill.md` | Robot Rooms' manual for AI agents, the one written work under `public/` that Apache-2.0 covers, since it is meant to be copied and installed wherever agents keep their skills |

Compiled and generated output derived from those files is covered on the same
terms.

`robot-rooms/dev/clawhub/` holds the copy of the agents' manual published on ClawHub, which
licenses every skill under MIT-0 and allows no other license. That copy, and it
alone, is under MIT-0.

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
  `reality/`, `sandwich/`, `software-development/`, and `shards-of-sanity/`. **The list is
  illustrative, not exhaustive** — a section added later is covered by the same
  rule.
- **Illustrations, cartoons and photographs** — including `public/illustrations/`
  (2009–2014) and `public/cartoons/` (2011–2015), and any image accompanying a
  library post.
- **The arcade showcase pages** — the descriptions, screenshots and banners of the
  games under `public/ArtRaider/`, `public/HuntLand/`, `public/PoliceChase/`,
  `public/RobotRooms/` (but for the agents' manual in it, above), `public/SpaceTown/`
  and `public/Water-vs-Fire/`.
- **Dev-log prose and its screenshots** — `public/devlog-2026/` and later years.
- **Original game artwork** — the textures, pictures, character atlases,
  icons, logos and sounds authored for Robot Rooms and for the site under
  `public/app/assets/` and `public/`, excluding the third-party packs, recordings and photographs listed below. This includes the
  authored descriptions of that artwork as well as the images themselves —
  `public/app/assets/instanced_mesh_composition/`, which is the source the
  game's object appearances are composed from.
- **Authored rooms** — the room files under `public/app/assets/rooms/`, each a
  room built by hand for the game, the tutorial's among them.
- **The ThingsPool and Robot Rooms names, and the ThingsPool logo.** Apache-2.0
  grants no trademark rights (section 6), and none are granted here either.

## Third-party material

Some assets in this repository belong to neither category above: they are
third-party works redistributed under their own terms. The texture packs, the
label font and the dollar bill texture under `public/app/assets/resources/` are the
main examples: the packs and the bill are public domain, and the font is under the
SIL Open Font License. So are the recordings under `public/app/assets/audio/BigSoundBank/`
and `public/app/assets/audio/Freesound/`, which are public domain and are cut into
some of the game's sounds, beside its own in `public/app/assets/audio/bundle*.mp3`. So are the
photographs of everyday objects in the pictures' subfolder `2/` whose entries in
`public/app/assets/pictures/manifest.json` name a source and license, which ship
under `public/app/assets/pictures/2/` once enabled and are parked under
`robot-rooms/dev/assets/disabled_pictures/2/` until then, and the full-resolution samples
of them under `robot-rooms/dev/assets/pictures/2/`, all used under the Unsplash License.
The other photographs in `2/` are ThingsPool's own, covered above as original
game artwork, as are the photographs in `1/` whose entries name thingspool as
their author, with their samples and parked copies under `robot-rooms/dev/assets/`.
(`robot-rooms/dev/assets/pictures/1/` also holds copies of the paintings under
`public/app/assets/pictures/1/`, which keep those images' terms.) See
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) for the full list.

## In short

You may read, fork, modify, self-host and build upon **the code**, commercially
or otherwise, under the terms of Apache-2.0.

You may not republish **the writing, the artwork or the illustrations** without
permission, the agents' manual (`public/RobotRooms/skill.md`) aside. If you fork this
repository to build something of your own, replace them with your own.

For permission beyond these terms, ask: <https://thingspool.net>
