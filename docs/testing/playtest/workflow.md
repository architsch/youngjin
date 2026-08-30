# Staging Playtest Workflow

An AI-driven playtest run against the deployed staging server, driven by the `staging-playtest`
skill. Where the E2E suite asks "do the core flows still work", this asks "what is this server
actually doing, and does its stored state survive contact with the code that was just deployed".

It exists for the states that ordinary play cannot produce. Everything the app writes is written
at the current schema version, so the row-migration path and its write-back are only ever
exercised by rows that predate a schema change — and the only way to get one on a real server is
to write it there directly. The same is true of a room content blob at an older binary version,
and of a world with enough member-owned rooms in it to be worth walking.

## The three tools

All of them print JSON on stdout, so an agent can consume the output directly.

| Script | Purpose |
|---|---|
| `dev/scripts/playtest/serverMonitor.js` | Survey the log backlog, baseline, diff, process metrics |
| `dev/scripts/playtest/stagingAdmin.js` | Seed and clean Firestore/Storage state; verify migration landed |
| `dev/scripts/playtest/runPlan.js` | Drive one browser session through a JSON action plan |

Two modules sit behind them and are not run directly: `lib/dbGuard.js`, which is where the
database handles come from and which decides what they may address, and `generateRoomContent.js`
with its TypeScript entry, which produces a room the way the server produces one.

### serverMonitor.js

```
node dev/scripts/playtest/serverMonitor.js history  --app staging [--top 20]
node dev/scripts/playtest/serverMonitor.js baseline --app staging
node dev/scripts/playtest/serverMonitor.js diff     --app staging
node dev/scripts/playtest/serverMonitor.js metrics
```

Reaches the VPS over SSH and reads PM2's logs at `/root/.pm2/logs/`. `history` is the
pre-playtest survey: what this server has been logging all along, which is the baseline every
later finding is compared against. `baseline` records per-file byte offsets plus PM2 restart
counts and memory; `diff` then reports only what was appended since.

Two classifications are applied, and both matter:

- **Benign noise is separated but not hidden.** A public server's error log is dominated by
  vulnerability scanners tripping the page rate limiter. Left unfiltered, every run "finds
  errors"; filtered silently, a pattern that stops being benign would never be noticed.
- **The two streams are kept apart.** `needsAttention` comes from stderr — what the logging
  utility recorded as a warning or error. `activity` comes from stdout — every DB query, every
  room save — and is context for reading an error, not a finding in itself.

`restartsDuringWindow` is the loudest signal available: a process that restarted mid-run either
crashed or hit its memory ceiling.

### stagingAdmin.js

```
node dev/scripts/playtest/stagingAdmin.js inspect
node dev/scripts/playtest/stagingAdmin.js seed-users      --version 0 --count 3 --run <runID>
node dev/scripts/playtest/stagingAdmin.js seed-rooms      --version 0 --count 4 --run <runID> [--owner <userID>] [--with-content]
node dev/scripts/playtest/stagingAdmin.js seed-population --version 99 --count 14 --run <runID> [--with-content] [--persist]
node dev/scripts/playtest/stagingAdmin.js verify-migration
node dev/scripts/playtest/stagingAdmin.js verify-funnel     [--run <runID>]
node dev/scripts/playtest/stagingAdmin.js inspect-content
node dev/scripts/playtest/stagingAdmin.js downgrade-content --room <roomID> [--to 0]
node dev/scripts/playtest/stagingAdmin.js restore-content   [--room <roomID>]
node dev/scripts/playtest/stagingAdmin.js cleanup [--run <runID>] [--all]
```

Every command takes `--target staging` (the default) or `--target local`, and prints the target
it addressed alongside its result. Staging authenticates with the local `gcloud`
application-default credentials; `local` requires the Firebase emulators. There is no live
target — see Safety.

Users and rooms carry separate schema versions, so `--version` is read as "no newer than this" and
clamped per collection — a number at or above both current versions seeds a current population,
and a row from the future, which no migration could bring back, cannot be written at all.

There are two independent versioning schemes and both can be seeded. Firestore rows carry a
`version` field migrated by the `DBVersionMigration` arrays. Room content blobs carry a leading
version byte migrated by the decoder and converter chains on `VoxelGrid` and `ObjectGroup` —
`downgrade-content` rewrites that byte, which manufactures a genuinely old blob rather than a
corrupt one **only between versions the same decoder reads**, since only those share a body layout.
Asked to cross from one decoder to another, it refuses: the rewritten header would claim a layout
the body is not written in, giving a corrupt blob rather than an old room. Migration across that
boundary is covered offline instead, by `tests/integration/scenarios/voxel-grid-migration.test.ts`
against fixtures the old encoder itself produced.

