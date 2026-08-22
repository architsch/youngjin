# Acquisition Analytics

Measures what became of the visitors each traffic source sent, so that two places the game was
promoted can be compared by what their people went on to do rather than by how many of them arrived.

The distinction is the reason this exists. A portal that sends ten thousand visitors who all leave
within a minute is worth less than a forum post that sends forty, six of whom come back the
following week. Arrival counts say the opposite, confidently.

This is separate from the Google Analytics tag on the public pages, which counts page views and
knows nothing about what happens inside the game. Everything below is first-party, recorded by the
server, and unaffected by ad blockers.

## How a visitor is attributed

A link promoted anywhere carries a `ref` tag:

```
https://app.thingspool.net/?ref=reddit-webgames
https://thingspool.net/devlog-2026/page-3.html?ref=hn-show
```

When a visitor with no account arrives, the tag is read off the address and stored on the account
that is minted for them. Attribution is **first-touch**: the tag is captured only on the branch that
creates an account, so somebody returning later through a differently tagged link keeps the source
that originally brought them.

The tag is untrusted input that ends up forming part of a document ID, so it is rebuilt rather than
trimmed. Only `a-z`, `0-9`, `-` and `_` survive; the rest are dropped, the result is lowercased and
capped at 32 characters, and anything with nothing left is filed under `direct`. **A ref tag
containing anything else will not survive to the report** — a venue slug must be written in that
alphabet to be measurable.

Direct traffic is a cohort in its own right, and the one every tagged source is worth comparing
against.

## The funnel

Each account carries the milestones it has already been counted for, one letter each. A milestone
counts once per account, the first time it is reached, and is never reset. `FunnelMilestoneEnumMap`
defines them:

| Milestone | Recorded when |
|---|---|
| Arrived | An account is minted for a new visitor |
| TutorialDone | The user leaves single-player mode, by finishing or skipping the tutorial |
| EnteredRoom | The user enters a multiplayer room |
| Built | The user sends any voxel or object edit |
| Chatted | The user says something to the room |
| OwnedRoom | The user comes to own a room |
| SignedUp | A guest converts to a member |
| Returned | The user comes back on a later day |
| RetainedRepeat | The user comes back again after that |

"A later day" is not a figure of speech: a return is recorded on the same definition of a distinct
login the stale-guest tiers use, which requires a gap of a day. A page refresh or a second tab
within one visit never counts.

Chatting and building are separated even though they arrive on the same signal — a message is
written to the speaker's own player object as metadata, so it reaches the server looking exactly
like an edit apart from its key. They are different behaviours and answer different questions:
building is what somebody does alone, while talking needs another person present, which makes it the
sharpest read on whether a visitor found the place alive rather than empty.

This is deliberately distinct from the FTUE flags, which record the same *kind* of thing — one
letter per event, stored on the user's row — for a different purpose. FTUE is reset whenever its
guidance should play again; the funnel is a measurement and is never reset.

Recording is called on every occurrence rather than only the first, because the callers are ordinary
gameplay paths that have no reason to know which is which — `Built` sits on the edit signals, and so
fires once per block placed. What keeps that affordable is that the milestones already recorded for
an account are carried on its live connection, read from its row when the socket authenticated. So
only the first edit of a session reaches the database, and every one after it is answered in memory.

The row, not the connection, still decides whether to count. A connection's copy is taken when it
opens, and the request paths record milestones on the same row while it is open, so the connection is
trusted to say "already recorded" — which can only become more true — and never to say "not yet". A
connection that has fallen behind therefore costs one wasted read rather than a second count. The
funnel is kept on `SocketUserContext` rather than on `User` because `User` is serialized into the
page the browser is served, and a measurement has no business crossing to the client.

## Where the counts live

Two places, and both are needed.

**On each account**: the source it arrived from, and the milestones already counted for it. This is
what makes a milestone count once per person, and what lets a return visit weeks later still be
credited to the source that first brought them.

