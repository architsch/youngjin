# Third-Party Notices

ThingsPool bundles and depends on third-party work. This file records what that
work is and under what terms it is used. It supplements, and does not modify,
[LICENSE](LICENSE) and [LICENSE-CONTENT.md](LICENSE-CONTENT.md).

## Bundled assets

### Texture packs — Screaming Brain Studios

Twelve texture packs under `public/app/assets/resources/` are the work of
[Screaming Brain Studios](https://screamingbrainstudios.itch.io/) and are
released under
[CC0 1.0 Universal (Public Domain Dedication)](https://creativecommons.org/publicdomain/zero/1.0/).
CC0 places no restriction on use, commercial or otherwise, and requires no
credit; the attribution below is given because it is deserved, not because it is
demanded.

| Directory | Source |
|---|---|
| `FloorTileTexturePack/` | Screaming Brain Studios |
| `HolidayTexturePack/` | Screaming Brain Studios |
| `HorrorTexturePack/` | Screaming Brain Studios |
| `LiquidTexturePack/` | Screaming Brain Studios |
| `PhotoRealisticTexturePack1/` | Screaming Brain Studios |
| `PhotoRealisticTexturePack2/` | Screaming Brain Studios |
| `PhotoRealisticTexturePack3/` | Screaming Brain Studios |
| `PortraitFramePack/` | Screaming Brain Studios |
| `SyntheticTexturePack/` | Screaming Brain Studios |
| `TexturePack1/` | [Tiny Texture Pack](https://screamingbrainstudios.itch.io/tiny-texture-pack) |
| `TexturePack2/` | [Tiny Texture Pack 2](https://screamingbrainstudios.itch.io/tiny-texture-pack-2) |
| `TexturePack3/` | [Tiny Texture Pack 3](https://screamingbrainstudios.itch.io/tiny-texture-pack-3) |

Each directory keeps its own `License.txt` as received. Those files are the
authoritative terms and should not be removed when the assets are.

### Label font — Tinos

`public/app/assets/resources/Tinos/Tinos-Regular-Latin.ttf` is a Latin subset of
[Tinos](https://github.com/googlefonts/tinos) Regular, Copyright 2026 The Tinos
Project Authors, released under the
[SIL Open Font License 1.1](https://openfontlicense.org). No Reserved Font Name
is declared. The game inlines it into the client bundle to letter labels, and the
font keeps its copyright and license notice in its own name records.

The directory keeps `OFL.txt`, the authoritative terms, and a `README.md`
recording how the subset was made. The OFL covers the font alone; the code that
uses it stays under Apache-2.0.

### Pictures from third parties

The pictures listed below, under `public/app/assets/pictures/` (with their
`.thumbnail.webp` copies), are photographs by the people their rows name,
each used under the license its row names; an empty table means none ships. The
[Unsplash License](https://unsplash.com/license) lets a photo be used,
commercially or not, without permission or credit; not sold without significant
modification, nor compiled into a service that competes with Unsplash. Every
Unsplash photo here is a free one, not an Unsplash+ one.

Each was sampled from its photo, and straightened, cut out of its background or
retouched, in the image map editor (`npm run imageMapEditor`). The editor keeps
each sample at full resolution under `dev/assets/pictures/2/` (never shipped),
and writes this table from the map's manifest. A disabled entry's image is parked
under `dev/assets/disabled_pictures/` and left out of this table, since it
doesn't ship. Every sample and parked image keeps the photographer and license of
the photo it came from, which the manifest names for each entry, enabled or not.
The original photos are never committed; only their index,
`dev/assets/picture_sources/index.json`, naming where each came from.
The license grants no trademark or likeness rights, so prominent logos and brand
plates were painted out; small incidental labels on goods remain.

<!-- pictures:begin (written by the image map editor) -->
| File | Title | Author | Source | License |
|---|---|---|---|---|
| `2/4.webp` | Pepperoni Pizza | Fernando Andrade | [_P76trHTWDE](https://unsplash.com/photos/pizza-with-pepperoni-and-ham-_P76trHTWDE) | Unsplash License |
| `2/7.webp` | Boombox | Eric Nopanen | [8e0EHPUx3Mo](https://unsplash.com/photos/person-with-vintage-silver-boombox-8e0EHPUx3Mo) | Unsplash License |
| `2/8.webp` | Tube Radio | Gayatri Pandkar | [Q1KJomEl70c](https://unsplash.com/photos/an-old-radio-sitting-on-top-of-a-wooden-table-Q1KJomEl70c) | Unsplash License |
| `2/9.webp` | Portable TV | Diego González | [-I8lDurtfAo](https://unsplash.com/photos/grey-and-orange-crt-tv--I8lDurtfAo) | Unsplash License |
| `2/11.webp` | Wall Clock | Ocean Ng | [L0xOtAnv94Y](https://unsplash.com/photos/round-analog-wall-clock-pointing-at-1009-L0xOtAnv94Y) | Unsplash License |
| `2/19.webp` | Macintosh | Jason Leung | [VeUSCLJrLf4](https://unsplash.com/photos/turned-off-macintosh-monitor-VeUSCLJrLf4) | Unsplash License |
| `2/27.webp` | Pendulum Clock Face | C | [G_YvG3ZIlkQ](https://unsplash.com/photos/an-old-wooden-clock-face-shows-the-time-G_YvG3ZIlkQ) | Unsplash License |
| `2/33.webp` | Keyboard | Andrey Matveev | [yLG3Zog38tw](https://unsplash.com/photos/a-computer-keyboard-sitting-on-top-of-a-table-yLG3Zog38tw) | Unsplash License |
| `2/40.webp` | Book Cubby | Wesley Tingey | [ghHUi-j_eko](https://unsplash.com/photos/full-bookshelf-ghHUi-j_eko) | Unsplash License |
| `2/48.webp` | Vending Machine Keypad | Denny Müller | [In51lypcCDA](https://unsplash.com/photos/red-and-black-vending-machine-In51lypcCDA) | Unsplash License |
| `2/52.webp` | Card Catalog Drawers | Erol Ahmed | [Y3KEBQlB1Zk](https://unsplash.com/photos/close-up-photography-of-brown-wooden-card-catalog-Y3KEBQlB1Zk) | Unsplash License |
| `2/56.webp` | Dartboard | Simon Ray | [1Bdsg4xqdYs](https://unsplash.com/photos/a-dart-hitting-in-the-center-of-a-dartboard-on-a-wooden-wall-1Bdsg4xqdYs) | Unsplash License |
| `2/57.webp` | Popcorn Sign | Rita Vicari | [kGGnJBw78Vo](https://unsplash.com/photos/popcorn-signage-kGGnJBw78Vo) | Unsplash License |
| `2/58.webp` | Popcorn Machine Window | Vitya Lapatey | [Q-dusXpAH0I](https://unsplash.com/photos/popcorn-on-white-and-red-box-Q-dusXpAH0I) | Unsplash License |
| `2/77.webp` | Bookshelf Speaker | Caleb Woods | [VVuRLhyTmXM](https://unsplash.com/photos/green-plant-on-brown-pot-VVuRLhyTmXM) | Unsplash License |
| `2/85.webp` | Arch Vase Cubby | Kshiraj Vij | [xIJRwAaxwZo](https://unsplash.com/photos/various-decorative-objects-displayed-in-illuminated-cubbies-xIJRwAaxwZo) | Unsplash License |
| `2/86.webp` | Vase Pair Cubby | Kshiraj Vij | [xIJRwAaxwZo](https://unsplash.com/photos/various-decorative-objects-displayed-in-illuminated-cubbies-xIJRwAaxwZo) | Unsplash License |
| `2/87.webp` | Sculpture Cubby | Kshiraj Vij | [xIJRwAaxwZo](https://unsplash.com/photos/various-decorative-objects-displayed-in-illuminated-cubbies-xIJRwAaxwZo) | Unsplash License |
| `2/88.webp` | Rack of Bread Rolls | Leslie Saunders | [1vhNkMq6_aM](https://unsplash.com/photos/a-group-of-pastries-in-a-fridge-1vhNkMq6_aM) | Unsplash License |
| `2/96.webp` | Ornate Mirror | Luis Villasmil | [gzb4RKX-pdc](https://unsplash.com/photos/ornate-gold-frame-on-yellow-wall-gzb4RKX-pdc) | Unsplash License |
| `2/99.webp` | No Smoking Plaque | Benjamin Lehman | [1wxXo58XOjk](https://unsplash.com/photos/a-bathroom-with-a-no-smoking-sign-on-the-wall-1wxXo58XOjk) | Unsplash License |
| `2/101.webp` | Library Card Catalog | Jan Antonin Kolar | [lRoX0shwjUQ](https://unsplash.com/photos/brown-wooden-drawer-lRoX0shwjUQ) | Unsplash License |
| `2/116.webp` | Composition Notebook | Kelly Sikkema | [LtIqWwDs70s](https://unsplash.com/photos/black-and-white-frame-with-white-printer-paper-LtIqWwDs70s) | Unsplash License |
| `2/127.webp` | Grilled Vegetables with Feta | oh_ja_that_oke | [86Wwvs0rtgE](https://unsplash.com/photos/a-table-topped-with-plates-of-food-and-utensils-86Wwvs0rtgE) | Unsplash License |
| `2/131.webp` | Mechanical Keyboard | JL Cabrera | [p5rgceFiOH0](https://unsplash.com/photos/a-black-and-white-keyboard-with-red-keys-p5rgceFiOH0) | Unsplash License |
| `2/139.webp` | Pork Terrine | Geoffrey Moffett | [GH9kBVZJC_4](https://unsplash.com/photos/several-gourmet-dishes-are-artfully-presented-on-a-table-GH9kBVZJC_4) | Unsplash License |
| `2/141.webp` | Seared Scallops | Geoffrey Moffett | [GH9kBVZJC_4](https://unsplash.com/photos/several-gourmet-dishes-are-artfully-presented-on-a-table-GH9kBVZJC_4) | Unsplash License |
| `2/148.webp` | No Unauthorized Access Sign | Waldemar Brandt | [Dae6gNfmOos](https://unsplash.com/photos/red-and-white-no-smoking-sign-Dae6gNfmOos) | Unsplash License |
| `2/149.webp` | High Voltage Sign | Waldemar Brandt | [Dae6gNfmOos](https://unsplash.com/photos/red-and-white-no-smoking-sign-Dae6gNfmOos) | Unsplash License |
| `2/150.webp` | Green Arrow Sign | Tasha Kostyuk | [UgPP50i3_5c](https://unsplash.com/photos/green-sign-with-white-arrow-pointing-left-on-brick-wall-UgPP50i3_5c) | Unsplash License |
<!-- pictures:end -->

## Software dependencies

Dependencies are resolved from npm at build time rather than vendored into this
repository, so their license texts live in `node_modules/` once installed.

Every direct dependency and development dependency is under a permissive
license — **MIT**, **Apache-2.0** or **ISC**. There is no copyleft-licensed
dependency in the tree, which is what leaves the Apache-2.0 choice for this
project's own code unconstrained.

The substantive ones, for attribution:

| Package | License | Role |
|---|---|---|
| [three](https://github.com/mrdoob/three.js) | MIT | 3D rendering |
| [react](https://github.com/facebook/react) / react-dom | MIT | UI |
| [socket.io](https://github.com/socketio/socket.io) / socket.io-client | MIT | real-time networking |
| [express](https://github.com/expressjs/express) | MIT | HTTP server |
| [tailwindcss](https://github.com/tailwindlabs/tailwindcss) | MIT | styling |
| [firebase-admin](https://github.com/firebase/firebase-admin-node) | Apache-2.0 | database and storage |
| [@google-cloud/secret-manager](https://github.com/googleapis/google-cloud-node) | Apache-2.0 | secret loading |
| [ejs](https://github.com/mde/ejs) | Apache-2.0 | templating |
| [typescript](https://github.com/microsoft/TypeScript) | Apache-2.0 | compiler (dev) |
| [webpack](https://github.com/webpack/webpack) | MIT | bundler (dev) |
| [vitest](https://github.com/vitest-dev/vitest) | MIT | integration tests (dev) |
| [@playwright/test](https://github.com/microsoft/playwright) | Apache-2.0 | E2E tests (dev) |
| [fast-check](https://github.com/dubzzz/fast-check) | MIT | property-based testing (dev) |

Anyone redistributing a **built** artifact of this project is redistributing
those dependencies too, and takes on their obligations — in particular,
preserving the `NOTICE` file of any Apache-2.0 dependency that ships one.

To regenerate a current inventory, including transitive dependencies:

```bash
npx license-checker --summary
```

Development dependencies included: the packages the client is built from (three,
react, socket.io-client, tailwindcss) are among them, since only the build needs
them installed, yet they ship inside the client bundle.

## Fonts

One font file is bundled: Tinos, for label text (see *Bundled assets* above).
Everything else on the site and in the game renders in the reader's own system
fonts, and no web font is fetched from a provider.
