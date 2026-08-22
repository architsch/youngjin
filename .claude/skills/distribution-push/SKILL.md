---
name: distribution-push
description: Find where ThingsPool can be published or promoted on the web and get it in front of players there — re-verify candidate venues against their current rules, check the game is ready to spend a first impression on one, build the copy and screenshots each venue asks for, hand over post-ready text for the places that require a human account, and record every submission and what came of it. Use when asked to promote, advertise, market, distribute, publish or launch the app, to find places to post it, to reach more players, or to work out why nobody is playing.
---

# Distribution Push

ThingsPool is a live page, not a file. It runs on a server this project operates, behind its own
accounts, and a player reaches it by clicking `https://app.thingspool.net` and landing in the game.
That single fact decides most of what follows: the natural unit of distribution here is **a link
somebody clicks**, and venues are worth what they are worth according to how well they carry one.

This skill covers both halves of that work — finding the venues and actually placing the app in them.
It does not write the promotional content itself. `devlog-post` does that, and the division holds
throughout: **`devlog-post` makes the material, `distribution-push` places it.** When a run needs a
post that does not exist yet, say so and let the user invoke that skill; do not write a second,
divergent description of the same feature here.

What this skill does write is the copy each venue asks for — a title, a one-liner, a body at that
venue's length. That copy obeys the same house style as everything else published in the user's
name: [`../../writing-style.md`](../../writing-style.md), read before drafting. One style guide
serves both skills, so neither invents its own register.

Those posts are not only a source of copy. **A published dev-log page is itself something worth
linking to**, and for a good number of venues it is the better thing to link to — see below.

## What this skill owns

- `.claude/skills/distribution-push/ledger.md` — the running record of every submission made.
- `reference/venues.md` — what is currently known about each candidate venue.
- The submission kits it builds, under `temp/distribution/`.

It does **not** edit `src/`, `docs/`, `tests/`, `CLAUDE.md` or `README.md`. Distribution work
routinely turns up real code problems — an embed that cannot authenticate, a payload too large for a
portal, a missing share-preview image. Those are **findings**, reported with a `path:line`, and the
user decides whether to fix them. A marketing run that quietly edits the application is a run whose
diff nobody reviews carefully.

Two notes for anyone auditing this skill later: `ledger.md` is a running record, not instructions —
its rows are history and must never be "corrected" to match anything. And the facts in
`reference/venues.md` are claims about *other companies' websites*, not about this codebase. They
are verified in step 3 of this skill by fetching those sites, and cannot be verified by a
`skill-upkeep` pass over the source tree.

## The standing preference: link out, embed only when it buys something

The user's preference is a plain outbound link to `https://app.thingspool.net`, opening the app on
its own page. That is also the better product experience: full window, real session, no third-party
frame, and the player is already on the site that owns the account they just made.

So venues split into two lanes, and the link-out lane is worked first and worked harder.

The **embed lane** — portals that host your build inside an iframe on their own domain — is not
forbidden, and for the largest portals the reach is real enough to be worth the work. But it carries
a prerequisite that must be settled before any embedded submission is attempted:

> The auth cookies in `src/server/networking/util/cookieUtil.ts` are `httpOnly` with
> `sameSite: "lax"`. Inside a third-party iframe the browser will not send them, so sessions, guest
> accounts and the tutorial-finished flag all fail silently in an embed. Nothing in the game will
> log an error; players will simply be unable to stay signed in.

Report that as a blocker on any embed-lane submission and let the user decide. Never submit to an
embedding portal without either confirming the cookie behaviour has changed or telling the user
plainly that it has not.

## Choosing the destination: the app, or a dev-log post

There are two things a link can point at, and picking the wrong one is a common way to waste a good
venue.

**The app itself** — `https://app.thingspool.net`. The shortest path from a click to playing. Right
wherever the audience arrived looking for something to play: the browser-game communities, the
portals, the game directories.

