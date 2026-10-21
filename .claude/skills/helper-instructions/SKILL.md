---
name: helper-instructions
description: Bring up to date what the helpers (the NPCs an admin places, which the server plays as AI guides through Claude) are told — the guide to playing, the knowledge they share of ThingsPool's story, ideas to try and the library's writings, and each personality's character — from the dev log, the library and the game as it is now; check every claim and address; then hear the helpers answer through the real model before handing the change over. Use when asked to update, enrich or refresh what the helpers or NPCs know or say, after new dev-log posts or library writings, or when a helper is reported saying something wrong, stale or dull.
---

# Helper Instructions

A helper knows only what it is told, and is told the same thing on every reply. Whatever is wrong or
missing in that text, every helper in every room repeats to every visitor, so this skill keeps it
true, current and worth listening to. It is a small job: read the sources, edit up to four files,
run one test file, and listen to the result.

## What the helpers are told

One system prompt, in two parts (built in `src/server/agent/util/helperChatUtil.ts`):

| Part | File | What it holds |
|---|---|---|
| Shared, cached | `RULES` in `helperChatUtil.ts` | How every helper talks. Rarely changes; change it only for a fault every helper shows. |
| | `src/server/agent/data/helperGuide.ts` | How to play, from a player's side. The helpers answer how-to questions from it alone. |
| | `src/server/agent/data/helperKnowledge.ts` | ThingsPool's story so far, things worth trying, the library's writings, the art and the games. |
| Each helper's own | `src/server/agent/data/helperPersonalities.ts` | Each character: who it is, its voice and a line in it, its favorite ideas and reads. |

`src/shared/object/maps/npcPersonalityMap.ts` holds what an admin is shown for each personality and
what it greets people as. A new personality touches `NpcPersonality`, that map and
`HELPER_PERSONALITIES` together; one that is not played (like Idle) has no role and no character.

The guide is also bound by the agents-keep-up rule (`.claude/rules/agents-keep-up.md`): when it
changes because the game did, the other things agents read may need the same change.

## Step 1 — Read the sources, not memory

- **The dev log**, `public/devlog-<year>/source.txt`: every post newer than the last line of the
  story so far becomes a line of it, dated, in a few plain words.
- **The library**, indexed in `src/server/ssg/data/libraryData.ts`, each writing's text in
  `public/<dirName>/source.txt`. Read a writing before describing it. Its address is the page it is
  published as (`https://thingspool.net/<dirName>/page-<N>.html`, or `list.html` for a series).
- **The game**, for the guide and every idea: the `/docs` page of the feature, and the UI code under
  `src/client/ui/components/hud/` for what a player actually clicks.
- **What went wrong**, when a helper was reported saying something: find the line it came from, or
  the gap it filled by guessing.

## Step 2 — Write it

- **True.** Every feature an idea or the knowledge names works as the guide says. If the guide
  doesn't say how, add that to the guide from the UI code, or drop the idea. A helper told about a
  thing without the how makes the how up.
- **Real addresses only**, each a page under `public/` (a test checks), and each written as the link a helper gives,
  `<link href="https://...">read it</link>`, a word or two its button's words: the model copies that markup more
  faithfully than it follows a rule about links (see `docs/gameplay/chat.md`).
- **Visitors know nothing of the website.** Nobody arriving in the game knows that ThingsPool has a
  website with writings, art and games on it. So nothing the helpers are told calls those by the
  site's own section names ("the library", "the arcade") as if they were known, and the rules have a
  helper introduce a writing in full: its title, who wrote it, what kind of writing it is, what it is
  about, and its link.
- **A writing gets one entry**: its title in quotes as published, what kind of writing it is (an essay,
  a story in 12 chapters), who wrote it where that isn't ThingsPool's maker, its link, and one
  specific thing from it a helper can retell. A bare link is not enough: the model cannot open
  pages, so it would have nothing to say about one.
- **Satire is labelled**, with what it pokes fun at. Crude jokes are not repeated, and writings about
  politics or other divisive subjects are left out: helpers talk with everyone.
- **Characters**: favorite reads by the knowledge's exact titles (a test checks); ideas using only the
  guide's tools; one example line, which the rules forbid saying, so it is only a taste of the voice,
  and no two characters' lines open alike.
- **Simple words** throughout. Many visitors read English as a second language, and the helpers
  borrow the wording they are given.
- **Mind the size.** The shared part is read from the cache on every reply, and paid in full again
  after five quiet minutes. A few thousand tokens is fine; keep it under about six thousand, and
  make room by cutting the stalest lines rather than by squeezing every line.

Every file under `src/` is changed with Edit or Write, never a shell command
(`.claude/rules/source-edits.md`).

## Step 3 — Check it

```bash
npx vitest run tests/integration/scenarios/helper.test.ts
```

Then hear them. The sampler asks the real model as each played personality would be asked, and
prints every reply, its length, and the tokens the run took:

```bash
ANTHROPIC_API_KEY="$(gcloud secrets versions access latest --secret=ANTHROPIC_API_KEY --project=thingspool)" \
    node dev/scripts/helper/sampleHelperReplies.js
```

`--personality=<id>` hears one, and each `--line="..."` replaces the default lines; ask about
whatever was added. A full run costs well under a cent, outside the helpers' daily budget. Fetch the
key inline like this, and never print it.

Read every reply. Each should be in its character's voice, true, short, about ThingsPool, and never
an example line said back. A writing comes up only when it fits the talk, at most one in a reply,
introduced as to someone who has never heard of the website, with its link, whose words are a word or
two (a whole title as a button's words is cut short). Addresses appear only inside links. Ask each
character for something to read a few times over: a voice can turn a recommendation into a teaser that
names nothing.
`cacheReadTokens` and `cacheWriteTokens` in the last line show the shared part's size.

## Step 4 — Hand it over

Report what changed in each file, a few of the replies heard, and what the shared part now weighs.
Nothing ships until the user commits and deploys.
