---
name: devlog-post
description: Write a ThingsPool dev-log post about a feature the user names — research the feature in the codebase, write an inviting description aimed at players that fits inside a single LinkedIn post, add it to public/devlog-<year>/source.txt, and hand it to the user to review and revise. Use when asked for a dev log, devlog post, feature write-up, release note, or promotional/announcement post about something in this project.
---

# Dev-Log Post

Turns one finished feature into a dev-log entry: a block of text in `public/devlog-<year>/source.txt`
short enough to be pasted into a LinkedIn post as it stands, which the SSG turns into a static page
under the same directory.

**This skill writes the text and nothing else.** The screenshots are the user's: they take them,
name them and add their lines to the post themselves. So never capture, generate or reference an
image here — hand the text over and let them illustrate it.

The user pastes the finished text onto LinkedIn, Facebook and elsewhere, and adds
`Play Here: https://thingspool.net` underneath by hand. That is what the character budget is for,
and it is also who the post is written for. These posts are read by the general public, most of
whom have never played the game and do not write software.

**The post is an advertisement**, and it is written like one: warm, enthusiastic, addressed to the
reader as "you", and ending by inviting them in. Its job is to make that reader want to open the
link. It stays truthful throughout, because a claim the game does not deliver is discovered within
thirty seconds of the click — but a truthful paragraph that makes nobody curious has failed just as
completely. **Dryness is the failure mode to watch for, not hype.**

## Step 1 — Settle on the feature

