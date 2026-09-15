# Staging Playtest Workflow

An AI-driven playtest against the deployed staging server, driven by the `staging-playtest` skill. It covers what E2E cannot: stored states that ordinary play never produces (outdated row versions, old content blobs, a large population of owned rooms) and what the server logs while real browser sessions play.

| Script | Purpose |
|---|---|
| `dev/scripts/playtest/serverMonitor.js` | log backlog survey, baseline/diff, process metrics |
| `dev/scripts/playtest/stagingAdmin.js` | seed and clean Firestore/Storage state, verify migrations and funnel |
| `dev/scripts/playtest/runPlan.js` | drive one browser session through a JSON action plan |

All output is JSON. Internal modules: `lib/dbGuard.js` (the only source of DB handles) and `generateRoomContent.js` (bundles the real generator with esbuild, from source).

## serverMonitor.js
```
node dev/scripts/playtest/serverMonitor.js history  --app staging [--top 20]
node dev/scripts/playtest/serverMonitor.js baseline --app staging
node dev/scripts/playtest/serverMonitor.js diff     --app staging
node dev/scripts/playtest/serverMonitor.js metrics
```
It reads PM2 logs over SSH. `history` surveys the existing backlog. `baseline` records log offsets, restarts and memory, and `diff` reports only what came after.
- Benign noise (scanners hitting rate limits) is separated out, not hidden.
- `needsAttention` comes from stderr (warnings and errors). `activity` comes from stdout and is context only.
- `restartsDuringWindow` > 0 means a crash or the memory ceiling was hit.

## stagingAdmin.js
```
node dev/scripts/playtest/stagingAdmin.js inspect
node dev/scripts/playtest/stagingAdmin.js seed-users      --version 0 --count 3 --run <runID>
node dev/scripts/playtest/stagingAdmin.js seed-rooms      --version 0 --count 4 --run <runID> [--owner <userID>] [--with-content]
node dev/scripts/playtest/stagingAdmin.js seed-population --version 99 --count 14 --run <runID> [--with-content] [--persist]
node dev/scripts/playtest/stagingAdmin.js set-user-type     --user <userID> --type admin|member|guest [--run <runID>]
node dev/scripts/playtest/stagingAdmin.js restore-user-type --user <userID>
node dev/scripts/playtest/stagingAdmin.js verify-migration
node dev/scripts/playtest/stagingAdmin.js verify-funnel     [--run <runID>]
node dev/scripts/playtest/stagingAdmin.js inspect-content
node dev/scripts/playtest/stagingAdmin.js downgrade-content --room <roomID> [--to 0]
node dev/scripts/playtest/stagingAdmin.js restore-content   [--room <roomID>]
node dev/scripts/playtest/stagingAdmin.js cleanup [--run <runID>] [--all]
```
- `--target staging` (default, gcloud ADC) or `--target local` (emulator). There is no live target.
- `--version` means "no newer than this" and is clamped per collection.
- **Row versions** (`DBVersionMigration`) and **content blob versions** (the leading byte, `VoxelGridVersionMigration`/`ObjectGroupVersionMigration`) are separate. `downgrade-content` refuses to cross a decoder boundary, because that would produce a corrupt blob rather than an old one. Cross-decoder migration is tested offline in `voxel-grid-migration.test.ts`.
- `seed-population` creates Members paired with their rooms. It is the only way to get owned rooms on staging, because production mode disables the dev user switch. **Pass `--with-content`**: a room without a blob cannot be entered and leaves an error in every later baseline.
- Seeded content comes from the real `RoomGenerationUtil` with per-room seeds, and the row gets the texture pack that generation chose.
- `set-user-type` promotes a guest minted through the real page (the server re-reads the user type on every request). It refuses rows that have an email and marks the row for `cleanup`. Use a plan's `sessionFile` to keep the session across the change.

## runPlan.js
```
node dev/scripts/playtest/runPlan.js <plan.json> [--out <result.json>]
```
A real browser and socket. Data assertions use the page's authenticated request context.

| Group | Actions |
|---|---|
| Session | `start`, `reload`, `waitForRoom`, `skipTutorial`, `dismissPopups`, `gotoRoom`, `whoami`, `wait`, `screenshot`, `end` |
| Data | `listRooms`, `searchRooms`, `hubEntries`, `myRoomEntry` |
| Placement | `place`, `vantage`, `look`, `pose`, `standingSpots` |
| World | `objects`, `clickObject`, `clickSurface`, `clickSurfaceUntilEnabled`, `orbit`, `zoom`, `walk`, `expectSelection` |
| UI | `enterEditMode`, `ensureEditMode`, `exitEditMode`, `uiClick`, `expectDisabled`, `click`, `fill`, `expect`, `say` |