**In the `acquisition` collection**: one document per source per arrival day, holding counts alone —
nothing that belongs to any one person. This exists because the accounts do not. A visitor who
bounces is a guest, and stale guests are deleted, so a tally kept only on the rows would quietly
lose exactly the people a disappointing source sent. The bounce rate of a traffic source would erase
itself a few days after the source was tried.

Counters are keyed by the day the visitor **arrived**, not the day the milestone happened. A
milestone reached weeks later is still credited to the cohort that earned it, which is what makes a
retention figure belong to the source that produced it.

`ServerAnalyticsManager` writes these documents through Firestore directly rather than through
`DBQuery` — a deliberate exception, because they are pure accumulators written with atomic
increments, never migrated and never cached, and the version-migration and cache-invalidation paths
would be actively wrong for them. Nothing in the module is allowed to interrupt play: every entry
point swallows its own errors, on the grounds that a lost count is a worse report while a thrown
error is a lost visitor.

## Reading the numbers

```bash
node dev/scripts/analytics/funnelReport.js report  [--app live|staging|local] [--since YYYY-MM-DD] [--days N] [--min-cohort N] [--source TAG]
node dev/scripts/analytics/funnelReport.js sources [--app ...] [--days N] [--source TAG]
node dev/scripts/analytics/funnelReport.js raw     [--app ...] [--days N] [--source TAG]
```

Every command prints JSON on stdout and names the target it read. The window defaults to the last
30 days of cohorts; `--since` wins over `--days` when both are given. `--source` narrows everything
to one traffic source, for when the tag is already known — checking one venue after a push, or one
playtest's own visits — rather than exploring, which is what the unfiltered report is for.

`report` is the one to use. It rolls the per-day documents up per source and gives, for each:

- `arrived` — the denominator.
- `counts` and `rates` for every milestone. **Every rate is a share of arrivals**, not of the step
  before it, because a funnel measured step-to-step hides the step that actually loses people behind
  a healthy-looking local percentage.
- `ranking` — sources ordered by returned rate, which is the number that answers "which source
  keeps people". It is not a composite score: retention is the one figure that cannot be inflated by
  sending more people, and a weighted blend would bury it behind a coefficient nobody chose.
- `belowThreshold` — sources with fewer arrivals than `--min-cohort` (25 by default), listed
  separately rather than ranked. Three returns out of five is 60% and means nothing.
- `unknownCodes` — milestone letters the tool does not recognise. The tool mirrors the milestone
  list from the TypeScript source, which it cannot import, so this is how that drift surfaces
  instead of silently dropping a new milestone from every report.

Reads are read-only and may address **live**, which is where the audience being measured actually
is. That is the one exception to the rule that tooling never touches live data, and it is narrow by
construction: `lib/dbGuard.js` hands back a facade that exposes reads and returns plain data, with
no document reference and no path back to the SDK, and it may only name the `acquisition`
collection. The users collection is not readable through it.

## Checking that it still records

The ref tag is read off a real request, so the only way to exercise this end to end — a browser, the
server, and the database it writes through — is against a deployed server. That is a step of the
staging playtest: a plan tags its `start` action with a reserved `playtest-` source, and
`stagingAdmin.js verify-funnel` reads back which milestones that cohort reached. The procedure, and
what makes a cohort come back empty, are in
[the playtest workflow](../testing/playtest/workflow.md).

Offline coverage stops short of that seam by nature. `tests/integration/scenarios/acquisition-analytics.test.ts`
covers what the module decides — sanitising, cohort keying, counting once per account, crediting the
arrival cohort — against a stand-in database, and nothing there proves a real request reaches it.

## Storage cost

A milestone is recorded once per account, so an account causes at most one aggregate write per
milestone over its whole lifetime — a handful of writes per visitor in total. The number of distinct
sources, and therefore of counter documents, is bounded by the number of accounts that can be
created, which the guest creation limit already caps per IP and User-Agent.