The feature is whatever the user named when invoking this skill. If they named nothing, ask which
feature the post is about (offer the last few commits' subjects as options) and stop until they
answer — everything below depends on the answer.

One post covers one feature. If the user names something sprawling, pick the part of it a player
would notice and say when handing the post over what you left out.

## Step 2 — Research it

Read the actual code before writing a word about it. Work out:

- What the feature does, and what was awkward or missing without it.
- **What a player can now make or do that they could not before.** This is what the post is
  mostly about, so spend the most research effort here. Look at the actual choices the feature
  puts in front of a player — the things in the menus, the range of what can be changed — because
  those are what turn into concrete, picturable sentences.
- **The concrete things the feature puts in the room** — enough of them to fill an open-ended list,
  since that is the shape most paragraphs take. Each one has to be real; the tail that follows them
  ("and a variety of other hidden corners") is what carries everything not yet built.
- **What it feels like to use.** One vivid physical line per post comes out of this, so find
  several during research and keep the best one.
- The idea behind how it works — one short paragraph's worth at most, and only the part that would
  interest someone who does not program.

`git log`, the relevant `/docs` page and the source files themselves are the sources. Never
describe behaviour you have not confirmed in the code.

## Step 3 — Write the post

Posts are filed one year to a directory. Ask the tooling which one is current rather than assuming:

```bash
node -e "console.log(require('./dev/scripts/devlog/devlogDir').resolveDevlogDir())"
```

`isCurrentYear: false` means the calendar has rolled over and **this year's directory does not
exist yet**. Opening one is two steps, and doing only the first produces a directory the SSG never
builds:

1. `mkdir public/devlog-<year>` and start a `source.txt` in it.
2. Add a row to `"Development History"` in `src/server/ssg/data/libraryData.ts`:
   `{ dirName: "devlog-<year>", title: "Dev Log - <year>" }`. The Library index
   and the landing page's dev-log link are both built from that list, so the new year appears in
   both once it is there. It touches `src/`, so say so when handing over: that year's first page
   needs the bundles rebuilt (`npm run beforeCommit`), not the SSG alone.

Then append a new block to that year's `source.txt` — never touch the posts already in it, and
never insert anything above them.

The exception is a **revision**: when you are asked to write the post again about a feature an
earlier attempt already covered, the newest block in the file is that attempt's, and it gets
replaced where it stands. Appending instead leaves the site with two posts about one feature. **A
revision keeps every image line the user has added**, each at the same point in the prose it was
illustrating — a rewrite that drops them silently un-illustrates the post.

Three documents govern the writing, and all three are read before drafting:

- [`../../writing-style.md`](../../writing-style.md) — the house style, shared with every other
  piece of public copy this project publishes. Voice, sentence rules, how much detail is allowed,
  what to cut. It is the authority on *how* to write.
- [reference/writing.md](reference/writing.md) — what a dev-log post specifically must be: what it
  is for, what goes in it, how it opens, an annotated example, and the checks.
- [reference/post-format.md](reference/post-format.md) — the file's syntax and the exact shape of a
  post block.

The rules that do not bend:

- **The title is the shortest noun phrase that names the feature.** "Game Modes". "Second Floor".
  "Introducing ThingsPool". Two words is normal. Not a sentence, not a figurative phrase, and not
  "X Is Here" — just the name of the thing, in the words somebody would use to search for it.
- **The first two sentences are the whole post in miniature.** Social platforms show about two
  lines and hide the rest behind "see more", so those lines carry what is new and what ThingsPool
  is. **Either may lead.** The model posts do it both ways: *"You can now build two-story rooms in
  ThingsPool!"* followed by a sentence saying what ThingsPool is, or the appositive that does both
  at once — *"ThingsPool, an immersive browser-based metaverse app, now supports two distinct game
  modes."* Never open with a scene, a question, or a detail that only makes sense once the reader
  already knows what the feature is.
- **The link back.** Every post opens, on the line directly under its header, with the link to the
  site's landing page:
  ```
  @@<h3>New here? Start with <a class="inlineButton" href="https://thingspool.net#what-is-thingspool">What is ThingsPool?</a></h3>
  ```
  A reader who lands on a post about one camera behaviour has no idea what the game is, and that
  line is where they find out. `postLength.js` warns when a post is missing it.
- **Images.** Not yours to add. The user takes the screenshots and writes their `<name>` lines into
  the block themselves, so leave the prose to stand on its own and never reference a file you have
  not been given. They cost nothing against the character budget either way — the counter ignores
  those lines, because a pasted social post carries the text only and the user attaches the JPEGs.
- **Length.** **Aim for about 600 characters of prose.** The first three posts in `source.txt` run
  roughly 620, 550 and 510 characters of body text, and they are the target. 2964 is a hard ceiling
  (LinkedIn's 3000-character limit less the 36 the "Play Here" line needs), not a goal — being at a
  fifth of it is the correct outcome, and a post that reaches four figures needs cutting rather
  than congratulating. Never add a sentence because there is budget left. Verify the number, do not
  estimate:
  ```bash
  node dev/scripts/devlog/postLength.js
  ```
  It exits non-zero when the newest post is over budget, and warns when it is far under the
  600-character mark or well above it.
- **Style.** [`../../writing-style.md`](../../writing-style.md) is the authority, and reading it is
  not optional. What it holds the post to: warm, enthusiastic advertising copy that addresses the
  reader as "you" and speaks for the project as "we"; common words in ordinary, unfussy sentences;
  open-ended lists that suggest there is more than the sentence names; one vivid physical image of
  what the feature feels like; a closing invitation to come and play; and no account whatsoever of
  how anything works or where it sits on screen. **Dryness is the failure mode to guard against.**
  A draft that is accurate and boring gets rewritten, not polished.
- **The previous posts are the model.** **When in doubt, refer to the previous devlog posts for
  guidance on the style of writing. Use them as examples.** They live one year to a directory, as
  `public/devlog-<year>/source.txt`; read the current year's before drafting, and the year before
  it as well when the current file is new or short. Take from them the register, the length, the
  rhythm and the shape. Read them for the facts too, so the new post contradicts nothing. A new
  post should sit beside them without looking like it came from somewhere else.

  Where a post and the written rules seem to disagree, the post usually wins — the rules are a
  distillation of the posts and go stale first. If the difference looks like a real question rather
  than a stale rule, ask the user rather than guessing.

  The dev-log posts are the *only* writing on the site to take style from. The books and essay
  collections in the Library belong to a different genre entirely, and that voice does not transfer
  to a short promotional post. Do not read them for guidance here.

  Published posts are dated records and are not edited to match a newer rule.
- **Concept, not manual.** Do not walk the reader through which button opens which panel and in
  what order. Say what the feature is and what it lets somebody do, and let the screenshots show
  the interface. The post gets *less* detailed as it goes, not more: it closes on an invitation,
  never on a walkthrough.
- **No emoji.**
- **Hashtags.** About sixteen on the final line, each a `#` followed by a PascalCase term: six to
  eight broad ones drawn across the bank in [reference/hashtags.md](reference/hashtags.md), and the
  rest naming what this post is about. The broad ones are how someone who has never heard of any of
  this finds it; the line stays short because every tag is spent from the budget above, and a
  longer one reads as spam to the person scrolling past it. Sixteen is what a post of ordinary
  length comes to rather than a count to hit — a short post takes fewer.
- **SEO.** Name the technologies and concepts plainly in the prose — search engines read the
  page, and the `:k:` line is only part of it.
- **Truth.** **Every item you name is read as shipped; an open tail is read as an invitation.** So
  check each named item against the code, and let the tail carry the future — "stairs, vast halls
  of high ceilings, and other architectural wonders" is fair, because stairs and tall halls exist
  and the tail promises nothing specific. Naming a feature that does not exist yet is not fair,
  however open the phrase after it.

Then read the draft back against two checklists and fix what fails: "The checks" at the end of
[`../../writing-style.md`](../../writing-style.md), and then the post-specific one at the end of
[reference/writing.md](reference/writing.md). Run them as written, one pass per test, on the
finished text. The first check is the one that matters most and the easiest to skip: **would a
stranger want to click after reading this?** If the honest answer is "it is accurate", the draft
has failed and needs rewriting rather than polishing.

## Step 4 — Hand it over

The post is finished when the user has read it, not when it is in the file. **Stop here and ask them
to review it**, giving them everything they need to judge it without opening anything:

- The post's title, and which `page-<N>.html` it will become (the oldest block in `source.txt` is
  page 1, so the new one is the block count).
- The **full post text as they will paste it**, in a copyable block, with its prose length against
  the house length of about 600 characters. Report that number, not the distance to the ceiling —
  the room left under a platform limit says nothing about whether the post is the right size.
- What is left to them: the screenshots. Say where they go — a JPEG in `public/devlog-<year>/`, and
  a line of the form `<name>` on its own between the paragraphs it illustrates (see
  [reference/post-format.md](reference/post-format.md#images)).
- That the page is generated from `source.txt` by the SSG — `npm run beforeCommit` before the
  commit, or `MODE=ssg node dist/server/bundle.js` on its own for a local preview at
  `http://127.0.0.1:3000/devlog-<year>/page-<N>.html` once a dev server is up. Opening a new dev-log
  year needs the first of the two, since it touches `libraryData.ts`. This skill neither generates
  nor commits anything.

When they come back with notes, revise the block in place (see the revision rule above) and put the
new version in front of them again. A note about how dev-log posts are *written*, rather than about
this one, belongs in the guidance rather than only in the draft: fold it into the principle it is an
instance of in [`../../writing-style.md`](../../writing-style.md) (how to write) or
[reference/writing.md](reference/writing.md) (what a post must contain) — never as a new bullet
appended beside them. The full rule for that is "How an improvement is written" in
[`../skill-upkeep/SKILL.md`](../skill-upkeep/SKILL.md).
