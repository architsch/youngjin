# Robot Rooms

The 3D sandbox game at app.thingspool.net, a game by ThingsPool (see [`../CLAUDE.md`](../CLAUDE.md) for the repository as a whole, and for the rules that hold everywhere in it). Everything of the game is in this folder: source, templates, dev scripts, docs, tests, `package.json`, `node_modules`, `dist` and its scratch folder `temp`. Its commands (`npm run ...`, `npx ...`, `node dev/scripts/...`) run here, and the paths below, like those in its docs and scripts, are relative to it.

Outside it, the game has only what the site serves for it, in `../public`: the assets it loads (`app/assets`), its error pages (`error`), both written by its own build, and the agents' manual (`RobotRooms/skill.md`, beside the game's page).

## Technology Stack
- **Runtime**: Node.js with TypeScript
- **Frontend**: Three.js (3D graphics), Web Audio API (sound), React, Tailwind CSS, EJS
- **Networking**: Express.js (HTTP requests, authentication), Socket.IO (real-time communication), Fetch API (HTTP requests from the client and to external APIs), Nginx (VPS's web server)
- **AI**: MCP TypeScript SDK (the endpoint AI agents play over, Streamable HTTP), Claude through the Anthropic Messages API (the helpers' replies)
- **Database**: Firebase (Firestore, Cloud Storage, Content Distribution)
- **Build Tools**: Webpack (typescript compiler, bundler), Sharp (the game's image assets), LAME (its audio bundle)
- **Dev Tools**: Husky (git hooks), PM2 (runtime process management), GitHub (source control, workflows, and static page hosting), VS Code (IDE), Claude Code (AI assistant)
- **Tests**: Playwright (E2E tests), Vitest (Integration tests), fast-check (Property-based testing)

## Project Structure
### `/src` - Main Source Code
- **`/client`** - Client-side code (browser)
  - `/audio` - Sound (AudioManager): a clip once, or one looping or several in an endless shuffled sequence, at a fixed volume or at a world-space position heard from the camera and muffled by the walls in between; short clips cut from the one bundled file SSG builds (AudioBundleBuilder, the game's own sounds made by ProceduralSoundUtil), long ones streamed; and the one table of which gameplay or UI event sounds as what (AudioTriggerUtil)
  - `/graphics` - 3D graphics for game objects, voxels, and world-space gizmos, plus the picture of a room file's room shown before the file is loaded (RoomPreviewUtil) and the room as a mirror reflects it (MirrorReflectionUtil)
  - `/inventory` - What the user holds, as the server tells it (ClientInventoryManager), what a login earned them, shown once it can be seen (LoginRewardUtil), and buying a locked shape for their character (PlayerShapeUnlockUtil)
  - `/networking` - Client-side networking (SocketsClient for Socket.IO, RestAPI and the API clients over it)
  - `/object` - Game object management (ClientObjectManager, component system including Rigidbody, PlayerController, PeriodicTransformEmitter/Receiver)
  - `/singlePlayer` - Client-side single-player gameplay logic (SinglePlayerManager, the scripted steps of each mode in SinglePlayerModeClientConfigMap, the action/condition maps those steps are carried out through, loading a mode's room from its file, the room editor, and the helpers the browser plays where a mode plays NPCs (SinglePlayerHelperUtil))
  - `/system` - Client-side observables and state management
  - `/ui` - React UI components and styles
  - `/voxel` - Voxel management (ClientVoxelManager), plus the client-only queries about the room as drawn (ClientVoxelQueryUtil) and the pool of mesh instances the visible quads are lent (VoxelQuadInstanceUtil)
  
- **`/server`** - Server-side code (Node.js/Express)
  - `/agent` - AI agents as players (the MCP endpoint they play over, their accounts, keys, OAuth sign-in and presence, what happened in their rooms while they were away, their bodies the server walks, their tools for seeing, building, placing things, setting up their rooms and collecting and spending dollars, the camera page that shows a browser what one sees, the directory of rooms they find, and the helpers, the NPCs the server plays as AI guides in multiplayer rooms and answers for in single-player ones, with what they are told, the fixed words they chat in among themselves and say of the things they look at, and what each likes, under `data/`)
  - `/analytics` - Acquisition analytics (ServerAnalyticsManager — which traffic source a visitor came from, and how far through the funnel they got)
  - `/db` - Database utilities and types (Firestore, Firebase Storage, caching)
  - `/inventory` - What users hold (ServerInventoryManager), and the $1 bills that fill it, which the server spawns, blows about and lets people collect (DollarBillUtil, DollarBillFlightUtil)
  - `/networking` - Express.js routers and general networking utilities (e.g. address (URL) formatting, cookies, firebase-admin, and rate-limiter initialization)
  - `/object` - Server-side object management (ServerObjectManager), and the cannons and cannon balls the server plays (CannonUtil, CannonBallUtil)
  - `/room` - Game room management
  - `/sockets` - Socket.IO initializer and event handlers
  - `/ssg` - The generator of the game's static content (SSG): its error pages, and the assets it loads from the site (texture atlases, picture and room maps, pre-encoded compositions and their thumbnails, the audio bundle), with the tables in `/src` that index them. The site's own pages are built by the generator in the repository's `/ssg`, never here
  - `/system` - Server-side constants and utilities
  - `/user` - User authentication and state management
  - `/voxel` - Server-side voxel management (ServerVoxelManager)
  
- **`/shared`** - Code shared between client and server
  - `/graphics` - Shared graphics data (image maps, material params, and the instanced mesh composition system with its codecs and builders)
  - `/inventory` - Inventory types: the kinds of item a user can hold, the signals that tell them what they hold and buy with it, and which shapes are for sale (PlayerShapeItemUtil)
  - `/math` - Math utilities (vectors, geometry, etc.)
  - `/networking` - Data encoding/decoding utilities and Socket.IO signal type configs
  - `/object` - Game object types, configs, and shared update logic (ObjectUpdateUtil), how a helper walks, turns, greets, paces its speech and goes to look at things wherever it is played (HelperBehaviorUtil), and a cannon's state and aim and its ball's flight (CannonStateUtil, CannonAimUtil, CannonBallMotionUtil)
  - `/physics` - Physics engine (PhysicsManager — collision detection, hitboxes, step-up, gravity, the pushes objects give from afar in PhysicsForceUtil, and spheres swept through a room in PhysicsSphereUtil)
  - `/room` - Room types, room generation (RoomGenerationUtil — every Hub or Regular room starts out empty), room files, and the room map that catalogs the room files the game ships with
  - `/singlePlayer` - Single-player mode configs and types (SinglePlayerModeConfig — which room file a mode is played in, and who may enter it)
  - `/system` - Shared observables, constants, logging, and error handling
  - `/user` - User types
  - `/voxel` - Voxel/block system (3D world building)

### `/views` - The Game's EJS Templates
- **`/page`** - EJS page templates
  - `/development` - Development-only SSR pages
  - `/dynamic` - SSR pages served in production mode
  - `/static/error` - The error pages, which SSG writes into `../public/error`

- **`/partial/common`** - The head and foot those pages share

### `/dev` - Development Configuration
- **`/config`** - Webpack config files, tsconfig files, Nginx config files
- **`/scripts`** - Dev scripts (e.g. dev-server with hot-reloading capability, secrets injector, the composition and image map editors, the picture preparation tool, the helpers' reply, small-talk and remark samplers)
- **`/clawhub`** - The agents' manual as published on ClawHub (MIT-0): `../public/RobotRooms/skill.md` but for its license, which a test checks
- **`/plugin`** - The plugin package for agents' hosts (a Claude plugin and an Agent Plugins package in one folder): its manifests and README, which `dev/scripts/plugin/buildPlugin.js` puts together with the manual as its skill
- **`/assets`** - Full-resolution samples the image map editor keeps to remake pictures (what canvases and props show) at another size, the images of disabled entries, and the index of its source library, whose photos are gitignored (third-party photos; never shipped)

### `/docs` - Documents Explaining Technical Details
- One short page for each subsystem, all indexed in `README.md`: read the page of a subsystem before working on it.
- **`/plans`** - Dated design/planning notes, filed by year. **Historical records, not descriptions of the present — edited only with the user's approval.** See "Plan Documents Are Historical Records" below.

### `/tests` - All Tests
- **`/e2e`** - E2E test fixtures, specs, configs, and helpers (Playwright)
- **`/integration`** - Integration tests and helpers (Vitest)

## Important Files
- `README.md` - General guide to Robot Rooms and its documentation links
- `src/client/client.ts`, `src/server/server.ts` - Entrypoints of the client and server apps
- `src/shared/networking/maps/signalTypeConfigMap.ts` - Overview of signals involved in real-time (Socket.IO) communication.
- `src/shared/object/maps/objectTypeConfigMap.ts` - Overview of all types of GameObjects involved in gameplay.
- `src/client/system/clientObservables.ts` - Observables used only by the client app (for internal event handling)
- `src/shared/system/sharedObservables.ts` - Observables used by both the client and server apps (for internal event handling)
- `views/page/dynamic/mypage.ejs` - Page where the client app runs (This is where gameplay takes place). This client app authenticates the user via the server's user-API routes and makes a socket connection (game_sockets) with the server's Socket.IO instance. It is also an agent's camera (`/camera/<token>`, see AgentCameraUtil): no sign-in, the token on its socket, and only the view through the agent's eyes.
- `src/server/agent/util/agentMcpUtil.ts` - The MCP endpoint AI agents play over: its tools, and `INSTRUCTIONS`, which every agent reads on connecting.
- `../public/RobotRooms/skill.md` - The agents' manual, served at thingspool.net/RobotRooms/skill.md (Apache-2.0; `AGENT_MANUAL_URL` in the code); its ClawHub copy is `dev/clawhub/robot-rooms/SKILL.md`, and the plugin package (`dev/plugin/robot-rooms`) is built around it. `../public/skill.md`, its old address, only points to it.
- `server.json` - The endpoint's entry in the official MCP Registry (`net.thingspool/robot-rooms`), published by hand with `mcp-publisher`; its name, title and `version` are the ones the endpoint reports.

## Architecture Notes
- **Observable Pattern**: Used for state management. Each listener can subscribe to an observable and react to its state changes.
- **Optional Sign-Up**: A new person automatically joins the game as a guest, which is a temporary user profile. In order to save one's progress, the user needs to create his/her own account by selecting one of the given auth providers (Google, GitHub, Discord); no person is given a room of their own. An AI agent instead registers itself through the MCP endpoint (user type `Agent`), or its host signs in by the endpoint's own OAuth, and is known by its key; agents and their rooms are never deleted for inactivity. Detailed flows are illustrated in `docs/networking/authentication.md` and `docs/networking/agents.md`.
- **Agents Are Players Without Sockets**: An AI agent is a `UserContext` with no socket (`AgentUserContext`), kept present by the server between its MCP requests. It arrives and leaves through `UserSessionUtil` and acts only by signals encoded as a browser's and handled by `UserSignalDispatchUtil`, so rooms, managers and signal handlers never assume a socket. Helpers are NPCs, not users. Both keep up with every feature (see *Project Rules* below).
- **Separation between Static and Dynamic Pages**: Static pages (HTML files in `../public`) are being served via GitHub Pages, under the URL: `https://thingspool.net`. Dynamic pages and the server/client apps are being hosted in the VPS, under the URL: `https://app.thingspool.net` (live server) or `https://staging.thingspool.net` (staging server). During local dev test, a local URL (`http://127.0.0.1:3000`) is used to serve both static and dynamic contents.
- **Stored Formats Keep Their History Apart**: A versioned stored type (e.g. `VoxelGrid`, `ObjectGroup`) holds only its current format. Decoders for older layouts, converters and legacy constants live in a sibling `versionMigration/` directory (e.g. `VoxelGridVersionMigration`), as DB row migrations do in `src/server/db/types/versionMigration/`.

## Project Rules

The game's own rules, beside the repository's (see [`../CLAUDE.md`](../CLAUDE.md)). Each is binding as written, and its page in `../.claude/rules/` is the rule in full: the reasoning, the edge cases and the checklist. A rule's detail goes on its page, not here.

- **Room Generation Defines What a Room Is** ([`room-generation.md`](../.claude/rules/room-generation.md)): a new room-level parameter must be chosen by room generation in the same change that introduces it: `RoomGenerationUtil`, `RoomFile` and every room file shipped under `../public/app/assets/rooms`.
- **Plan Documents Are Historical Records** ([`plan-documents.md`](../.claude/rules/plan-documents.md)): a file under `docs/plans` is edited only with the user's approval, whatever its date; sweeping edits skip it.
- **Agents Keep Up With Every Feature** ([`agents-keep-up.md`](../.claude/rules/agents-keep-up.md)): when a feature is added or changed, what AI agents can do over MCP and what they are told change with it, in the same change, unasked: the tools, what they see, the endpoint's instructions, the manual, its ClawHub copy and the plugin package, and `server.json`. A version is bumped only once the one there has been published.
- **Helpers Keep Up With Every Feature** ([`helpers-keep-up.md`](../.claude/rules/helpers-keep-up.md)): when a feature is added or changed, what the helpers are told and the fixed words they say stay true to it, in the same change, unasked, in outline only: what people can do, add, unlock or buy, with the pictures of the controls for it, never how it works. Their instructions are mostly the game's maker, his writings and their subjects, not the game's mechanics. A pictured control's new look and a changed picture keyword reach them too.
- **Documentation Guidelines** ([`documentation.md`](../.claude/rules/documentation.md)): a `docs` page is a short map of one subsystem, for a developer about to work on it: terse, in the present tense, without exact numbers or internal names. `docs/plans` is outside them.
