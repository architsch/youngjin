---
name: staging-playtest
description: Run an AI-driven playtest and server-health investigation against the deployed staging server — survey the existing error backlog, seed database states that ordinary play cannot produce (outdated row versions, a large population of room owners), drive concurrent browser sessions against it, and correlate everything against the staging server's logs and process metrics. Use after deploying to staging, when asked to playtest staging, verify a deployment, hunt for server-side errors, or check whether a fix actually took effect on a real server.
---

# Staging Playtest

Verifies a deployment the way local tests cannot: against the real server, the real Firestore,
and the real network, with several clients connected at once.

The point is **not** to re-test what a human can try in a minute. Walking around, placing a
voxel, dragging an object — the user does that faster themselves. This exists for the states
that are genuinely hard to produce by hand:

- Rows sitting at an **outdated schema version**, which drive the migration and write-back path.
  Nothing the app writes is ever outdated, so only direct seeding creates them.
- **Room content blobs at an older binary version**, which drive the VoxelGrid decoder chain.
  These are found rather than made — see Step 3.
- A **large population of room owners**, which drives room-list pagination, search and the
  denormalized owner name. Staging runs in production mode, so the dev OAuth bypass is off and
  a browser session can only ever become a guest — twenty owners means twenty Google accounts,
  or one seeding command.
- **Concurrency** — several real clients in one room at once.
- **A whole client run, watched** — page errors, failed asset requests and what actually rendered,
  across a room load and a mode change, which a human notices only if they happen to be looking.

## Roles

Run these as parallel subagents when the user asks for multiple agents; otherwise do them in
sequence yourself. Either way the division of labour is the same:

| Role | Does | Tool |
|---|---|---|
| **Admin** | Seeds and cleans DB/storage state; verifies migration and the acquisition funnel landed | `dev/scripts/playtest/stagingAdmin.js` |
| **Playtester** (1–3) | Drives real browser sessions, checks room list/search/navigation | `dev/scripts/playtest/runPlan.js` |
| **Monitor** | Surveys the log backlog, baselines, diffs, watches process metrics | `dev/scripts/playtest/serverMonitor.js` |

All three print JSON on stdout.

## Step 1 — Survey what is already broken

Always first, before seeding or driving anything. A public server's error log is full of
weather — vulnerability scanners, deprecation notices, sockets replaced on refresh — and an
agent reading it cold will "find errors" every time and report them as regressions.

```
node dev/scripts/playtest/serverMonitor.js history --app staging --top 20
```

Read `needsAttention` and treat it as the **pre-existing backlog**. Anything appearing there is
not a finding of this playtest; it is the baseline to compare against. Report it separately, and
say how long it has been happening (`perFile` gives per-day line counts).

Also confirm what is actually deployed before drawing conclusions about a fix:

```
curl -s https://staging.thingspool.net/health
git -C . rev-parse --short HEAD
node dev/scripts/playtest/serverMonitor.js metrics
```

The health endpoint names the build the process is running, in one request that costs no guest
and no page load. If it does not match the local HEAD, the fix under test is **not on the
server** — say so and stop rather than reporting a fix as verified or as failed. (The same
commit reaches the client as `window.thingspool_env.gitCommit`, which a `start` action reports;
a page whose commit has fallen behind the server's reloads itself, so a run started across a
deployment can lose a session mid-plan.)

`metrics` is worth reading for `uptimeMs` as well as health: a staging process that came up
minutes ago is the deployment under test, while one that has been up for days means the deploy
never landed.

## Step 2 — Baseline

```
node dev/scripts/playtest/serverMonitor.js baseline --app staging
```

Records per-file log byte offsets plus pm2 restart counts and memory. Every later `diff` reports
only what was appended after this point. Re-baseline between phases when you want to attribute
errors to one specific phase.

## Step 3 — Seed the states worth testing

```
# Rows the migration path has to handle. Single-use — see below.
node dev/scripts/playtest/stagingAdmin.js seed-users  --version 0 --count 3 --run <runID>
node dev/scripts/playtest/stagingAdmin.js seed-rooms  --version 0 --count 4 --run <runID> --owner <userID> --with-content

# A population of room owners, for room-list pagination and search.
# Users and rooms carry separate schema versions; --version is read as "no newer than this",
# so a number at or above both collections' current version seeds a current population.
node dev/scripts/playtest/stagingAdmin.js seed-population --version 99 --count 14 --run <runID> --with-content --persist

# What binary version each room's content blob is actually stored at.
node dev/scripts/playtest/stagingAdmin.js inspect-content
```

Every command takes `--target staging` (the default) or `--target local`, and prints the target
it addressed. There is no live target — see Safety.

Four things to get right:

- **`--with-content` matters.** A seeded room with no content blob is listed but cannot be
  entered: the server logs a load failure and falls back to a hub. That fallback is correct
  behaviour, but the room is decorative, and the recurring error pollutes later baselines.
- **Seeded content comes from `RoomGenerationUtil`, and that is the point.** Each room is
  generated from its own seed by the same code path that runs when a user creates a room, so a
  seeded population comes out as varied as an organic one — different layouts, different texture
  packs, a different number of hung canvases. It also means the row carries the parameters
  generation actually decided rather than a default the seeder picked; a room whose row names
  one texture pack while its voxels index another pack's atlas is a room the game could never
  have produced, and testing against it is testing against an unreachable state.
- **Seeding several stale rooms that share one owner is the interesting case.** Each room's
  v0→v1 migration looks the owner up, so N stale rooms fire N concurrent reads of one user
  document — the contention that a single-document test never reproduces.
- **A seed below the current version carries a copy of its own key as a field**, because that is
  what the last migration step on both collections exists to drop. Whether the row came back
  current is only half the assertion; `verify-migration` also reports whether that copy survived
  in storage, which is what a write-back storing the row as the reader had it would leave behind.

### The VoxelGrid decoder chain is no longer seedable at the current version — read it, do not manufacture it

`downgrade-content` rewrites byte 0 of a room's content blob and nothing else. That is a legitimate
way to manufacture an old room only between versions that share a body layout, and the current
version does **not** share one with the versions before it — it encodes each voxel differently. A
blob whose header was flipped across that boundary describes itself with one layout and is written
in another. The server does not read that as an old room; it reads it as a corrupt one, and anything
it then logs is a fact about a corrupt blob rather than about the migration path.

The tool now refuses that case rather than writing it: a downgrade across a change of decoder exits
with an error naming both decoders, and only a downgrade within one is carried out. So you cannot
manufacture the current version's migration path, and you no longer have to remember not to.

What replaces it costs nothing, because staging supplies it for free. **A room that has not been
saved since the format changed is still stored at the old version**, which makes it a genuine
fixture that no seeding could produce. So:

- Run `inspect-content` early — before anything enters a room — and write down every room whose
  `voxelGridVersion` is below the current one. That list only ever shrinks: the first save after a
  room is entered re-encodes it at the current version, and the fixture is spent.
- Entering one of those rooms **is** the migration test. Watch it in the log diff and in the
  client's own screenshot: a room that decodes wrong renders wrong, and the screenshot is the
  clearer evidence of the two.
- Once `inspect-content` reports nothing below the current version, this path has no live coverage
  on staging at all. Say so in the report rather than leaving it unmentioned. It is covered offline
  instead, by `tests/integration/scenarios/voxel-grid-migration.test.ts` against the recorded
  fixtures in `tests/integration/fixtures/legacyVoxelGrids/`, and that suite — not this one — is
  where a regression in it would surface.

### What persists and what does not

| Seed | Reusable? | Why |
|---|---|---|
| `seed-population` at the current version | **Yes** — use `--persist` | Reading it does not change it. A stable population makes pagination deterministic between runs. Check `inspect` reports it as `outdated: 0`; if not, the schema moved and the fixture is now single-use. |
| `seed-users` / `seed-rooms` at an outdated version | **No** | Single-use by nature: the first read migrates the row and writes it back at the current version, after which it is no longer the fixture the test needed. Re-seed every run. |
| Seeded guests (`userType` 2) | **No** | The server's own hourly stale-guest sweep deletes them regardless of intent. |
| `downgrade-content` | **No** — and only within one decoder | Refused outright across a change of decoder (see above). Where it is allowed, the next room save re-encodes the blob at the current version, so it is single-use. Always `restore-content` afterwards. |
| A room already stored below the current version | **No** | Single-use, and not seeded at all — it is left over from before the format changed. The first save after it is entered spends it. |

## Step 4 — Drive the clients

Write a plan, run it, read the result, write the next plan informed by what happened. Do not try
to drive the browser one click at a time.

```json
{
  "agent": "explorer-1",
  "actions": [
    { "type": "start", "ref": "playtest-<runID>" },
    { "type": "waitForRoom" },
    { "type": "skipTutorial" },
    { "type": "dismissPopups" },
    { "type": "screenshot", "name": "hub" },
    { "type": "enterEditMode" },
    { "type": "screenshot", "name": "edit-mode" },
    { "type": "exitEditMode" },
    { "type": "listRooms", "page": 0 },
    { "type": "searchRooms", "query": "Playtest" },
    { "type": "gotoRoom", "roomID": "<seeded room>" },
    { "type": "waitForRoom" },
    { "type": "dismissPopups" },
    { "type": "screenshot", "name": "seeded-room" },
    { "type": "end" }
  ]
}
```

