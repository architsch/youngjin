# The Submission Kit

One folder per venue, at `temp/distribution/<venue-slug>/`, holding everything needed to place
ThingsPool there. `temp/` is gitignored, so kits never enter the change set — the ledger row is what
persists.

A kit exists so that the user's part of the work is *take the images, paste, and send*. If they have
to think about wording, work out what an image should show, or check a rule, the kit is unfinished.

## What a kit contains

`kit.md`, holding:

1. **The venue and its rules** — two or three lines: which flair or category, which thread, what the
   length limit is, anything the community forbids. Written down here so the user does not have to
   go and check.
2. **The destination and why** — the app, or a specific dev-log page, decided by the rules in
   SKILL.md. One line naming which and the reason, because it is the choice most likely to be
   questioned later.
3. **The title**, exact and copyable.
4. **The body**, exact and copyable, at that venue's length.
5. **The tagged link** — the chosen destination with `?ref=<venue-slug>` appended — already
   confirmed with a `curl` to return `200`.
6. **The image brief** — one row per image the venue shows: what to save it as, what it must show,
   at what size, and where. The user takes them; see below.
7. **The draft ledger row**, ready to be completed once the post is live.

## The copy ladder

Venues ask for wildly different lengths. Write these once per run, then cut down rather than padding
up — a short description is a shortened long one, never a stretched one-liner.

| Form | Length | Used by |
|---|---|---|
| Title | ~60 characters | Reddit, HN, portal listings |
| One-liner | ~120 characters | Directory entries, Discord, meta description |
| Short description | ~300 characters | Portal store fields, itch.io tagline area |
| Long description | 2–4 paragraphs | itch.io page body, portal listings, forum posts |
| Tag list | 5–15 terms | itch.io, portals, GitHub topics |

**The first sentence of every one of these does the same job:** it says what ThingsPool is to a
reader who has never heard of it. Not what is new about it, not why it is interesting — what it is.
*"ThingsPool is a 3D sandbox world that runs in a browser tab: no download, no install."* Everything
else in the copy depends on that sentence having landed first.

**When the destination is a dev-log post,** the body introduces that post rather than pitching the
game: what the post is about, what is worth looking at in it, and the one line of context saying
what ThingsPool is. The post does the selling once they arrive — it was written for exactly that.
Copy that pitches the game while linking to an article makes the reader feel misdirected, which is
the reaction the whole approach exists to avoid. Do not paste the post's own text into the venue
either; a duplicate of the page defeats the point of linking to it.

## Voice

**The house style is in [`../../../writing-style.md`](../../../writing-style.md), and it governs
every line of copy this skill writes.** Read it before drafting. It is shared with `devlog-post` on
purpose: the same reader meets both, and a second house style invented here would diverge from the
first within a few revisions.

The rules that catch this skill's copy most often are the ones about detail: no account of how a
feature works, no interface walkthrough, and none of the trade vocabulary. The rule about naming
things is the other one — **every item named in a list is read as shipped**, and a venue audience
checks.

Four adjustments for this skill's venues:

- **Dial the enthusiasm to the room.** The house voice is warm advertising copy, written for a
  LinkedIn feed where that is the native register. It is not native on Reddit or Hacker News, where
  exclamation marks and "our everlasting journey" read as marketing and get the post buried. There,
  keep the house plainness and the open-ended lists, drop the exclamation marks and the grand
  nouns, and let the developer's own first-person voice carry it. A store page or a directory entry
  takes the full house register; a community thread does not.
- **No hashtags**, except where a venue has an actual tag field. The hashtag block that ends a
  dev-log post belongs to social feeds and reads as spam on Reddit or Hacker News.
- **Say who is posting.** On community venues the developer saying "I built this" outperforms
  third-person copy, and is the only honest framing available.
- **Show HN, and only Show HN, may go one level deeper technically.** That audience came for the
  engineering, so naming what the thing is built on and one genuine constraint is welcome. This
  raises the house style's ceiling on detail for that one venue. It is never an invitation to
  describe architecture.

**Take the register from the dev-log posts, not from the ledger.** They live one year to a
directory, as `public/devlog-<year>/source.txt`, and they are the worked examples of the house
style — read the current year's before drafting, and adjust from there for the venue. The ledger's
past submissions are a record of what was sent, useful for checking what a venue has already seen
and what facts were committed to, but they were written under earlier versions of these rules and
several break the current ones.

## The image brief

**Every image is taken by the user**, so the kit does not contain images — it contains the brief that
lets the user produce them without asking a follow-up question. Write one row per image the venue
shows, in the order they are attached:

| Field | What it says |
|---|---|
| Filename | Exactly what to save it as, in `temp/distribution/<venue-slug>/images/` — the kit's body refers to it by that name |
| Purpose | Where the venue displays it: thumbnail in a grid, header of the listing, the post's own body, the share preview |
| Must show | The subject, in one sentence a person can act on — "a room with somebody else's avatar in it, seen from across the floor", not "gameplay" |
| Size | The venue's stated pixel dimensions or aspect ratio, its format, and its maximum file size |
| Notes | Anything the venue's rules impose: no text overlay, no border, safe area for a cropped thumbnail |

Two things decide whether that brief is any good.

- **The size comes from the venue, verified this run** (step 3 of SKILL.md). A remembered dimension
  is a guess, and a listing rejected for a wrong-sized cover costs the venue's whole turnaround.
  Where the venue genuinely does not say, write "not specified" rather than inventing a number, and
  name a safe default.
- **The thumbnail is the one that matters.** Most venues show a grid, and that one frame decides
  whether anything else in the kit is ever read. Say which row is the thumbnail, and let its brief be
  the most specific of them.

A dev-log post already carries screenshots of its own feature, and the user may well reuse one. That
is their call to make from the brief — never assert that an existing file fits a venue's
requirements, since judging that means looking at it.

## One kit per venue, never one kit copied

Each venue's body is written for that venue. This is not politeness; it is the difference between a
post that lands and one that is removed.

- A Reddit post opens by saying what the thing is and inviting a specific reaction.
- A Show HN opens with what was built and how, because that is what the audience is there for.
- A portal listing is written for someone scanning a grid of thumbnails and reads as product copy.
- A directory entry is one factual sentence.

Identical text appearing in several places on the same day is also the single clearest automated
spam signature there is, and it is detected by the platforms, not by the readers.

## Before handing a kit over

- Every length limit actually counted, not estimated.
- The tagged link curled and returning `200`.
- The `ref` slug written in `a-z`, `0-9`, `-`, `_`, at most 32 characters, and identical to the
  venue's ledger row. Anything else is silently rewritten by the server, and the venue then cannot
  be told apart from direct traffic in the report.
- The venue's rules read this run, not remembered from a previous one.
- The image brief complete — filename, purpose, subject, size and format for each, the thumbnail
  named — with every size taken from the venue's own rules rather than remembered.
- Every factual claim in the copy traceable to the code or to a `/docs` page.
- The whole thing shown to the user in full, inline, before it goes anywhere.
