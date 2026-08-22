# Distribution Ledger

A running record of every place ThingsPool has been submitted or posted, and what came of it.

**This file is history, not instructions.** Its rows record what actually happened. Never rewrite a
row to match a later understanding, and never delete one because it records a failure — a venue that
rejected the game, or produced no traffic, is the most useful thing in here. An audit of this
project's skills should leave this file alone.

Read it before every run. Its first job is preventing the same link being posted to the same
community twice, which is the single most damaging thing this skill can do.

## Columns

| Column | Meaning |
|---|---|
| Date | When it was posted, not when it was prepared |
| Venue | The registry entry in `reference/venues.md` |
| Destination | `app` or the dev-log page number linked |
| Ref tag | The `?ref=` slug used. `a-z0-9-_`, 32 chars max — the server drops everything else. This is the join key between this ledger and `funnelReport.js`, so it must match exactly |
| Post URL | Where the submission actually lives, once live |
| Status | `prepared` · `posted` · `removed` · `rejected` · `expired` |
| Result | Filled in on a later run: reception, traffic, what was learned |

`prepared` means a kit was built but the user has not sent it. A row sits at `prepared` until the
user confirms it went out — never promote a row on the assumption that they did it.

## Submissions

*(none yet — this ledger starts empty, on 2026-08-22)*

| Date | Venue | Destination | Ref tag | Post URL | Status | Result |
|---|---|---|---|---|---|---|

## Prior history, outside this ledger

Before this skill existed, promotion happened by hand: dev-log posts pasted to LinkedIn, Facebook, X
and Medium as each feature was finished. Those are not itemised here — no record of the individual
posts was kept — but the outcome is known and is recorded in `reference/venues.md` under that
venue: reach was poor, because the audience on those feeds is not looking for a game to play.

That is the baseline any push from here is measured against.