```
node dev/scripts/playtest/runPlan.js <plan.json> --out <result.json>
```

Non-obvious things that will otherwise waste a run:

- **`skipTutorial` is mandatory before anything multiplayer.** A newly created guest starts in
  the single-player tutorial. Until it leaves, `gotoRoom` appears to succeed while the client
  stays in the tutorial, so every room-list and room-entry check silently tests nothing.
- **`dismissPopups` after every arrival.** Arriving somewhere opens a welcome popup the first
  time — one for the hub, another for the user's own room. They cover the screen, so a
  screenshot taken behind one photographs the popup instead of the room, and a click aimed at
  the HUD lands on the backdrop. The action reports what it dismissed, so an unexpected popup
  is itself a finding.
- **`end` is mandatory.** Closing without it leaves a ghost player in the room until the stale
  socket sweep notices, which the next run reads as a bug.
- **Give each agent a distinct `userAgent`.** Guest creation is capped per IP *and* User-Agent
  together, so agents sharing a string share one small quota.
- **`ref` on `start` puts this run's guests in their own acquisition cohort**, which is what makes
  Step 5's funnel check readable. It must begin with `playtest-` and be written in `a-z0-9-_`; see
  that step.
- Assertions about data go through the page's own authenticated request context — same session,
  same cookies, no clicking.

### What can be driven, and what cannot

HUD controls carry stable element ids, so they are driven for real: `enterEditMode` and
`exitEditMode` press the mode's own buttons and check the mode arrived with the user's character
selected under it, which is the whole game-mode crossing — orbit camera, player selection, the
controls that come with it. `click` and `expect` take a selector straight from the plan, for UI
this harness does not name; putting the selector in the plan rather than in the harness is
deliberate, since a plan is written fresh each round and a baked-in selector goes stale silently.

`say` sends a chat message through the HUD's input and send button. It is worth knowing that this
is the *only* player-to-player action a plan can drive, and the only way to exercise the chat path
at all — a message travels as a change to the speaker's own player object, so nothing offline proves
a real one leaves the browser.

Anything reached by **aiming at the 3D scene** is not driven: placing or texturing a voxel,
dragging an object, and the door that opens the room-list popup all sit wherever the generated
room put them. That leaves the room *write* path — an edit dirtying a room until the save loop
picks it up — outside what a plan can reach, and it is the largest gap. Say so in the report
rather than letting a clean run imply it was covered. It also means the funnel's `built` milestone
cannot be reached by a plan, while `chatted` can.

### Reading the client's side of the run

Four things come back per agent and all four are findings, not decoration:

- `pageErrors` / `consoleErrors` — an uncaught exception during a room load is a client bug the
  server log will never show.
- `failedRequests` — same-origin requests that failed or came back 4xx/5xx. This is how a
  deployment that shipped a bundle asking for an asset it did not carry shows itself; nothing
  else in the run notices, because the page still loads and the missing thing is simply not drawn.
- `screenshot.bytes` — a rendered 3D scene is a photograph and cannot compress small. A few KB
  means a blank or single-colour frame.
- The screenshots themselves. **Read them.** They are the only check on whether the thing that
  rendered was the right thing, and rendering is where most recent regressions live.

**There is no GPU here.** The browser falls back to a software rasterizer, and the game runs at a
couple of frames per second in it — the debugger's FPS reading is a fact about this machine, not
about the build, and shrinking the viewport barely moves it, so it is not a fill-rate story
either. Two consequences. Never report that frame rate as a performance finding. And treat
anything whose appearance depends on *how long* something took — a push that should resolve in
half a second, a transition, an animation caught mid-way — as unmeasurable here: at this frame
rate a moment stretches into tens of seconds, and a screenshot of it is not evidence of a bug.
Set `"viewport"` on the plan to test a phone-shaped screen, which is what it is genuinely for.

### Rate limits shape the whole run

Staging runs in production mode. **20 requests per minute per IP** for both pages and API, and
every agent on this machine shares one IP. Guest creation is capped at **10 per IP per hour** and
**3 per IP+User-Agent per hour**.

So: 2–3 agents, not a swarm. Reuse sessions instead of creating guests. `runPlan.js` paces its
own API calls and reports `rateLimitHits` separately — a non-zero count is self-inflicted, not a
server fault, and must be reported that way.

## Step 5 — Correlate

```
node dev/scripts/playtest/serverMonitor.js diff --app staging
node dev/scripts/playtest/stagingAdmin.js verify-migration
node dev/scripts/playtest/stagingAdmin.js verify-funnel --run <runID>
```

