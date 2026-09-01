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
- **`/plans`** - Dated design/planning notes, filed by year. **Historical records, not descriptions of the present — never edited after the day they were written.** See "Plan Documents Are Historical Records" below.

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
- **Room Generation Defines What a Room Is**: See *Project Rules* below.

## Project Rules

Each rule below is binding as written. The linked page in `.claude/rules/` carries the reasoning, the
edge cases, and the concrete checklist — read it before acting in that area.

### Room Generation Defines What a Room Is
Every room is born from `RoomGenerationUtil` and nothing else ever produces one, so generation is the *definition* of a complete room. **Whenever a new room-level parameter is introduced, room generation must be extended to choose it as part of the same change** — `Room`, `RoomGenerationUtil`, the procedural `RoomBuilder`s, every `SinglePlayerModeConfig`, and any curated data behind the parameter. A parameter no generator sets is one that every room silently holds the default value of. Contents are a narrower obligation: a new *placeable object* owes generation nothing, a new kind of *voxel* content does. Full rule: [`.claude/rules/room-generation.md`](.claude/rules/room-generation.md).

### The License Files Must Describe What Actually Ships
The code is Apache-2.0; the writing and artwork under `public/` are all rights reserved; some bundled assets are third-party. That boundary exists only in `LICENSE-CONTENT.md` and `THIRD-PARTY-NOTICES.md`, nothing enforces it, and no test fails when it drifts. **Whenever the set of things that ship changes — a dependency, an external asset, a new `public/` directory, a new top-level code directory — the license files change in the same commit.** A copyleft or source-available dependency license is a decision for the user: report it and stop. Never add an asset whose terms are unknown. **`LICENSE` is verbatim Apache-2.0 and is never edited.** Full rule: [`.claude/rules/license-files.md`](.claude/rules/license-files.md).

### Plan Documents Are Historical Records
Files under `/docs/plans` are dated records of what was known, intended and uncertain on the day they were written. **A plan document is never edited after that day** — not to rename a symbol that has since been renamed in `src/`, not to fix a stale path or number, not to correct it, not to append an outcome or a status note, and not to apply the documentation guidelines to it. Plans are also not added to the README index. When a sweeping edit (a rename, a find-and-replace, a docs-sync pass) matches a file under `/docs/plans`, **skip it and leave the file untouched**; inconsistency with today's code is the correct state for a historical record. If a plan is misleading, write a *new* dated plan rather than revising the old one. The only edits that are ever in scope are ones the user asks for: writing a new plan, or editing one on the day it was written. Full rule: [`.claude/rules/plan-documents.md`](.claude/rules/plan-documents.md).

## Documentation Guidelines (`/docs`, excluding `/docs/plans`)
Documents in `/docs` are meant to be **conceptual outlines** — the most concise description of how things work *now* — not exhaustive technical dumps. When writing or editing them, follow these rules. (`/docs/plans` is outside all of this: those files describe a past day, not the present, and are never edited — see "Plan Documents Are Historical Records" above.)

1. **Stay conceptual, not exhaustive.** Explain the idea, the purpose, and the flow. Omit nitpicky implementation details that a reader does not need in order to understand the concept, and that would go stale the moment the code is tweaked.
2. **Describe only the present.** No historical records ("it used to work this way, but now…") and no future plans ("once X is implemented, it will…"). State only how things currently work.
3. **Avoid exact numbers and internal names.** Do not cite specific numeric quantities (constant values, sizes, intervals, counts, thresholds) or internal local-variable / function / method names — these turn the doc misleading as soon as a value is adjusted or a symbol renamed. Describe the *concept* instead (e.g. "a short grace period" rather than "5 seconds"; "validates the request" rather than "calls `fooUtil.validateBar()`").
4. **Globally accessible module, class, and type names are allowed** (e.g. `RoomGenerationUtil`, `PhysicsRoom`, `SocketUserContext`), as are protocol-level identifiers like signal/message type names. These are stable anchors that help readers navigate. Linking to a source file (e.g. `@src/.../fooUtil.ts`) is fine; naming the specific function inside it is not.
5. **Exception — testing, DB, and devOps docs.** Documents under `/docs/testing` and `/docs/devOps`, and DB/migration specifics elsewhere, may carry concrete technical details (commands, schema, version steps, configuration), since precision genuinely matters there.