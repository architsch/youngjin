# Project Overview

## Technology Stack
- **Runtime**: Node.js with TypeScript
- **Frontend**: Three.js (3D graphics), React, Tailwind CSS, EJS
- **Networking**: Express.js (HTTP requests, authentication), Socket.IO (real-time communication), Axios (client-side HTTP requests), Nginx (VPS's web server)
- **Database**: Firebase (Firestore, Cloud Storage, Content Distribution)
- **Build Tools**: Webpack (typescript compiler, bundler)
- **Dev Tools**: Husky (git hooks), PM2 (runtime process management), GitHub (source control, workflows, and static page hosting), VS Code (IDE), Claude Code (AI assistant)
- **Tests**: Playwright (E2E tests), Vitest (Integration tests), fast-check (Property-based testing)

## Project Structure
### `/src` - Main Source Code
- **`/client`** - Client-side code (browser)
  - `/graphics` - 3D graphics for game objects, voxels, and world-space gizmos
  - `/networking` - Client-side networking (SocketsClient for Socket.IO, API clients for Axios)
  - `/object` - Game object management (ClientObjectManager, component system including Rigidbody, FirstPersonController, PeriodicTransformEmitter/Receiver)
  - `/system` - Client-side observables and state management
  - `/ui` - React UI components and styles
  - `/voxel` - Voxel management (ClientVoxelManager)
  
- **`/server`** - Server-side code (Node.js/Express)
  - `/db` - Database utilities and types (Firestore, Firebase Storage, caching)
  - `/networking` - Express.js routers and general networking utilities (e.g. address (URL) formatting, cookies, firebase-admin, and rate-limiter initialization)
  - `/object` - Server-side object management (ServerObjectManager)
  - `/room` - Game room management
  - `/sockets` - Socket.IO initializer and event handlers
  - `/ssg` - Static Site Generator (builds static pages)
  - `/system` - Server-side constants
  - `/user` - User authentication and state management
  - `/voxel` - Server-side voxel management (ServerVoxelManager)
  
- **`/shared`** - Code shared between client and server
  - `/localization` - Localization utilities
  - `/math` - Math utilities (vectors, geometry, etc.)
  - `/networking` - Data encoding/decoding utilities and Socket.IO signal type configs
  - `/object` - Game object types, configs, and shared update logic (ObjectUpdateUtil)
  - `/physics` - Physics engine (PhysicsManager — collision detection, hitboxes, step-up, gravity)
  - `/room` - Room types and generators
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
- **`/devOps`** - Tests, Local Development, VPS
- **`/networking`** - HTTP/Socket/Authentication Flows

### `/tests` - All Tests
- **`/e2e`** - E2E test fixtures, specs, configs, and helpers (Playwright)
- **`/integration`** - Integration tests and helpers (Vitest)

### `/.github` - GitHub Configuration and Workflows

## Important Files
- `README.md` - General guide to the project and related documentation links
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

## Documentation Guidelines (`/docs`)
Documents in `/docs` are meant to be **conceptual outlines** — the most concise description of how things work *now* — not exhaustive technical dumps. When writing or editing them, follow these rules:

1. **Stay conceptual, not exhaustive.** Explain the idea, the purpose, and the flow. Omit nitpicky implementation details that a reader does not need in order to understand the concept, and that would go stale the moment the code is tweaked.
2. **Describe only the present.** No historical records ("it used to work this way, but now…") and no future plans ("once X is implemented, it will…"). State only how things currently work.
3. **Avoid exact numbers and internal names.** Do not cite specific numeric quantities (constant values, sizes, intervals, counts, thresholds) or internal local-variable / function / method names — these turn the doc misleading as soon as a value is adjusted or a symbol renamed. Describe the *concept* instead (e.g. "a short grace period" rather than "5 seconds"; "validates the request" rather than "calls `fooUtil.validateBar()`").
4. **Globally accessible module, class, and type names are allowed** (e.g. `RoomGenerationUtil`, `PhysicsRoom`, `SocketUserContext`), as are protocol-level identifiers like signal/message type names. These are stable anchors that help readers navigate. Linking to a source file (e.g. `@src/.../fooUtil.ts`) is fine; naming the specific function inside it is not.
5. **Exception — testing, DB, and devOps docs.** Documents under `/docs/testing` and `/docs/devOps`, and DB/migration specifics elsewhere, may carry concrete technical details (commands, schema, version steps, configuration), since precision genuinely matters there.