`diff` separates the two streams deliberately: `needsAttention` comes from stderr (what LogUtil
logged as a warning or error), while `activity` comes from stdout (every DB query, every room
save) and is context, not findings. `restartsDuringWindow` is the loudest possible signal — a
process that restarted mid-run either crashed or hit its memory ceiling.

`verify-migration` is the assertion that seeding exists to make: a seeded row should have
advanced to the current version **in storage**, not merely in the reply the client received. A
row still at its seeded version after the server has read it means the write-back silently
failed — the data is correct for the caller and permanently wrong on disk, so every subsequent
read re-migrates it forever.

`verify-funnel` covers the one path nothing offline can. The server records where each visitor came
from and how far they got, and the source is read off a real request — so a browser, the server and
the database it writes through are all needed at once, which is only true here. It reports which
milestones the run's cohort reached and which it did not, and deliberately does not pass or fail:
which ones *should* be there depends on what the plan did, and a plan that never left the tutorial
is not a broken funnel. Read it against the actions that ran — a plan with `start`, `skipTutorial`
and `gotoRoom` should show arrived, tutorialDone and enteredRoom.

An empty cohort when the plan ran fine is worth chasing rather than shrugging at, and there are only
three causes: the tag was not written in `a-z0-9-_` and the server rebuilt it into something else,
the session was reused from an earlier run so first-touch attribution kept the original source, or
the deployed build predates the analytics and is not recording at all. `curl -s
https://staging.thingspool.net/health` settles the third.

## Step 6 — Clean up, then report

```
node dev/scripts/playtest/stagingAdmin.js restore-content
node dev/scripts/playtest/stagingAdmin.js cleanup --run <runID>       # keeps --persist seeds
node dev/scripts/playtest/stagingAdmin.js cleanup --all               # removes them too
```

Report in this order, and keep the categories apart — collapsing them is the main way this kind
of report misleads:

1. **New** — in the diff, absent from the Step 1 backlog. The actual findings.
2. **Pre-existing** — in the backlog too. Note the rate; a jump in rate is itself a finding.
3. **Self-inflicted** — rate limiting, guest-cap refusals, errors caused by seeded state that is
   deliberately invalid. Name them so they are not mistaken for defects.
4. **Verified** — what demonstrably worked, with the evidence (migration versions advanced,
   pagination totals, zero fallbacks, screenshots).

State plainly what was *not* covered — at minimum the 3D-aimed interactions and the room write
path they gate (see above), and anything the run had to skip.

## Safety

**Direct database writes are confined to staging and the local emulator. There is no live write
path, and none is to be added.** Live and staging share one Firebase project and one storage
bucket, separated only by a collection-name prefix, so which database is being addressed comes
down to a string comparison — and that is guarded in three places:

1. **`dev/scripts/playtest/lib/dbGuard.js`** is the only place a playtest script obtains a
   Firestore or Storage handle. It resolves `--target staging|local` (`live`, `prod` and
   `production` are refused by name, and no third target exists), and returns handles that check
   every collection name and every storage path against that target's prefix before it reaches
   the SDK. `local` demands the emulator environment variables, because an unprefixed namespace
   with no emulator is not local — it is live.
   **A playtest script must never construct its own `admin.firestore()`.**
2. **`.claude/settings.json`** denies the gcloud and firebase CLI subcommands that could reach
   live data without going through Node at all. These are denials for the assistant only; the
   developer runs them in a terminal as before.
3. **`serverMonitor.js --app live` is read-only** — it tails PM2's logs over SSH and does not
   write. It exists because comparing live's backlog against staging's is useful.

Beyond the target boundary:

- `cleanup` deletes only documents carrying the marker field the seeder stamps on its own seeds.
  It cannot delete organic data. Acquisition cohort documents are the exception to *how* rather
  than to whether: the server writes them, so they carry no marker, and `cleanup` selects them by
  the reserved `playtest-` prefix on their traffic source instead. That is the whole reason the
  prefix is mandatory — a run tagged without it leaves counts behind that cannot be told from real
  visitors and so are never removed.
- `downgrade-content` copies the original blob aside before touching it, and never overwrites an
  existing backup; `restore-content` puts it back and is also run by `cleanup`.
- Every command reports the target it addressed, so which namespace was touched is never
  something the reader of a playtest report has to infer. Quote it in the report.
- **A hub is editable by anybody standing in it**, guests included, so an edit made during a
  playtest is a lasting change to a room every staging visitor arrives in. That is acceptable on
  staging and nowhere else, and it is a change to report rather than one to make in passing.
- Staging's writes draw on the same Firebase quota as production traffic. Prefer `--persist`
  over reseeding a large population each run.
