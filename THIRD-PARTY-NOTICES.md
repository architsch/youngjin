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
| [axios](https://github.com/axios/axios) | MIT | HTTP client |
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
npx license-checker --production --summary
```

## Fonts

None to declare. The site and the game render in the reader's own system fonts:
no font file is bundled, and no web font is fetched from a provider.
