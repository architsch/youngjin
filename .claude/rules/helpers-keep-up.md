# Helpers Keep Up With Every Feature

The rule in one line, as [`../../CLAUDE.md`](../../CLAUDE.md) states it: **when a feature is added or
changed, what the helpers are told and the fixed words they say change with it, in the same change,
unasked.** This page is why, and what that touches. Its twin for what AI agents can do and read over MCP
is [`agents-keep-up.md`](agents-keep-up.md); most features change both.

## Why

The helpers are the NPCs played as AI guides, by the server in multiplayer rooms and by the browser in
single-player ones (see [`../../docs/networking/agents.md`](../../docs/networking/agents.md)). Claude
writes their replies through the Anthropic API, from instructions sent with every reply; everything else
they say is fixed words no model writes. They know the game only from that text, and repeat it to every
visitor: a feature the guide doesn't describe is one they make up the how of, a changed one they go on
teaching as it was, and a removed one they still send people looking for. Nothing fails when this drifts.

## What a change touches

The instructions Claude replies from, put together in `HelperChatUtil`:

1. **The guide** (`src/server/agent/data/helperGuide.ts`): how to play, from a player's side. Helpers
   answer how-to questions from it alone, so whatever changes what a player can do, or how, changes it:
   a few words in the basics (the control it is done with, as its picture), anything more in the
   details. A feature that arrives comes off its "Not in the game".
2. **The rules** (`RULES` in `helperChatUtil.ts`): how every helper talks. They change only for what
   every reply must handle differently (a new kind of markup or of speaker), never to carry a feature's
   facts, which are the guide's.
3. **The knowledge, the characters and the topics** (`helperKnowledge.ts`, `helperPersonalities.ts`,
   `helperTopics.ts`): every line of ThingsPool's story, idea to try, favorite or mood that names the
   feature. A feature worth trying may become an idea there, in the guide's words.

The fixed words:

4. **Greetings and basics** (`HelperBehaviorUtil.getGreeting`, `NpcPersonalityMap`), **small talk**
   (`helperSmallTalk.ts`), **remarks** (`helperRemarks.ts`) and the **stand-in replies** for when no
   reply can be had (`REFUSAL_LINES` in `HelperAgentUtil`): every line on how to walk, chat or build, or
   that names the feature.
5. **A scripted NPC's words** in a single-player mode (its `SinglePlayerModeClientConfig`), where they
   teach the feature.

What they show and look at:

6. **Pictures of controls** (`ScreenControlMap`; see `docs/gameplay/chat.md`): helpers write a control
   as its picture, never as a key or a place on the screen. A control they newly name gets a picture
   first (the `helper-instructions` skill says how); a renamed or removed one leaves no line naming it.
7. **Sights** (`HelperBehaviorUtil`'s `findSights`): a new kind of thing in a room may be one they go and
   look at, with remark lines of its own kind.

None of it names a number a constant holds (a price, a reward, a distance, a time, a limit): the
constant changes, and helpers go on repeating what they heard. It says it the way a player meets it
("a locked shape shows its price", "for a little while"); a test checks.

## Two more changes that reach them

- **A pictured control's look.** A control a message pictures (`<control name="..."/>`, mostly in
  helpers' replies) is drawn by `ScreenControlPicture`, a hand-made copy that shares only the control's
  icon. **Whenever a pictured control's look changes** (its frame, face, color, icon or text), **its
  picture changes to match in the same change**; nothing else carries the redesign over.
- **A picture keyword.** The keywords of the picture map's entries (its `manifest.json`, which canvases'
  and props' pictures come from) also decide what helpers like or dislike in a picture they look at
  (`src/server/agent/data/helperTastes.ts`). **Whenever a keyword is added, renamed or dropped**, by the
  image map editor or by hand, **`helperTastes.ts` classifies it in the same change**: under the interest
  it shows, or in `UNREMARKED_KEYWORDS` when it shows none or could mean two things. `helper.test.ts`
  fails on a keyword left out, and on one no picture has any longer.

## How

1. **Find every line that names the feature**, by its new words, its old ones and its controls' names:
   grep `src/server/agent/data/`, `RULES`, `NpcPersonalityMap` and `REFUSAL_LINES`, not only the guide.
   A line made untrue is rewritten or removed, never left beside a new one.
2. **Write it** as the [`helper-instructions`](../skills/helper-instructions/SKILL.md) skill says: true,
   brief, in plain words and each character's voice, minding the size of the part every reply sends.
3. **Check it**: `npx vitest run tests/integration/scenarios/helper.test.ts`, then that skill's samplers.
   When what Claude is told changed, hear it answer questions about the feature, from each character it
   concerns (and `--untold`, when the basics changed); when fixed words changed, read the small talk or
   remarks they make.
4. **Say so** in the hand-over: what changed in what the helpers are told and say, with a few replies
   heard, or that the change needed nothing there, and why.

## Where the line falls

- A change with no effect a player could notice (a refactor, a speed-up) touches none of this, and a
  purely visual one (a shader, a particle) at most a word, unless it is a pictured control's look.
- Helpers describe the game as a person in a browser meets it. What agents can do and read is the other
  rule's.
- The `helper-instructions` skill says how these texts are written; this page says when they change.
