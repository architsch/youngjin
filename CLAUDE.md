# Project Overview

## Technology Stack
- **Runtime**: Node.js with TypeScript
- **Frontend**: Three.js (3D graphics), Axios (client-side HTTP requests), Socket.IO client (real-time communication), React, Tailwind CSS, EJS
- **Backend**: Express.js (HTTP requests, authentication), Socket.IO server (real-time communication), Firebase (app hosting, database, storage, load balancing, content distribution)
- **Database**: Firestore, Firebase Storage
- **Build Tools**: Webpack (typescript compiler, bundler)
- **Dev Tools**: Husky (git hooks), PM2 (process management during local dev test), GitHub (source control and static site hosting)

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
  - `/db` - Database utilities and types (Firestore, Firebase Storage)
  - `/networking` - Express.js routers and general networking utilities (e.g. address (URL) formatting, cookies, firebase-admin initialization)
  - `/room` - Game room management
  - `/sockets` - Socket.IO initializer and event handlers
  - `/ssg` - Static Site Generator (builds static pages)
  - `/system` - Server-side constants
  - `/user` - User authentication and management
  
- **`/shared`** - Code shared between client and server
  - `/localization` - Localization utilities
  - `/math` - Math utilities (vectors, geometry, etc.)
  - `/networking` - Data encoding/decoding utilities
  - `/object` - Game object types and configs
  - `/physics` - Physics engine (collision, hitboxes)
  - `/room` - Room types and generators
  - `/system` - Shared observables, constants, and logging
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

### `/dev` - Development configuration
- `/config` - Webpack configs, tsconfig files, firebase emulator config templates
- `/scripts` - Helper scripts (e.g. dev-server with hot-reloading capability)

## Important Files
- `package.json` - NPM packages and custom scripts
- `firebase.json` - Settings for Firebase App Hosting, Firestore, Firebase Storage, Firebase Emulators
- `apphosting.yaml` - Configuration for Firebase App Hosting
- `apphosting.emulator.yaml` - Configuration for Firebase App Hosting Emulator (This file is copied from one of the "dev/config" directory's "apphosting.emulator.dev(...).yaml" files, depending on which of the dev commands (in "package.json") is chosen to run)
- `src/client/client.ts` - Entrypoint of the client app
- `src/server/server.ts` - Entrypoint of the server app
- `views/page/dynamic/mypage.ejs` - Page where the client app runs (This is where gameplay takes place). This client app authenticates itself via the server's user-API routes and makes a socket connection (game_sockets) with the server's Socket.IO instance.

## Architecture Notes
- **Observable Pattern**: Used for state management. Each listener can subscribe to an observable and react to its state changes.
- **Optional Sign-Up**: A new user automatically joins the game as a guest, which is a temporary user profile. In order to save one's progress, the user needs to create his/her own account by selecting one of the given auth providers (such as Google OAuth2).
- **Separation between Static and Dynamic Pages**: Static pages (HTML files in the "public" directory) are being served via GitHub Pages, under the URL: "https://thingspool.net" (URL_STATIC). Dynamic pages and the server app are being hosted in Firebase App Hosting, under the URL: "https://app.thingspool.net" (URL_DYNAMIC). During local dev test, a local URL (such as "http://localhost:3000") is used for both.

## Application Flows

### Client-Server Connection Flow:
  1. The user sends a "/mypage" request to the server.
  2. The server authenticates the user (via UserIdentificationUtil) and returns the "/mypage" HTML document, which contains the client app's bundle.
  3. As soon as the "/mypage" HTML document loads, the client app starts to run.
  4. The client sends a socket connection request (Socket.IO) to the server.
  5. The server authenticates the client (via "authMiddleware") and establishes a socket connection.
  6. Subsequently, the server puts the client (user) in a room and then returns the room's data to the client.
  7. The client receives the room's data and initializes the game based on it.

### Client Sign-In & Sign-Up
  1. If the client (user) is playing as a guest, he/she can sign-up by selecting one of the auth providers (such as Google OAuth2).
  2. Once the external sign-in/sign-up process is over, the server creates/updates the client's user-data in Firestore.
  3. Subsequently, the server lets the client reload the browser's page (i.e. "/mypage").
  4. Once reloaded, the page runs the client app again, letting the server re-authenticate the client and re-send the room data for initialization.