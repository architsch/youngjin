---
name: devlog-post
description: Write and publish a ThingsPool dev-log post about a feature the user names — research the feature in the codebase, capture in-game screenshots against the local dev server with Playwright, write an inviting description aimed at players that fits inside a single LinkedIn post, and publish it as a static page under public/devlog-2026 via the SSG. Use when asked for a dev log, devlog post, feature write-up, release note, or promotional/announcement post about something in this project.
---

# Dev-Log Post

Turns one finished feature into a published dev-log entry: a static page under
`public/devlog-2026/`, carrying screenshots taken from the running game and a description short
enough to be pasted into a LinkedIn post as it stands.

The user pastes the finished text onto LinkedIn, Facebook and elsewhere, and adds
`Play Here: https://thingspool.net` underneath by hand. That is what the character budget is for —
and it is also who the post is written for. These posts are read by the general public, most of
whom have never played the game and do not write software. The post has to make them curious
enough to open that link. A truthful record of the work is what it is made of; an invitation is
what it has to be.

## Step 1 — Settle on the feature

The feature is whatever the user named when invoking this skill. If they named nothing, ask which
feature the post is about (offer the last few commits' subjects as options) and stop until they
answer — everything below depends on the answer.

One post covers one feature. If the user names something sprawling, pick the part of it that can
be seen on screen and say in the final report what you left out.

## Step 2 — Research it

Read the actual code before writing a word about it. Work out:

- What the feature does, and what was awkward or missing without it.
- The idea behind how it works — the part worth telling someone who will never read the source.
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

## Step 5 — Write the post

Append a new block to `public/devlog-2026/source.txt` — never touch the posts already in it, and
never insert anything above them.
The file's syntax and the exact shape of a post block are in
[reference/post-format.md](reference/post-format.md); the voice, structure and an annotated
example are in [reference/writing.md](reference/writing.md).

The rules that do not bend:

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
  own "Play Here" line needs). Verify, do not estimate:
  ```bash
  node dev/scripts/devlog/postLength.js
  ```
  It exits non-zero when the newest post is over budget. Fix and re-run until it passes.
- **Tone.** Inviting, and serious about it: someone who built the thing showing it to a curious
  stranger. Open with what a player would see or do, not with the machinery. Never a sales pitch,
  never breathless, no exclamation marks, no rhetorical questions to the reader — and equally,
  never a dry engineering record, which is the easier trap to fall into.
- **No emoji.**
- **Hashtags.** About sixteen on the final line, each a `#` followed by a PascalCase term: six to
  eight broad ones drawn across the bank in [reference/hashtags.md](reference/hashtags.md), and the
  rest naming what this post is about. The broad ones are how someone who has never heard of any of
  this finds it; the line stops at sixteen because every tag is spent from the budget above, and a
  longer one reads as spam to the person scrolling past it.
- **SEO.** Name the technologies and concepts plainly in the prose — search engines read the
  page, and the `:k:` line is only part of it.
- **Truth.** Every claim traceable to code you read or a screenshot you looked at.

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