`seed-population` creates a Member account paired with the room it owns. This is the only
practical way to get member-owned rooms onto staging at all: staging runs in production mode, where
the dev OAuth bypass is disabled, so a browser session can only ever become a guest, and guests
cannot own rooms.

**`--with-content` is usually wanted.** A seeded room with no content blob cannot be entered — the
server finds no blob, logs a load failure, and falls back to a hub. That fallback is correct
behaviour, but it makes the room decorative and puts a recurring error into every later baseline.

### Seeded rooms are generated, not copied

`--with-content` runs `RoomGenerationUtil` — the same generator the server runs when a user
creates a room — and writes the same encoding the server writes. Each room is generated from its
own seed, so a seeded population varies the way an organic one does.

That is not only about realism. Generation does not merely fill a room with voxels and objects;
it decides room-level parameters that those contents were chosen to suit, the texture pack above
all, and every voxel's texture is an index into one specific pack's atlas. So the seeder writes
what generation decided onto the Firestore row rather than defaulting it. A room whose row names
one pack while its blob was built against another is a room generation could never have produced,
and testing against it is testing against a state the game cannot reach.

The generator is TypeScript with the extensionless imports the webpack build resolves, so
`generateRoomContent.js` bundles it in memory (via esbuild, already present as a test-runner
dependency) the first time it is asked for. It bundles from source rather than from `dist/`,
because the point of a generated seed is that it was built by the generator the repository
currently has.

### runPlan.js

```
node dev/scripts/playtest/runPlan.js <plan.json> [--out <result.json>]
```

Runs a real browser with a real socket connection, so the server sees a genuine concurrent
player. Assertions about data go through the page's own authenticated request context — the
same session and cookies as the UI, without depending on clicking anything.

Actions: `start`, `waitForRoom`, `skipTutorial`, `gotoRoom`, `listRooms`, `searchRooms`,
`hubEntries`, `myRoomEntry`, `say`, `screenshot`, `wait`, `end`.

`say` sends a chat message through the HUD's own input and send button. It is the one
player-to-player action reachable without aiming at the 3D scene, and therefore the only one a plan
can drive. It is also the only way to exercise the chat path at all: a message travels as a change
to the speaker's own player object's metadata, so nothing offline proves a real one leaves the
browser. An empty message is ignored by the client in a multiplayer room, so the text is required.

`start` takes an optional `ref`, which is appended to the address as the query tag the server reads
to attribute a visitor to a traffic source. See the acquisition-analytics check below.

Two are easy to omit and expensive to omit:

- **`skipTutorial` before anything multiplayer.** A newly created guest starts in the
  single-player tutorial. Until it leaves, navigating to a room ID appears to succeed while the
  client stays put, so every room-list and room-entry check silently tests nothing.
- **`end` at the finish.** It disconnects the socket explicitly. Without it the player lingers
  in the room until the stale-socket sweep notices, which the next run reads as a bug.

Screenshots and failure screenshots are written under `temp/playtest/artifacts/`.

## The acquisition-analytics check

A playtest drives real guests through the real page, so it moves the funnel the server records —
arriving, leaving the tutorial, entering a room. That makes a playtest the only place the analytics
path runs end to end: a browser, the server, and the database it writes through. Nothing offline
covers that seam, because the ref tag is read off a real request. See
[Acquisition Analytics](../../devOps/analytics.md) for what is being recorded and why.

Tag the run's `start` action so its visitors form a cohort of their own rather than mixing with
staging's ordinary traffic:

```json
{ "type": "start", "ref": "playtest-<runID>" }
```

Then read it back once the plan has finished:

```
node dev/scripts/playtest/stagingAdmin.js verify-funnel --run <runID>
```

Three things decide whether this works:

- **The `playtest-` prefix is required, not cosmetic.** `cleanup` deletes cohort documents on that
  prefix alone, so a tag without it is indistinguishable from real traffic and will be left behind
  in the counters permanently.
- **The tag must be written in `a-z`, `0-9`, `-`, `_`.** The server rebuilds a ref tag rather than
  trimming it, so anything else is silently dropped and the cohort ends up under a different name
  than the one the plan sent — or under `direct`, if nothing survives.
- **A `ref` only counts on the visit that mints the account.** Attribution is first-touch, so a
  session reused from an earlier run keeps whatever source it originally arrived with, and tagging
  a later navigation records nothing.

