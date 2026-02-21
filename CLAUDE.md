# Project Overview

## Technology Stack
- **Runtime**: Node.js with TypeScript
- **Frontend**: Three.js (3D graphics), Axios (client-side HTTP requests), Socket.IO client (real-time communication), React, Tailwind CSS, EJS
- **Backend**: Express.js (HTTP requests, authentication), Socket.IO server (real-time communication), Firebase (database, file storage, content distribution), Nginx (VPS's web server)
- **Database**: Firestore, Firebase Storage
- **Build Tools**: Webpack (typescript compiler, bundler)
- **Dev Tools**: Husky (git hooks), PM2 (runtime process management), GitHub (source control, workflows, and static page hosting), Playwright (E2E tests), VS Code (IDE), Claude Code (AI assistant)

## Project Structure
### `/src` - Main Source Code
- **`/client`** - Client-side code (browser)
  - `/graphics` - 3D graphics for game objects and voxels
  - `/networking` - Client-side networking (Socket.IO, Axios)
  - `/object` - Game object management
  - `/system` - Client-side observables and state management
  - `/ui` - React UI components and styles
  - `/voxel` - Voxel management
  
- **`/server`** - Server-side code (Node.js/Express)
  - `/db` - Database utilities and types (Firestore, Firebase Storage, caching)
  - `/networking` - Express.js routers and general networking utilities (e.g. address (URL) formatting, cookies, firebase-admin, and rate-limiter initialization)
  - `/room` - Game room management
  - `/sockets` - Socket.IO initializer and event handlers
  - `/ssg` - Static Site Generator (builds static pages)
  - `/system` - Server-side constants
  - `/user` - User authentication and state management
  
- **`/shared`** - Code shared between client and server
  - `/localization` - Localization utilities
  - `/math` - Math utilities (vectors, geometry, etc.)
  - `/networking` - Data encoding/decoding utilities and Socket.IO signal type configs
  - `/object` - Game object types and configs
  - `/physics` - Physics engine (collision, hitboxes)
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
- **`/devOps`** - E2E, Local Development, VPS
- **`/networking`** - HTTP/Socket/Authentication Flows

### `/e2e` - E2E Test Fixtures, Specs, Configs, and Helpers

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
- **Separation between Static and Dynamic Pages**: Static pages (HTML files in the "public" directory) are being served via GitHub Pages, under the URL: `https://thingspool.net`. Dynamic pages and the server/client apps are being hosted in the VPS, under the URL: `https://app.thingspool.net` (live server) or `https://staging.thingspool.net` (staging server). During local dev test, a local URL (`http://localhost:3000`) is used to serve both static and dynamic contents.