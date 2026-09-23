# Acquisition Analytics

Reference: @src/server/analytics/serverAnalyticsManager.ts , @dev/scripts/analytics/funnelReport.js

Server-side, first-party measurement of **what visitors from each traffic source went on to do**, so sources can be compared by retention rather than by arrivals. This is separate from Google Analytics on the static pages.

## Attribution
- Promoted links carry `?ref=<tag>` (e.g. `https://app.thingspool.net/?ref=reddit-webgames`).
- The static site carries a visitor's first `ref` of the session onto its links into the app (`views/partial/common/footer.ejs`), so a tagged dev-log post is attributed as well.
- **First-touch**: the tag is stored only when a new account is created for the visitor.
- Crawlers, scanners, link-preview fetchers, scripted clients and requests with no User-Agent get no account (`BotDetectionUtil`), so they never count as arrivals. Fetchers posing as a browser still do. **Any other client that loads an app page does**, so check a tagged link with a bot User-Agent, never a plain browser or HTTP client.
- The tag is rebuilt, not trimmed: only `a-z0-9-_` survive, the result is lowercased and capped at 32 characters, and an empty result becomes `direct`. **A tag outside that alphabet cannot be measured.**

## Funnel
Milestones are defined in `FunnelMilestoneEnumMap`. Each is one letter on the account, counted **once per account** and never reset (unlike the FTUE record): Arrived, TutorialDone, EnteredRoom, Built, Chatted, OwnedRoom, SignedUp, Returned (a later day, using the stale-guest definition of a distinct login), RetainedRepeat.

- Callers record milestones on every occurrence. Already-recorded milestones are cached on `SocketUserContext` (not `User`, which is serialized to the browser), so only a session's first occurrence reaches the DB. The cache can only answer "already recorded". A "not yet" is confirmed against the row.
- Chat and build arrive on the same metadata signal and are told apart by key.

## Storage
- **On the account**: source and recorded milestones.
- **`acquisition` collection**: one counts-only document per source per **arrival day**. Guests get deleted, so account rows alone would lose bounced visitors. Later milestones credit the arrival cohort.
- `ServerAnalyticsManager` writes directly with atomic increments, bypassing `DBQuery` (no migration or cache applies). Every entry point swallows errors so gameplay is never interrupted.
- Writes are bounded: at most one aggregate write per milestone per account, and account creation is rate-limited.

## Reports
```bash
node dev/scripts/analytics/funnelReport.js report  [--app live|staging|local] [--since YYYY-MM-DD] [--days N] [--min-cohort N] [--source TAG]
node dev/scripts/analytics/funnelReport.js sources [--app ...] [--days N] [--source TAG]
node dev/scripts/analytics/funnelReport.js raw     [--app ...] [--days N] [--source TAG]
```
JSON output. The default window is 30 days, and `--since` overrides `--days`. `report` gives per source:
- `arrived`, plus `counts` and `rates`. **Every rate is a share of arrivals**, not of the previous step.
- `ranking` by returned rate (not a composite score).
- `belowThreshold`: sources under `--min-cohort` (default 25), which are not ranked.
- `unknownCodes`: milestone letters the script does not recognize, which means the script's copy of the list has drifted from the source.

Reads may target **live**. `dev/scripts/playtest/lib/dbGuard.js` exposes a read-only facade limited to the `acquisition` collection.

## Verification
End-to-end recording is checked during the staging playtest: a `playtest-` ref cohort plus `stagingAdmin.js verify-funnel` (see [workflow.md](../testing/playtest/workflow.md)). `tests/integration/scenarios/acquisition-analytics.test.ts` covers sanitizing, cohort keys and count-once behavior against a mock DB.