`verify-funnel` reports which milestones the cohort reached and which it did not. It deliberately
does not pass or fail: which milestones *should* be there depends on what the plan did, and a plan
that never left the tutorial is not a broken funnel. Compare it against the actions the plan ran.

The milestones it names come from `dev/scripts/analytics/funnelReport.js`, which is the same table
the reporting tool uses, so there is one list in the tooling rather than two that can disagree.

## What persists between runs

| Seed | Reusable | Why |
|---|---|---|
| `seed-population` at the current version, with `--persist` | Yes | Reading it does not change it, so a stable population stays the same world between runs. |
| `seed-users` / `seed-rooms` at an outdated version | No | Single-use by nature — the first read migrates the row and writes it back at the current version, after which it is no longer the fixture the test needed. |
| Seeded guests | No | The server's own stale-guest sweep deletes them on its schedule regardless. |
| `downgrade-content` | No | Allowed only within one decoder's versions. The next room save re-encodes the blob at the current version. Always restore afterwards. |

`cleanup` keeps `--persist` seeds; `cleanup --all` removes them too.

## Rate limits shape the run

Staging runs in production mode, so the production ceilings apply: a per-minute request cap per
IP covering both page and API routes, and hourly caps on guest creation scoped per IP and per
IP+User-Agent together. Every agent on one machine shares that IP.

The consequences are practical. Two or three concurrent agents, not a swarm. Sessions get
reused rather than creating fresh guests. Each agent gets a distinct User-Agent, or they share
one guest quota. `runPlan.js` paces its own API calls and reports rate-limit hits separately —
a non-zero count is self-inflicted and has to be reported as such rather than as a server fault.

## Safety

Direct database writes are confined to staging and the local emulator. There is no live write
path in this tooling and none is to be added.

Live and staging share one Firebase project and one storage bucket, separated only by a
collection-name prefix. Which database is being addressed therefore comes down to a string
comparison, which is the kind of thing that goes wrong quietly — so it is guarded in three
places, of which only the first holds without anybody remembering it.

**`dev/scripts/playtest/lib/dbGuard.js` is the only place a playtest script obtains a Firestore
or Storage handle.** It resolves `--target`, which accepts `staging` and `local` and nothing
else: `live`, `prod` and `production` are refused by name, and any other value is unknown. What
it returns is a facade rather than the SDK's own objects, and it checks every collection name and
every storage path against the target's prefix before that name reaches the SDK. A
`CollectionReference` handed back stays inside its own collection through every query and
document it produces, which is what makes checking the name once sufficient.

The `local` target requires `FIRESTORE_EMULATOR_HOST`, and refuses to run without it. This is the
inversion worth being deliberate about: local and live are both unprefixed, so an unprefixed
namespace with no emulator behind it is not local — it is live, and it would look correct in
every log line. Conversely `staging` refuses to run *with* the emulator variables set, so a
command believed to be seeding staging cannot quietly seed the emulator instead.

**`.claude/settings.json` denies the gcloud and firebase CLI subcommands** that could reach live
data without going through Node at all — `gcloud firestore`, `firebase firestore`, and the
storage copy/remove commands. These are denials for the assistant, not for the developer; any of
them remains available in a terminal, which is the intent, since an irreversible operation on
production data should be a deliberate human act.

**`serverMonitor.js --app live` is read-only.** It tails PM2's logs over SSH and writes nothing.
Comparing live's backlog against staging's is genuinely useful, so that path stays.

One read-only exception exists and is confined to one collection. The question of which traffic
sources bring people who stay can only be answered where the audience is, which is live, so
`dbGuard.js` also offers a read-only path that accepts `live` as a target. What it returns exposes
reads and hands back plain data — no document reference, no batch, no route back to the SDK — and
it may name only the aggregate acquisition counters, which hold counts per traffic source and
nothing belonging to any one person. The users collection is not readable through it, and the write
path above still refuses `live` by name.

Beyond the target boundary: `cleanup` deletes only documents carrying the marker field the seeder
stamps on its own seeds, so organic data cannot be removed by it, and `downgrade-content` copies
the original blob aside before touching it and never overwrites an existing backup. Acquisition
cohort documents are the one thing `cleanup` selects differently — they carry no marker, since the
server rather than the seeder writes them — and there it deletes only documents whose traffic
source begins with the reserved `playtest-` prefix.

Every command prints the target it addressed, so which namespace was touched is never something
the reader of a report has to infer. Staging's writes draw on the same Firebase quota as
production traffic.
