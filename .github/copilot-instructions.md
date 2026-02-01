# Copilot Instructions for ThingsPool Codebase

## Project Overview
**ThingsPool** is a full-stack Node.js/React multiplayer voxel-based application with real-time networking via Socket.io. It's deployed on Firebase App Hosting with Firestore backend and uses static site generation (SSG) for content.

**Key Stack**: TypeScript, Express, React, Webpack, Socket.io, Firebase (Firestore, Storage, Auth), Tailwind CSS

---

## Architecture & Data Flow

### Monorepo Structure
```
src/
├── client/         # React app compiled to public/app/bundle_v2.js
├── server/         # Express server compiled to dist/server/bundle.js
└── shared/         # Shared types, utilities used by both (voxel, physics, room models, etc)
```

### Build Pipeline
1. **Client**: `src/client/client.ts` → Webpack → `public/app/bundle_v2.js`
2. **Server**: `src/server/server.ts` → Webpack → `dist/server/bundle.js`
3. **CSS**: `src/client/ui/style/input.css` → Tailwind CLI → `public/app/style_v2.css`
4. **SSG**: Server generates static HTML pages (controlled by `MODE=ssg` or `SKIP_SSG` env var)

### Runtime Communication
- **Client ↔ Server**: Socket.io for real-time game events (see `src/client/networking/client/gameSocketsClient.ts` and `src/server/sockets/gameSockets.ts`)
- **Server ↔ Firestore**: Firebase Admin SDK (v13.6.0)
- **Client ↔ Server**: Express HTTP for routing, EJS templating

### Database Schema
Primary collections in Firestore (`firestore.rules` defines access control):
- `rooms`: Room metadata + indexed room types (see `DBRoomUtil.createRoom()`)
- Room content stored in Firebase Storage as binary-encoded buffers (see `DBFileStorageUtil`)
- User data via Firebase Auth + custom Firestore fields

### Encoding/Decoding
Critical to understand: Room voxel grids and persistent objects use **custom binary encoding**:
```typescript
// In DBRoomUtil.saveRoomContent():
const bufferState = EncodingUtil.startEncoding();
room.voxelGrid.encode(bufferState);
room.persistentObjectGroup.encode(bufferState);
```
Shared types in `src/shared/` define encode/decode patterns. **Always preserve encoding compatibility when modifying shared types.**

---

## Development Workflows

### Quick Start
```bash
npm install
npm run dev  # Starts Firebase emulators + dev server with watch mode
```

### Dev Mode Variations (env flags in devRunner.js)
- `npm run dev` — Full rebuild (CSS, client, server, SSG)
- `npm run devcss` — CSS only (skip TS compilation)
- `npm run devclient` — Skip server & SSG (faster)
- `npm run devserver` — Skip client & CSS (faster)
- `npm run devnossg` — Skip SSG generation

### Building for Production
```bash
npm run build              # Webpack bundles (minified)
npm run beforeCommit       # Builds + generates SSG, then verifies bundles are production code
npm start                  # Run production bundle (requires dist/server/bundle.js)
```

### Verification
`checkBeforeCommit.js` enforces production bundles (minified). Fails on development builds.

### Debugging
- **Firestore**: `npm run debugFirestore` (requires Google Cloud credentials)
- **Dev Server**: Runs on port 3000, Firestore emulator on 8080, UI on 4000

---

## Code Patterns & Conventions

### Database Queries
Use `DBQuery` wrapper (src/server/db/types/dbQuery.ts):
```typescript
const result = await new DBQuery<DBRoom>()
    .select()
    .from("rooms")
    .where("id", "==", roomID)
    .run();
```
Returns `{ success: boolean, data: T[], error?: string }` — **always check `result.success`**.

### Utility Patterns
Database operations return standardized responses:
```typescript
interface DBQueryResponse<T> { success: boolean; data?: T; error?: string; }
```
Example: `DBRoomUtil.createRoom()` returns `DBQueryResponse<{id: string}>`.

### Observable Pattern
Client uses observables for reactive state (e.g., `roomRuntimeMemoryObservable` in `src/client/system/clientObservables.ts`). Listeners are added via `.addListener(event, callback)`.

### Socket.io Event Types
- **Game events**: Real-time room updates (see `src/server/sockets/gameSockets.ts`)
- **Console events**: Developer console (see `src/server/sockets/consoleSockets.ts`)
- Messages defined in `src/shared/networking/` types

### Shared Types
All cross-boundary types live in `src/shared/`. Critical types:
- `Room` — root game world data
- `RoomRuntimeMemory` — ephemeral runtime state
- `VoxelGrid` — 3D block data with custom encoding
- `PersistentObjectGroup` — game objects
- `User`, `UserProfile` — authentication & account data

---

## Environment Variables
Set in `apphosting.yaml` (prod) or `.env`/shell (dev):
- `MODE`: "dev" | "prod" | "ssg" (controls server behavior)
- `SKIP_SSG`, `SKIP_CLIENT_COMPILE`, `SKIP_SERVER_COMPILE`, `SKIP_CSS_COMPILE` (dev optimization flags)
- `JWT_SECRET_KEY`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` (required at runtime)
- `GCLOUD_PROJECT`, `FIRESTORE_EMULATOR_HOST`, `FIREBASE_STORAGE_EMULATOR_HOST` (emulator-specific)

---

## Key Files to Know
| File | Purpose |
|------|---------|
| `src/server/server.ts` | Express setup, middleware, SSG trigger |
| `src/client/client.ts` | Client initialization, listeners |
| `src/server/db/util/dbRoomUtil.ts` | Room CRUD with encoding |
| `src/server/sockets/gameSockets.ts` | Real-time room updates |
| `src/shared/room/types/room.ts` | Room data model |
| `build/webpack.config.*.js` | Compilation config for client/server |
| `devRunner.js` | Hot-reload orchestration |
| `firebase.json` | Firebase project config & emulator setup |

---

## Common Tasks

### Adding a Database Field
1. Update the Firestore document type in `src/shared/` or `src/server/db/types/row/`
2. If the field is encoded in binary (e.g., voxel data), update `encode()` and `decode()` methods in the relevant shared type
3. Test with `npm run devnossg` to avoid SSG overhead during development
4. Verify existing data migration if adding required fields

### Adding a Socket Event
1. Define event type in `src/shared/networking/types/`
2. Add handler in `src/server/sockets/gameSockets.ts` (server) or `gameSocketsClient.ts` (client)
3. Emit with `socket.emit("eventName", payload)`

### Deploying to Production
1. Run `npm run beforeCommit` locally to verify production bundles
2. Commit to main branch
3. Firebase App Hosting auto-deploys from git (see `firebase.json` backend config)
4. Monitor via Firebase Console

---

## Testing & Validation
- No automated test framework currently configured
- Manual testing via dev server (localhost:3000)
- Firebase emulator UI available at localhost:4000
- Use `checkBeforeCommit.js` to catch non-minified bundles before commit

---

## Notable Dependencies
- **Express 4.21**: HTTP server framework
- **React 19**: UI framework
- **Webpack 5**: Module bundler for client & server
- **Firebase Admin 13.6**: Firestore, Storage, Auth backend
- **Socket.io 4.8**: Real-time bidirectional communication
- **Three.js 0.180**: 3D graphics (likely for voxel rendering)
- **Tailwind CSS 4.1**: Utility-first CSS
- **TypeScript 5.8**: Static typing
