# Helpers Keep Up With Every Feature

The rule in one line, as [`../../CLAUDE.md`](../../CLAUDE.md) states it: **when a feature is added or
changed, what the helpers are told and the fixed words they say stay true to it, in the same change,
unasked: in outline only, never how it works.** This page is why, and what that touches. Its twin for
what AI agents can do and read over MCP is [`agents-keep-up.md`](agents-keep-up.md); most features
change that one far more than this one.

## Why

The helpers are the NPCs played as AI guides, by the server in multiplayer rooms and by the browser in
single-player ones (see [`../../docs/networking/agents.md`](../../docs/networking/agents.md)). Claude
writes their replies through the Anthropic API, from instructions sent with every reply; everything else
they say is fixed words no model writes. They know the game only from that text, and repeat it to every
visitor: a changed feature they go on teaching as it was, and a removed one they still send people
looking for. Nothing fails when this drifts.

But they are not the game's manual, and their instructions are not its encyclopedia. At the maker's
wish (2026-11-12), what they are told is **mostly ThingsPool's maker, his writings and the subjects
those join**, which is what makes them worth talking to. Of the game they are told only **an outline**:
what people can do in general (explore, chat, build, change how they look), the kinds of thing they can
add to a room, and the kinds of thing they can unlock or buy. How a feature works is never part of it.
People find that out by playing, a helper asked about it says so, and every such line would take room
that belongs to the conversation.

## What never goes in

- **Mechanics**: how fast, how far, how hard or how long; what bounces off, breaks, pushes or throws
  what; how a thing aims, chooses or counts; forces, physics and timing of any kind.
- **Settings and states**: every option a thing has, every state a counter or a light shows, what a
  refusal says, what the screen marks with a lock or an outline.
- **Anything a player sees for themselves** within a moment of trying the thing.
- **A number a constant holds** (a price, a reward, a distance, a time, a limit): the constant changes,
  and helpers go on repeating what they heard. Said, if at all, the way a player meets it ("an item you
  can unlock shows its price"); a test checks.

The test for a line: would someone who has never played need it to start doing the thing? If not, it
stays out, however new or clever the feature. This holds for the fixed words too: a line of small talk or
a remark may mention a feature, never explain how it works.

## What a change touches

The instructions Claude replies from, put together in `HelperChatUtil`:

1. **The guide** (`src/server/agent/data/helperGuide.ts`): the outline. It changes only when a change
   adds, removes or renames something on the outline's own level: a new thing people can do, a new kind
   of thing to add to a room or to unlock or buy, a control something is done with. Then it gets a few
   words: what the thing is, in a clause, and the control it is done with, as its picture. A feature
   that arrives comes off its "Not in the game". A change to how an existing thing behaves touches it
   only where a line turns untrue. A test holds its length (`HELPER_GUIDE_MAX_LENGTH`): a guide that
   outgrows it has taken on details, which are cut, not the cap raised.
2. **The rules** (`RULES` in `helperChatUtil.ts`): how every helper talks. They change only for what
   every reply must handle differently (a new kind of markup or of speaker), never to carry a feature's
   facts.
3. **The knowledge, the characters and the topics** (`helperKnowledge.ts`, `helperPersonalities.ts`,
   `helperTopics.ts`): every line of ThingsPool's story, idea to try, favorite or mood that names the
   feature. A feature worth trying may become one idea there, in the guide's words. The rest of the
   knowledge is the maker and his writings, which a feature doesn't touch.

The fixed words:

4. **Greetings and basics** (`HelperBehaviorUtil.getGreeting`, `NpcPersonalityMap`), **small talk**
   (`helperSmallTalk.ts`), **remarks** (`helperRemarks.ts`) and the **stand-in replies** for when no
   reply can be had (`REFUSAL_LINES` in `HelperAgentUtil`): every line on how to walk, chat or build, or
   that names the feature, where the change made it untrue.
5. **A scripted NPC's words** in a single-player mode (its `SinglePlayerModeClientConfig`), where they
   teach the feature.

What they show and look at:

6. **Pictures of controls** (`ScreenControlMap`; see `docs/gameplay/chat.md`): helpers write a control
   as its picture, never as a key or a place on the screen. A control they newly name gets a picture
   first (the `helper-instructions` skill says how); a renamed or removed one leaves no line naming it.
7. **Sights** (`HelperBehaviorUtil`'s `findSights`): a new kind of thing in a room may be one they go and
   look at, with remark lines of its own kind.

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
   A line made untrue is rewritten or removed, never left beside a new one. Most changes to how
   something behaves find nothing to change, and that is the right outcome.
2. **Write it**, if anything, as the [`helper-instructions`](../skills/helper-instructions/SKILL.md)
   skill says: true, a clause or a line, in plain words, minding the size of the part every reply sends.
3. **Check it**: `npx vitest run tests/integration/scenarios/helper.test.ts`, then that skill's samplers.
   When what Claude is told changed, hear it answer questions about the feature, from each character it
   concerns (and `--untold`, when the basics changed); when fixed words changed, read the small talk or
   remarks they make.
4. **Say so** in the hand-over: what changed in what the helpers are told and say, with a few replies
   heard, or that the change needed nothing there, and why.

## Where the line falls

- A change with no effect a player could notice (a refactor, a speed-up) touches none of this, and a
  purely visual one (a shader, a particle) at most a word, unless it is a pictured control's look.
- A change to how something behaves (a ball that now bounces, a fan that pushes harder, a new limit)
  touches none of it either, unless it leaves a line untrue. It is the agents' instructions that carry
  such things, since agents act on them and have no screen to learn from.
- Helpers describe the game as a person in a browser meets it. What agents can do and read is the other
  rule's.
- The `helper-instructions` skill says how these texts are written; this page says when they change.