- `start` accepts `ref` (an analytics cohort tag) and `devUser` (local dev mode only).
- `sessionFile` persists cookies between plans. It is written even when actions fail.
- `say` sends chat through the real HUD input and needs non-empty text.
- **Always `skipTutorial` before anything multiplayer.** New guests start in the tutorial, where room navigation silently does nothing.
- **Always `end`.** Otherwise the player lingers until the stale-socket sweep, which the next run reads as a bug.
- Ready-made plans are in `dev/scripts/playtest/plans/`. Artifacts go to `temp/playtest/artifacts/`.

### Automation bridges
Both are installed only on non-public deployments. **Arrange with one, act with the other.**
- `AutomationBridgeUtil` (`window.__thingspool_automation`) is **read-only**: room contents, screen positions, raycasts, selection, camera. `dev/scripts/lib/interact.js` uses it to aim real pointer gestures, so clicks run the player's code path.
- `AutomationSetupUtil` (`window.__thingspool_setup`) **only arranges**: player placement and orientation, and orbit camera angles (`dev/scripts/lib/setup.js`). A placement is exact on the client, but the server sweeps the move through collision, so never assert server positions after a `place`. Its build group (walls, textures, objects, zones, a free camera) works only in the sandbox single-player room, which exists for dev-log screenshots and is never used in playtests.

### Driving the 3D world
- The orbit camera and editing tools exist only in edit mode, which is entered through the top-bar toggle.
- `clickObject` matches by id, type or metadata (e.g. `{"objectType": "Door", "metadata": {"Label": "Attic"}}`) and walks into reach first. `expectSelection` confirms that the click landed.
- Silent failures (out of reach, occluded, covered by the HUD) are reported explicitly. Expected quirks: culled surfaces refuse selection, so candidates are tried in turn. Tapping the current selection drops it, which exits edit mode; `ensureEditMode` restores it.
- `clickSurfaceUntilEnabled` selects surfaces until a named control becomes enabled, widening the view and moving between rounds. Its report separates "nowhere valid" from "the tool is broken".
- HUD controls are `div`s with `aria-disabled`, so use `uiClick` and `expectDisabled` rather than raw DOM clicks.

## Acquisition-analytics check
The only end-to-end test of [analytics](../../devOps/analytics.md). Tag the start action as `{ "type": "start", "ref": "playtest-<runID>" }`, then run `stagingAdmin.js verify-funnel --run <runID>`.
- **The `playtest-` prefix is required**, because `cleanup` deletes cohort documents by that prefix.
- Use only `a-z0-9-_` characters, or the tag is rewritten.
- A ref counts only on the visit that creates the account, so reused sessions keep their original source.
- `verify-funnel` reports the milestones reached without passing or failing. Compare them with what the plan did. The milestone list comes from `funnelReport.js`.

## What persists between runs
| Seed | Reusable | Why |
|---|---|---|
| `seed-population` at current version with `--persist` | yes | reading does not change it |
| outdated `seed-users` / `seed-rooms` | no | the first read migrates them |
| seeded guests | no | the stale-guest sweep deletes them |
| `downgrade-content` | no | the next save re-encodes it, so always restore |

`cleanup` keeps `--persist` seeds, and `cleanup --all` removes them too.

## Rate limits
Staging enforces production limits: a per-IP request rate, and per-IP and per-IP+UA guest caps. Run at most two or three agents, reuse sessions, and give each agent its own User-Agent. `runPlan.js` paces its API calls and reports rate-limit hits separately. Those hits are self-inflicted, not server faults.

## Safety
- **No live write path exists, and none may be added.** Live and staging share a project and are separated only by a prefix.
- `lib/dbGuard.js` accepts only `staging` and `local` (it refuses `live`, `prod` and `production` by name). It returns a facade that checks every collection and storage path against the target prefix. `local` requires `FIRESTORE_EMULATOR_HOST` (an unprefixed namespace without an emulator would be live), and `staging` refuses to run when that variable is set.
- `.claude/settings.json` denies the assistant the gcloud and firebase CLI data commands.
- `serverMonitor.js --app live` is read-only. `dbGuard.js` also offers a read-only live facade limited to the `acquisition` collection.
- `cleanup` deletes only marker-stamped seeds, plus acquisition cohorts with the `playtest-` prefix. `downgrade-content` backs up the original blob and never overwrites an existing backup.
- Every command prints its target. Staging writes consume the shared Firebase quota.