**A dev-log post** — `https://thingspool.net/devlog-2026/page-<N>.html`. A written piece about one
finished feature, with screenshots from the running game, which then leads the reader into the app
through the "New here? Start with What is ThingsPool?" line every post opens with. Verified
2026-08-22 that these pages serve tagged URLs normally and carry both the analytics tag and
`og:title` / `og:image`, so they are measurable and they preview properly when shared.

Link to a post rather than to the app when:

- **The venue wants substance, not a pitch.** Many of the strongest communities — developer
  subreddits, Hacker News, dev.to, Lobsters, most Discord servers with a showcase channel — treat a
  bare "play my game" link as low-effort promotion, and treat an article about how something was
  built as a contribution. The same link that gets removed as spam gets upvoted when it has a piece
  of writing behind it.
- **The audience is developers.** They came to read about the voxel engine, the physics, the
  rendering. Sending them straight into a game they have no context for wastes the interest.
- **There is a specific new feature to talk about.** A feature gives the post a reason to exist
  *now*, which a permanent link to the app never has. This is what makes dev-log posts a repeatable
  channel: a venue that will only take one link to the app will take a post about each new thing.
- **The user's own social feeds.** These are already where the posts go, and that is the right use.

Link to the app directly when the audience is players, when the venue's whole purpose is games to
click, or when the game itself is the news.

`public/devlog-2026/list.html` is the index of what exists to link to. Read the actual posts before
choosing between them; pick the one whose subject fits the venue, not simply the newest.

## Step 1 — Read the ledger before anything else

```bash
cat .claude/skills/distribution-push/ledger.md
```

This is first because the most damaging act available in this skill is **posting the same link to
the same community twice**. On Reddit, Hacker News and every forum worth posting to, a repeat
submission of the same URL reads as spam, and the penalty falls on the project's name rather than on
the post. The ledger is the only record of what has already been spent.

From it, work out: which venues are done, which are pending a result, which were rejected and why,
and which have a cooling-off period still running.

## Step 2 — The readiness gate

A submission to a curated venue is spent once. A first impression given to a broken or empty
experience is worse than no submission at all, because the venue is then used up and the audience
has already decided. So check, before preparing anything:

```bash
curl -s -o /dev/null -w "%{http_code}\n" --max-time 10 https://app.thingspool.net/health
curl -s -o /dev/null -w "%{http_code}\n" --max-time 10 https://thingspool.net/
```

Both must answer `200`. Then three judgements that need actual looking:

- **Does a solo arrival work?** This is the decisive one for a multiplayer sandbox and the easiest to
  overlook, because the developer never experiences it. Someone arriving from a link at a quiet hour
  meets an empty world. Read `docs/networking/ftue.md` and `docs/networking/single_player_mode.md`
  and establish what that person is actually given to do. If the answer is "wait for somebody", say
  so and recommend holding the push — no venue fixes an empty-room first session.
- **Does the landing page explain the game to a stranger?** The link lands somebody who has never
  heard of it. Check that `https://thingspool.net` answers "what is this and why would I click play"
  above the fold.
- **Does the shared link preview well?** The Open Graph tags in `views/partial/common/ogTags.ejs`
  decide what a Reddit or Discord post looks like. A link with no preview image loses most of its
  clicks before anyone reads the title. Fetch the URL being promoted and confirm the tags resolve to
  an image that exists.

If the gate fails, report what failed and stop. Do not push anyway; the venues will still be there
next week and the first impressions will not.

## Step 3 — Refresh the venue registry

`reference/venues.md` is the accumulated knowledge, and every entry carries the date it was last
verified. **It is a starting point, not an authority.** Platform rules in this space churn hard —
Kongregate closed to new submissions and stayed open-looking for years afterwards; itch.io tightened
its rules on link-only pages in response to malware. An entry more than a couple of months old is a
hypothesis.

For every venue this run intends to use, fetch its actual submission or rules page and confirm:

- Does it still accept new submissions at all?
- Does it accept an **outbound link**, or does it require an uploaded build?
- What are the hard limits — file sizes, formats, required assets, exclusivity?
- What are the community's own rules — self-promotion ratios, flair requirements, dedicated
  promotion threads, minimum account age?

That last one is where runs go wrong. A subreddit that technically allows a link but requires it to
go in a weekly thread will remove a front-page post within minutes, and the account carries the
strike.

Write what you learn back into `reference/venues.md`, restamping the verification date. New venues
found along the way get added in the right lane. Venues found to be closed are marked dead **with
the date and the reason** rather than deleted — the next run needs to know not to re-research them.

## Step 4 — Choose what this run will do

Rank the candidates by reach × audience fit, divided by effort, with the link-out lane preferred.
Then propose to the user a short, ordered list — **two or three venues, not ten**.

Small is deliberate. Every venue costs a tailored kit and a real post from the user's own account,
and a batch of near-identical posts appearing across the web on one afternoon is the exact pattern
every spam filter and every moderator is trained on. Sequenced venues also produce readable
attribution; simultaneous ones produce one indistinguishable traffic spike.

If the user named a venue when invoking the skill, that is the run — verify it in step 3 and go.

## Step 5 — Build the submission kit

One kit per venue, under `temp/distribution/<venue-slug>/`. Full specification in
[reference/submission-kit.md](reference/submission-kit.md). In short, each kit holds the copy at
exactly the lengths that venue asks for, the screenshots it needs, and the tagged link.

Three rules that do not bend:

- **Style.** Every line of every kit follows [`../../writing-style.md`](../../writing-style.md) —
  short active sentences carrying one idea, plain verbs, no metaphor the reader has to unpack, one
  subject at a time, and no lists of features. `reference/submission-kit.md` names the venue
  adjustments, including the one venue allowed more technical depth. Earlier submissions in
  `ledger.md` show what was sent before; they are not a model for how to write.
- **The tagged link.** Every venue gets its own, appended to whichever destination was chosen:
  `https://app.thingspool.net/?ref=<venue-slug>` or
  `https://thingspool.net/devlog-2026/page-<N>.html?ref=<venue-slug>`.

  **The slug must be written in `a-z`, `0-9`, `-` and `_`, and be at most 32 characters.** This is
  not a style preference: the server rebuilds the tag rather than trimming it, dropping every other
  character, so `?ref=Reddit r/WebGames` is recorded as `redditrwebgames` and `?ref=写真` is recorded
  as direct traffic. A slug outside that alphabet produces a venue that silently cannot be measured.
  Keep the slug identical to the venue's ledger row, or the report and the ledger cannot be lined up.

  Curl the exact URL before handing it over; a link that 404s is the one mistake a venue will not
  forgive. The full mechanism is in [`docs/devOps/analytics.md`](../../../docs/devOps/analytics.md).
- **Truth.** Every claim traceable to code or to a screenshot you looked at. Possibilities are
  written as possibilities. This is the standard the house style sets for every piece of public
  copy, and for the same reason — a promotional claim that the game does not deliver is discovered
  within thirty seconds of the click.

## Step 6 — Execute, in three lanes

Sort every action into one of these three before doing any of it. The sorting matters more than the
doing.

### Lane A — do it yourself

Anything on the project's own property, and anything an official tool does with credentials the user
has supplied:

- Copy and assets on `thingspool.net` itself, the README, GitHub repository topics and description,
  the Atom feed, Open Graph tags. (Reported as findings if they need `src/` or `README.md` edits —
  see the ownership rules above — but researched and drafted here.)
- Official CLIs and APIs run with the user's own key, where the user has explicitly asked for it. The
  itch.io `butler` tool is the realistic example.
- All verification: fetching a page to confirm a submission landed, checking a preview renders.

### Lane B — prepare it, and hand it to the user

Every community venue: Reddit, Hacker News, Discord, forums, and any portal whose submission form
sits behind the user's login. Here you produce a post the user pastes and sends themselves, and the
handover contains everything needed to act without opening a file:

- The exact title, in a copyable block.
- The exact body, in a copyable block, at the venue's length.
- The tagged link, and which flair or category to choose.
- The venue's rules that bear on this post, in one or two lines.
- The images to attach, by path.
- The ledger row that will be filled in once it is posted.

### Lane C — never

- **Never create accounts, log in as the user, or post to a community as though you were a person.**
  These communities run on the assumption that a human is speaking. Automating that is both a terms
  violation on every platform named in the registry and the fastest available way to get the domain
  itself blacklisted.
- **Never operate more than one identity**, vote, upvote, or arrange for anything to be voted on.
- **Never post the same text to many communities at once**, and never post to a community whose
  rules this run has not actually read.
- **Never disguise who is posting.** The user is the developer; a post that says so does better
  than one that pretends otherwise, and is the only honest option regardless.

## Step 7 — Record, then measure on the next run

Append one row to `ledger.md` per submission, at the moment it happens, including the URL of the
post itself once the user reports back. A submission that is not in the ledger will be made again.

Then measure, which you can do yourself. The server records where every visitor came from and how
far they got, per source, and the report is one command:

```bash
node dev/scripts/analytics/funnelReport.js report --app live --days 30
```

It prints JSON: arrivals per source, the share of each source's arrivals that reached each funnel
step, and a `ranking` ordered by returned rate. Read
[`docs/devOps/analytics.md`](../../../docs/devOps/analytics.md) before interpreting it — the section
on what the rates are shares *of* is the part that is easy to get wrong.

Three things to hold onto when reading it:

- **`arrived` is the least interesting column.** It measures how many people a venue sent, which is
  the thing a venue will tell you anyway. The columns worth acting on are `returned` and `built` —
  people who came back, and people who did something once they were there.
- **Respect `belowThreshold`.** A source with fewer than the minimum arrivals is not ranked, and it
  should not be argued about either. Four visitors is an anecdote.
- **A cohort needs time.** Retention is measured on a gap of a day at minimum, so a source posted
  yesterday has a structurally empty returned rate. Reading it as failure and abandoning the venue
  is the mistake this note exists to prevent. Wait a week before judging retention.

Also check the venue itself — comments, votes, whether the post was removed — because the report
cannot see any of that. Then record the outcome in the ledger.

**This is the step that makes the second run better than the first.** A ledger of what was posted
with no record of what came of it is a diary; a ledger with outcomes is a strategy. Where a venue
produced nothing, write down that it produced nothing, so the next run spends the effort elsewhere.

## Step 8 — Report

- What was posted, where, and by whom — separating what you did from what the user must still do.
- The prepared kits, with the pasteable text inline so the user need not open files.
- Findings that need a decision, each anchored to a `path:line`: embed blockers, oversized payloads,
  missing assets, a readiness gate that failed.
- What the registry learned this run — venues newly verified, newly found, newly dead.
- What you deliberately did not do, and why.

Keep the first two apart from each other. "Prepared" and "posted" are different states, and a report
that blurs them leaves the user believing the work is finished when it is sitting in a folder.

## Boundaries for the whole run

- **Lane C is absolute.** No impersonation, no automated community posting, no multiple identities,
  no vote manipulation. There is no deadline that justifies any of it.
- **Never post the same link to the same venue twice** without a genuinely new reason, a real
  interval, and a ledger row explaining both.
- **Two or three venues per run.** A wider push is not a faster one; it is a spam pattern.
- **No `src/`, `docs/`, `tests/`, `CLAUDE.md` or `README.md` edits.** Findings only.
- **Nothing goes out that the user has not seen.** Every outbound artifact — post text, store
  listing, description — is shown to the user in full before it is placed anywhere.
- **Report a venue's rejection as a rejection.** A portal that declined, a post that was removed by a
  moderator, a gate that was not passed: these go in the ledger and the report as they are. They are
  the most useful information this skill produces.
