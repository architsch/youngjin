---
name: devlog-post
description: Write and publish a ThingsPool dev-log post about a feature the user names — research the feature in the codebase, capture in-game screenshots against the local dev server with Playwright, write an inviting description aimed at players that fits inside a single LinkedIn post, and publish it as a static page under public/devlog-2026 via the SSG. Use when asked for a dev log, devlog post, feature write-up, release note, or promotional/announcement post about something in this project.
---

# Dev-Log Post

Turns one finished feature into a published dev-log entry: a static page under
`public/devlog-2026/`, carrying screenshots taken from the running game and a description short
enough to be pasted into a LinkedIn post as it stands.

The user pastes the finished text onto LinkedIn, Facebook and elsewhere, and adds
`Play Here: https://thingspool.net` underneath by hand. That is what the character budget is for,
and it is also who the post is written for. These posts are read by the general public, most of
whom have never played the game and do not write software.

**The post is an advertisement.** Its job is to make that reader want to open the link. It does
that by describing something real and interesting rather than by selling, so it is truthful
throughout — but a truthful paragraph that makes nobody curious has still failed. The reader
should finish the post able to picture one specific thing they would like to go and make in the
game.

## Step 1 — Settle on the feature

The feature is whatever the user named when invoking this skill. If they named nothing, ask which
feature the post is about (offer the last few commits' subjects as options) and stop until they
answer — everything below depends on the answer.

One post covers one feature. If the user names something sprawling, pick the part of it that can
be seen on screen and say in the final report what you left out.

## Step 2 — Research it

Read the actual code before writing a word about it. Work out:

- What the feature does, and what was awkward or missing without it.
- **What a player can now make or do that they could not before.** This is what the post is
  mostly about, so spend the most research effort here. Look at the actual choices the feature
  puts in front of a player — the things in the menus, the range of what can be changed — because
  those are what turn into concrete, picturable sentences.
- **What it opens up.** One or two specific things somebody might build or try with it. Imaginative
  is good; it just has to be honestly framed as a possibility rather than an existing feature.
- The idea behind how it works — one short paragraph's worth at most, and only the part that would
  interest someone who does not program.
- What of it is **visible**, and what a player has to do to see it. This decides the screenshots.

`git log`, the relevant `/docs` page and the source files themselves are the sources. Never
describe behaviour you have not confirmed in the code or seen on screen.

## Step 3 — Get the dev server up

```bash
curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://127.0.0.1:3000/health
```

`200` means one is already running — use it, and leave it running when you are done.

Otherwise start one in the background (this launcher clears stale Firebase-emulator ports first,
which a bare `npm run devnossg` does not):

```bash
node dev/scripts/e2eDevServer.js devnossg
```

Poll `/health` until it answers `200`; the bundles take a couple of minutes to compile. If it
never comes up, show the launcher's output and stop. Do not invent screenshots. Common causes:
`gcloud auth application-default login` has never been run on this machine, or `firebase-tools` /
`pm2` are missing from the Node version currently selected by nvm.

If **you** started it, stop it once the captures are done (`npm run stop`, then kill the launcher).

## Step 4 — Capture the screenshots

Full details in [reference/capture.md](reference/capture.md). In short:

1. Copy `dev/scripts/devlog/shots/_template.js` to `dev/scripts/devlog/shots/<slug>.js`.
2. Learn the screen: `node dev/scripts/devlog/captureRunner.js --probe` prints every clickable
   thing on screen with its position, and writes a probe JPEG under `test-results/devlog-probe/`.
3. Write `run()` so it walks the game to each moment worth showing, calling `shot("<label>")`.
   While iterating, add `--out=test-results/devlog-probe` so half-finished shots stay out of
   `public/`.
4. **Read every screenshot you take.** They are images; open them with the Read tool and look.
   Re-shoot anything that shows a loading indicator, a half-arrived room, an open debugger, an
   empty canvas, or simply not the feature. This is the step that decides whether the post is
   worth publishing.
5. Final run without `--out`, writing into `public/devlog-2026/`.

Two to four images per post. The first one in the post becomes its share-preview image, so lead
with the one that reads best at a glance.

**Compose each frame; do not merely capture it.** Most readers meet the post as a thumbnail on a
phone, so a frame that technically contains the feature but reads as a grey room has failed. The
three faults to shoot against, with the camera numbers that fix them, are in
[reference/capture.md](reference/capture.md#composing-the-frame):

- **Fill the frame with the subject** — roughly a third to a half of the frame's shorter side. A
  subject lost in the middle of a wall is the commonest fault, and pulling the camera back to
  *reach* something and then shooting from there is how it happens.
- **Come round off the square-on view** — 30-60 degrees off the surface's normal, and above or
  below its level, so the room recedes instead of standing flat like a backdrop.
- **Balance the whole frame** — pick the vantage whose surroundings put something in every quarter,
  rather than one with a blank wall over half of it and a band of empty floor along the bottom.

## Step 5 — Write the post

Append a new block to `public/devlog-2026/source.txt` — never touch the posts already in it, and
never insert anything above them.

The exception is a **revision**: when you are asked to write the post again about a feature an
earlier attempt already covered, the newest block in the file is that attempt's, and it gets
replaced where it stands. Appending instead leaves the site with two posts about one feature. Its
screenshots are revised the same way — re-shoot to the same filenames, and delete from
`public/devlog-2026/` any image the new version no longer references.

The file's syntax and the exact shape of a post block are in
[reference/post-format.md](reference/post-format.md); the voice, structure and an annotated
example are in [reference/writing.md](reference/writing.md).

The rules that do not bend:

- **The title names the feature, literally.** "Game Modes Are Here", "Better Control With Game
  Modes" — the words somebody would use to search for it, not a figurative phrase about the idea
  behind it. A reader scrolling a feed has nothing to decode a clever title with.
- **The first two sentences are the whole post in miniature.** Social platforms show about two
  lines and hide the rest behind "see more", so those lines say what ThingsPool is (the reader has
  never heard of it) and what is new, in that order: *"ThingsPool, an immersive 3D chat app that
  runs in a browser tab, now has game modes."* Never open with a scene, a question, or a detail
  that only makes sense once the reader already knows what the feature is.
- **The link back.** Every post opens, on the line directly under its header, with the link to the
  site's landing page:
  ```
  @@<h3>New here? Start with <a class="inlineButton" href="https://thingspool.net#what-is-thingspool">What is ThingsPool?</a></h3>
  ```
  A reader who lands on a post about one camera behaviour has no idea what the game is, and that
  line is where they find out. `postLength.js` warns when a post is missing it.
- **Images.** Every screenshot kept from step 4 is referenced in the post, on its own line, at the
  point the prose has just described what it shows. A post about a visible feature that carries no
  images has failed at its main job. They cost nothing against the character budget — the counter
  ignores those lines, because a pasted social post carries the text only and the user attaches the
  JPEGs themselves.
- **Length.** At most 2964 characters (LinkedIn's 3000-character limit, less the 36 the user's
  own "Play Here" line needs). **This is a ceiling, not a target.** Say the whole thing in as few
  words as it takes and stop; a 1200-character post is better than the same post stretched to
  2900, and never add a sentence because there is budget left. Draft, then cut — writing.md lists
  what comes out first. Verify the number, do not estimate:
  ```bash
  node dev/scripts/devlog/postLength.js
  ```
  It exits non-zero when the newest post is over budget. Fix and re-run until it passes.
- **Tone.** Clear, concise and logical, in the voice of the user's own books — a mathematics or
  philosophy teacher explaining an idea to an intelligent adult who does not know the field.
  Complete sentences, one idea each, plain words, the point stated before it is elaborated.
  Read [reference/writing.md](reference/writing.md) before drafting; it names the two ways this
  goes wrong. The one that keeps happening is the **poetic register** — fragments used as
  rhetorical beats, metaphors standing in for plain statements, sentences that sound meaningful
  without being restatable. The other is the dry engineering record. A little color is welcome
  ("craft your dream space", "explore a room's hidden corners") as long as every sentence still
  says one definite thing at a glance. No sales pitch, no rhetorical questions to the reader.
- **Depth.** Almost all of the post is what a player can see, do and make. Never treat user
  interface flow, performance, computational cost, algorithms, network bandwidth, architecture or
  code structure in depth — at most one plain-language clause, and only where the story needs it.
- **Concept, not manual.** Do not walk the reader through which button opens which panel and in
  what order. Say what the feature is and what it lets somebody do, let one or two concrete
  details stand in for the rest, and let the screenshots show the interface. The post should get
  *less* detailed as it goes on, not more: the closing paragraphs are a short conceptual summary
  of each part plus what it makes possible, never a walkthrough.
- **Established terms.** Every noun has to be one the reader can define. "This is the first post of
  ThingsPool's development log, a news feed for the project's major updates" lands; "this log
  follows what gets finished, with pictures from the running game" does not, though nothing in it
  is figurative. Reach for the word people already know, or define the term where it first appears.
- **No emoji.**
- **Hashtags.** About sixteen on the final line, each a `#` followed by a PascalCase term: six to
  eight broad ones drawn across the bank in [reference/hashtags.md](reference/hashtags.md), and the
  rest naming what this post is about. The broad ones are how someone who has never heard of any of
  this finds it; the line stops at sixteen because every tag is spent from the budget above, and a
  longer one reads as spam to the person scrolling past it.
- **SEO.** Name the technologies and concepts plainly in the prose — search engines read the
  page, and the `:k:` line is only part of it.
- **Truth.** Every claim traceable to code you read or a screenshot you looked at. Ideas about what
  the feature makes possible later are welcome, written as possibilities rather than as things
  that already work.

Then read the draft back once against the checklist at the end of
[reference/writing.md](reference/writing.md) and fix what fails. Its first test is the one that
catches the usual problem: every sentence must be restatable by the reader in their own words.

## Step 6 — Publish

Regenerating the static site is what turns `source.txt` into pages. From the repo root:

- Only `source.txt` and images changed, and `library.html` already lists "Dev Log - 2026":
  ```bash
  MODE=ssg node dist/server/bundle.js
  ```
  (Runs the SSG and exits — no secrets, no emulators, no server.)
- Anything under `src/` changed, or `public/library.html` has no "Development History" section
  yet (meaning the committed server bundle predates it): `npm run beforeCommit` instead, which
  rebuilds the bundles first.

Then confirm, don't assume: the new `public/devlog-2026/page-<N>.html` exists and contains the
post's title, `public/library.html` lists the entry, and every `<img>` the page carries points at
a file that is actually in `public/devlog-2026/` — a mistyped image reference produces a page that
builds cleanly and shows a broken image.

## Step 7 — Report

Tell the user:

- The post's title and its page number.
- Local preview: `http://127.0.0.1:3000/devlog-2026/page-<N>.html` (dev server serves `public/`).
- Published address once committed: `https://thingspool.net/devlog-2026/page-<N>.html`.
- The screenshot files, so they can attach them to the social post.
- The **full post text as they will paste it**, in a copyable block, with its character count and
  how much of the 2964 is left.
- That the page goes live after they commit and their static pages deploy — this skill does not
  commit anything.
