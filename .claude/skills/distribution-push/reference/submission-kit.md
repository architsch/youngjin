# The Submission Kit

One folder per venue, at `temp/distribution/<venue-slug>/`, holding everything needed to place
ThingsPool there. `temp/` is gitignored, so kits never enter the change set — the ledger row is what
persists.

A kit exists so that the user's part of the work is *paste and send*. If they have to think about
wording, hunt for an image, or check a rule, the kit is unfinished.

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
6. **The images**, by absolute path, in the order they should be attached.
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

Inherit it. The register is already settled in
[`../../devlog-post/reference/writing.md`](../../devlog-post/reference/writing.md) — clear,
concrete, complete sentences, one idea each, no sales pitch and no rhetorical questions. Read it
before drafting rather than reinventing a second house style here.

Two adjustments for this skill's venues:

- **No hashtags**, except where a venue has an actual tag field. The hashtag block that ends a
  dev-log post belongs to social feeds and reads as spam on Reddit or Hacker News.
- **Say who is posting.** On community venues the developer saying "I built this" outperforms
  third-person copy, and is the only honest framing available.

## Images

Look before capturing. `public/devlog-2026/` already holds screenshots taken from the running game
for the dev-log posts, and for most venues one of those is the right image. Open the candidates with
the Read tool and pick — do not choose by filename.

Capture new ones only when the venue needs something the existing set does not have: a specific
aspect ratio, a thumbnail at a required size, or a feature no post has covered. The capture tooling
and its rules of composition are documented in
[`../../devlog-post/reference/capture.md`](../../devlog-post/reference/capture.md); use it as
written rather than driving the runner from memory, and write any new shot script into
`dev/scripts/devlog/shots/` alongside the existing ones.

**Read every image you intend to submit.** The failure this prevents — a frame containing a loading
indicator, an empty canvas, or a grey wall where the feature was supposed to be — is invisible until
it is on someone else's website.

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
- Every image opened and looked at.
- Every factual claim in the copy traceable to code or to a screenshot.
- The whole thing shown to the user in full, inline, before it goes anywhere.
