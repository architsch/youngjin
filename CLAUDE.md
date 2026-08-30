# Project Overview

## Technology Stack
- **Runtime**: Node.js with TypeScript
- **Frontend**: Three.js (3D graphics), React, Tailwind CSS, EJS
- **Networking**: Express.js (HTTP requests, authentication), Socket.IO (real-time communication), Axios (client-side HTTP requests), Nginx (VPS's web server)
- **Database**: Firebase (Firestore, Cloud Storage, Content Distribution)
- **Build Tools**: Webpack (typescript compiler, bundler), Sharp (static site image generation)
- **Dev Tools**: Husky (git hooks), PM2 (runtime process management), GitHub (source control, workflows, and static page hosting), VS Code (IDE), Claude Code (AI assistant)
- **Tests**: Playwright (E2E tests), Vitest (Integration tests), fast-check (Property-based testing)

## Project Structure
### `/src` - Main Source Code
- **`/client`** - Client-side code (browser)
  - `/graphics` - 3D graphics for game objects, voxels, and world-space gizmos
  - `/networking` - Client-side networking (SocketsClient for Socket.IO, API clients for Axios)
  - `/object` - Game object management (ClientObjectManager, component system including Rigidbody, PlayerController, PeriodicTransformEmitter/Receiver)
  - `/singlePlayer` - Client-side single-player gameplay logic (SinglePlayerManager, the scripted steps of each mode in SinglePlayerModeClientConfigMap, and the action/condition maps those steps are carried out through)
  - `/system` - Client-side observables and state management
  - `/ui` - React UI components and styles
  - `/voxel` - Voxel management (ClientVoxelManager), plus the client-only queries about the room as drawn (ClientVoxelQueryUtil) and the pool of mesh instances the visible quads are lent (VoxelQuadInstanceUtil)
  
- **`/server`** - Server-side code (Node.js/Express)
  - `/analytics` - Acquisition analytics (ServerAnalyticsManager — which traffic source a visitor came from, and how far through the funnel they got)
  - `/db` - Database utilities and types (Firestore, Firebase Storage, caching)
  - `/networking` - Express.js routers and general networking utilities (e.g. address (URL) formatting, cookies, firebase-admin, and rate-limiter initialization)
  - `/object` - Server-side object management (ServerObjectManager)
  - `/room` - Game room management
  - `/sockets` - Socket.IO initializer and event handlers
  - `/ssg` - Static Site Generator (builds static pages)
  - `/system` - Server-side constants and utilities
  - `/user` - User authentication and state management
  - `/voxel` - Server-side voxel management (ServerVoxelManager)
  
- **`/shared`** - Code shared between client and server
  - `/graphics` - Shared graphics data (image maps, material params, and the instanced mesh composition system with its codecs and builders)
  - `/localization` - Localization utilities
  - `/math` - Math utilities (vectors, geometry, etc.)
  - `/networking` - Data encoding/decoding utilities and Socket.IO signal type configs
  - `/object` - Game object types, configs, and shared update logic (ObjectUpdateUtil)
  - `/physics` - Physics engine (PhysicsManager — collision detection, hitboxes, step-up, gravity)
  - `/room` - Room types and generators
  - `/singlePlayer` - Single-player room configs and types (SinglePlayerModeConfig — the room's layout and how it is built, which the server generates too)
  - `/system` - Shared observables, constants, logging, and error handling
  - `/user` - User types and validators
  - `/voxel` - Voxel/block system (3D world building)

### `/views` - EJS templates for both static and SSR pages
- **`/page`** - EJS page templates
  - `/development` - Development-only SSR pages
  - `/dynamic` - SSR pages served in production mode
  - `/static` - Static page templates (used by SSG to generate static pages in "public" directory)

- **`/partial`** - EJS partials
  - `/common` - Commonly used partials (e.g. header, footer)
  - `/info` - Informative content (e.g. links, portfolio)

### `/dev` - Development Configuration
- **`/config`** - Webpack config files, tsconfig files, Nginx config files
- **`/scripts`** - Helper scripts (e.g. dev-server with hot-reloading capability, secrets injector)

### `/docs` - Documents explaining technical details
- **`/devOps`** - Local Development, VPS
- **`/gameplay`** - Game modes (play mode, edit mode), the admin privilege
- **`/geometry`** - Voxel grid, physics, room generation, room entrances and doors, wall-attached objects, textures, player customization
- **`/graphics`** - Camera control, instanced mesh composition, image map
- **`/networking`** - HTTP/Socket/Authentication Flows, single-player mode
- **`/testing`** - E2E and integration test workflows, framework, and scenario coverage

### `/tests` - All Tests
- **`/e2e`** - E2E test fixtures, specs, configs, and helpers (Playwright)
- **`/integration`** - Integration tests and helpers (Vitest)

### `/.github` - GitHub Configuration and Workflows

## Important Files
- `README.md` - General guide to the project and related documentation links
- `LICENSE` - Apache License 2.0, covering the source code (verbatim; never edit)
- `LICENSE-CONTENT.md` - Terms for the written and illustrated works, which are all rights reserved
- `THIRD-PARTY-NOTICES.md` - Bundled third-party assets and dependency licenses
- `NOTICE` - Apache-2.0 attribution notice, pointing at the two files above
- `package.json` - NPM packages and custom scripts
- `firebase.json` - Settings for Firestore, Firebase Storage, and Firebase Emulators
- `src/client/client.ts` - Entrypoint of the client app
- `src/server/server.ts` - Entrypoint of the server app
- `src/shared/networking/maps/signalTypeConfigMap.ts` - Overview of signals involved in real-time (Socket.IO) communication.
- `src/shared/object/maps/objectTypeConfigMap.ts` - Overview of all types of GameObjects involved in gameplay.
- `src/client/system/clientObservables.ts` - Observables used only by the client app (for internal event handling)
- `src/shared/system/sharedObservables.ts` - Observables used by both the client and server apps (for internal event handling)
- `views/page/dynamic/mypage.ejs` - Page where the client app runs (This is where gameplay takes place). This client app authenticates the user via the server's user-API routes and makes a socket connection (game_sockets) with the server's Socket.IO instance.

## Architecture Notes
- **Observable Pattern**: Used for state management. Each listener can subscribe to an observable and react to its state changes.
- **Optional Sign-Up**: A new user automatically joins the game as a guest, which is a temporary user profile. In order to save one's progress, the user needs to create his/her own account by selecting one of the given auth providers (such as Google OAuth2). Detailed flows are illustrated in `docs/networking/authentication.md`.
- **Separation between Static and Dynamic Pages**: Static pages (HTML files in the "public" directory) are being served via GitHub Pages, under the URL: `https://thingspool.net`. Dynamic pages and the server/client apps are being hosted in the VPS, under the URL: `https://app.thingspool.net` (live server) or `https://staging.thingspool.net` (staging server). During local dev test, a local URL (`http://127.0.0.1:3000`) is used to serve both static and dynamic contents.
- **Room Generation Defines What a Room Is**: See the section below.

## Room Generation Defines What a Room Is

Every room in the game is born from `RoomGenerationUtil` — multiplayer rooms laid out procedurally by `HubRoomBuilder` and `RegularRoomBuilder` on top of `ProceduralRoomBuilder`, single-player rooms built from their `SinglePlayerModeConfig` — and nothing else ever produces one. That makes room generation the *definition* of a complete room: not only the voxels and objects inside it, but every room-level parameter those contents were chosen to suit.

**Whenever a new room-level parameter is introduced, room generation must be extended to choose it as part of the same change.** This is not polish to defer:

1. **A parameter no generator sets does not exist in practice.** Since every room is created by generation, a parameter left out of it is one that every room in the game silently holds the default value of. However complete its editing UI is, the feature ships looking like it was never built — visible only to the few owners who go and change it by hand.
2. **Room parameters are not independent of each other, or of the room's contents.** A palette's texture indices only mean anything within one specific texture pack; fog has to agree with the skybox; a prop's materials have to come from the room's own pack. Generation is the single place where those agreements are expressed. Adding a parameter anywhere else and leaving generation alone produces rooms whose settings contradict their own contents.
3. **Generated rooms are what almost everyone sees.** Hubs and newly created rooms are the game's first impression, and most of them are never hand-edited at all. A parameter generation does not decide is one whose effect most players never encounter.

**Contents are a narrower obligation than parameters.** Procedural generation lays out a multiplayer room's voxel grid — its areas, the walls and passages between them, the ways up to the storey above, and the voxel block work standing in them — and places exactly one object: the door that is the room's way in. A Hub or Regular room is otherwise meant to be furnished by the people who use it, so what generation owes them is somewhere to build rather than a full house. A new kind of placeable object therefore needs nothing from generation; a new kind of *voxel* content does.

The door is the exception because it is not furniture: a room with no door is a room nobody can leave, and it is also what an arriving player is put down behind. Anything else that becomes structurally necessary in that sense belongs in generation for the same reason.

Concretely, introducing a room-level parameter means: add it to `Room` (so it is stored and sent to clients), make `RoomGenerationUtil` and the procedural `RoomBuilder`s decide it, declare it on every `SinglePlayerModeConfig` (which carries its parameters as `RoomBuilderParams`), and — where the parameter has curated data behind it, as texture packs have palettes in `RoomPaletteMap` — extend that curation to cover every option a room can be generated with. Conceptual details live in `docs/geometry/room_generation.md`.

## The License Files Must Describe What Actually Ships

This repository is **dual-natured on purpose**: the code is open source under Apache-2.0, while the
written and illustrated works under `public/` are all rights reserved, and some bundled assets belong
to third parties under their own terms. That boundary exists only in `LICENSE-CONTENT.md` and
`THIRD-PARTY-NOTICES.md`. Nothing enforces it, no test fails when it drifts, and a reader — or a
court — has no other place to look.

Drift is therefore not cosmetic. It fails in one of two directions, and both are public:

- **Too wide**, and the repository appears to give away writing and artwork that were never meant to
  be licensed. A permissive grant, once published, is not reliably retractable.
- **Too narrow**, and the project claims rights over somebody else's asset, or ships one whose terms
  it never checked.

**So whenever the set of things that ship changes, the license files change in the same commit.**
Concretely:

1. **A new dependency** — check its license before adding it. MIT / Apache-2.0 / BSD / ISC are fine.
   A copyleft or source-available license (GPL, AGPL, LGPL, MPL, SSPL, BUSL, PolyForm, "non-commercial")
   is a **decision for the user, not a default to accept**: it can force this project's own terms to
   change. Report it and stop. If the dependency is a substantive one, add it to the table in
   `THIRD-PARTY-NOTICES.md`.
2. **A new external asset** — a texture pack, image, model, sound, icon or font arrives with terms
   attached. Keep the license file it came with beside the asset, and add a row to
   `THIRD-PARTY-NOTICES.md` naming the author and the license. **Never add an asset whose terms are
   unknown**; "found on the internet" is not a license.
3. **A new `public/` directory** — a library section, a dev-log year, an arcade entry — is *content*.
   It is all rights reserved, and it belongs in the illustrative list in `LICENSE-CONTENT.md`.
4. **A new top-level code directory** belongs in the "What Apache-2.0 covers" table in
   `LICENSE-CONTENT.md`, so the open-source half of the boundary stays complete too.
5. **`LICENSE` is verbatim Apache-2.0 and is never edited.** Scope statements, exclusions and
   attributions go in the other three files. Editing the license text produces a licence that is no
   longer Apache-2.0 and that nobody can evaluate.
6. **Web fonts**: `THIRD-PARTY-NOTICES.md` currently states that none are used. Adding one makes
   that statement false, and it must be updated.

## Documentation Guidelines (`/docs`)
Documents in `/docs` are meant to be **conceptual outlines** — the most concise description of how things work *now* — not exhaustive technical dumps. When writing or editing them, follow these rules:

1. **Stay conceptual, not exhaustive.** Explain the idea, the purpose, and the flow. Omit nitpicky implementation details that a reader does not need in order to understand the concept, and that would go stale the moment the code is tweaked.
2. **Describe only the present.** No historical records ("it used to work this way, but now…") and no future plans ("once X is implemented, it will…"). State only how things currently work.
3. **Avoid exact numbers and internal names.** Do not cite specific numeric quantities (constant values, sizes, intervals, counts, thresholds) or internal local-variable / function / method names — these turn the doc misleading as soon as a value is adjusted or a symbol renamed. Describe the *concept* instead (e.g. "a short grace period" rather than "5 seconds"; "validates the request" rather than "calls `fooUtil.validateBar()`").
4. **Globally accessible module, class, and type names are allowed** (e.g. `RoomGenerationUtil`, `PhysicsRoom`, `SocketUserContext`), as are protocol-level identifiers like signal/message type names. These are stable anchors that help readers navigate. Linking to a source file (e.g. `@src/.../fooUtil.ts`) is fine; naming the specific function inside it is not.
5. **Exception — testing, DB, and devOps docs.** Documents under `/docs/testing` and `/docs/devOps`, and DB/migration specifics elsewhere, may carry concrete technical details (commands, schema, version steps, configuration), since precision genuinely matters there.