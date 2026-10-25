---
name: helper-instructions
description: Bring up to date what the helpers (the NPCs an admin places, which the server plays as AI guides through Claude) are told — the guide to playing, the knowledge they share of ThingsPool's story, ideas to try and the library's writings, each personality's character and the things on its mind — and the fixed small talk they say to one another, from the dev log, the library, well-known facts and the game as it is now; check every claim and address; then hear the helpers answer through the real model, and read their small talk, before handing the change over. Use when asked to update, enrich or refresh what the helpers or NPCs know or say (to visitors or to each other), after new dev-log posts or library writings or new features, or when a helper is reported saying something wrong, stale or dull.
---

# Helper Instructions

A helper knows only what it is told, and is told the same thing on every reply. Whatever is wrong or
missing in that text, every helper in every room repeats to every visitor, so this skill keeps it
true, current and worth listening to. Helpers also chat with each other in fixed words that no model
writes, which visitors overhear, so those are kept the same way. It is a small job: read the sources,
edit a handful of files, run one test file, and listen to the result.

## What the helpers are told

One system prompt, in two parts (built in `src/server/agent/util/helperChatUtil.ts`):

| Part | File | What it holds |
|---|---|---|
| Shared, cached | `RULES` in `helperChatUtil.ts` | How every helper talks. Rarely changes; change it only for a fault every helper shows. |
| | `src/server/agent/data/helperGuide.ts` | How to play, from a player's side: the basics a how-to answer gives, and the details for someone who asks for more. The helpers answer how-to questions from it alone. |
| | `src/server/agent/data/helperKnowledge.ts` | ThingsPool's story so far, things worth trying, the writings the characters name as favorites, the art and the games. |
| Each helper's own | `src/server/agent/data/helperPersonalities.ts` | Each character: who it is, its field of subjects across the whole world, its voice and a line in it (an idea to try, never a fact it could reuse), its favorite ideas and reads. |
| | `src/server/agent/data/helperTopics.ts` | Each personality's list of things on its mind: specific, true statements from the world and from the maker's writings (with links). Three, picked at random, go with each talk, so free talk ranges wide; only those are sent, so the lists cost nothing to grow. |

Each line a helper hears starts with "(knows how to play)", "(not yet told how to play)" or "(an AI agent)",
never the speaker's name, which the model would otherwise put in every reply. Whoever was never told how to
walk and build hears it once, in fixed words, from the first helper to
greet them (`NpcPersonalityMap`'s `basics`; the `Basics` FTUE element, which the tutorial's last lesson
records too), and the rules give the basics only to them, and only when asked. Nothing a helper is
told or says names a keyboard key: many play on phones (a test checks). Nor does it say where on the
screen a control is: a control is written as its picture, `<control name="trash"/>`, which a bubble
shows as a small copy of the control and agents hear as its words (names in `ScreenControlMap`; see
`docs/gameplay/chat.md`; a test checks every name).

`src/shared/object/maps/npcPersonalityMap.ts` holds what an admin is shown for each personality, what
it greets people as and how it tells the basics. A new personality touches `NpcPersonality`, that map,
`HELPER_PERSONALITIES`, `HELPER_TOPICS` and `HELPER_SMALL_TALK` together; one that is not played (like
Idle) has no role, no character, no topics and no small talk.

The guide is also bound by the agents-keep-up rule (`.claude/rules/agents-keep-up.md`): when it
changes because the game did, the other things agents read may need the same change.

## What the helpers say to each other

Two helpers near each other chat now and then, in the fixed words of
`src/server/agent/data/helperSmallTalk.ts` (`HELPER_SMALL_TALK`), one voice for each played
personality. `HelperSmallTalkUtil` puts a chat together from the two voices:

1. one says a hello and brings something up: an **opener**, on a topic;
2. the other gives its **answer** on that topic;
3. the first adds the opener's **then**, a second thought (or else, mostly, a nod);
4. the other says goodbye (after a nod, sometimes).

Any opener can meet any voice's answer, so the lines only work if each keeps to its part:

- An **answer** reacts to its topic, never to one particular opener: it has to follow every opener
  on that topic, from every voice. So it is the speaker's own concrete favorite or fact on the
  topic ("My favorite book is 'The Hobbit' by J.R.R. Tolkien."), never a general musing. Every voice
  answers every topic (`HelperSmallTalkTopic`), each a plain noun: the game's (visitors, building,
  doors, lamps, paintings, history) and the world's (games, books, space, places, and so on). A new
  topic needs an answer in all eight voices.
- An **opener** names its topic in its own words (a door, a game, a book), or the answers on that
  topic seem to come from nowhere.
- A **then** follows its own opener and whatever answer came between, so it continues the opener's
  idea rather than replying to the answer, and names its subject again ("Descartes tried...", not
  "He tried..."): after another's answer, a bare "it" or "he" points at the wrong thing.
- An opener drawn from one of the maker's writings names that page in `from`. Nobody hears it; it
  shows what the small talk already covers.

## Step 1 — Read the sources, not memory

- **The dev log**, `public/devlog-<year>/source.txt`: every post newer than the last line of the
  story so far becomes a line of it, dated, in a few plain words. A new feature, or a new turn in
  ThingsPool's story, also becomes an opener or two in the small talk (the game's topics, with its
  date and the button that does it), and answers on those topics may need a word for it.
- **The library**, indexed in `src/server/ssg/data/libraryData.ts`, each writing's text in
  `public/<dirName>/source.txt`. Read a writing before describing it. Its address is the page it is
  published as (`https://thingspool.net/<dirName>/page-<N>.html`, or `list.html` for a series). For
  the small talk, take from a writing a concrete claim someone who never read it can follow at once
  (cats tamed humans; a horror game should give its ghosts gyms), and see which writings the openers'
  `from` already covers, to draw on others.
- **The game**, for the guide and every idea: the `/docs` page of the feature, and the UI code under
  `src/client/ui/components/hud/` for what a player actually clicks.
- **The world**, for the small talk's books, people, places and things: only facts that are well known
  and certain. Look up any date, number or attribution you are not sure of, and leave out what you
  can't confirm.
- **What went wrong**, when a helper was reported saying something: find the line it came from, or
  the gap it filled by guessing.

## Step 2 — Write it

- **True.** Every feature an idea, the knowledge or a line of small talk names works as the guide
  says. If the guide doesn't say how, add that to the guide from the UI code, or drop the idea. A
  helper told about a thing without the how makes the how up.
- **Brief how-to.** A new feature's how goes into the guide's basics in a few words (the button or
  switch it is done with, as its picture's markup, never a key or where on the screen it is), and
  anything more into its details, which a helper gives only to someone who asks. Leave out what a
  player sees anyway (every part the character editor lists, every setting of a fan): the model passes
  on whatever sits beside the basics. A control with no picture yet gets one: a name and its words in
  `ScreenControlMap`, its drawing in `ScreenControlPicture` (from the control's own icon and face), and
  its width in `ScreenControlPictureUtil`. A tall one (a slider standing upright) doesn't fit a line of
  text, so it is named in words instead.
- **Real addresses only**, each a page under `public/` (a test checks), and each written as the link a helper gives,
  `<link href="https://...">read it</link>`, a word or two its button's words: the model copies that markup more
  faithfully than it follows a rule about links (see `docs/gameplay/chat.md`).
- **Visitors know nothing of the website.** Nobody arriving in the game knows that ThingsPool has a
  website with writings, art and games on it. So nothing the helpers are told calls those by the
  site's own section names ("the library", "the arcade") as if they were known, and the rules have a
  helper introduce a writing in one sentence: its title, who wrote it, what kind of writing it is, in a
  few words what it is about, and its link.
- **A writing gets one entry**: its title in quotes as published, what kind of writing it is (an essay,
  a story in 12 chapters), who wrote it where that isn't ThingsPool's maker, its link, and one
  specific thing from it a helper can retell. A bare link is not enough: the model cannot open
  pages, so it would have nothing to say about one.
- **Satire is labelled**, with what it pokes fun at. Crude jokes are not repeated, and writings about
  politics or other divisive subjects are left out: helpers talk with everyone.
- **Characters**: favorite reads by the knowledge's exact titles (a test checks); ideas using only the
  guide's tools; one example line, which the rules forbid saying, so it is only a taste of the voice,
  and no two characters' lines open alike. Make the line an idea to try, never a fact: the model
  reuses a fact in its example line as its favorite, crowding out the topics, and a how-to example
  makes it give steps unasked. Every voice is as plain and precise as the small talk (see
  below): a character shows in what it names and how it reacts, never in metaphors, riddles or puns.
  Ask a voice only for what the model can do truthfully: a voice told to name a thinker for each idea
  makes up quotes (even a sage told to quote only what is true puts Socrates on a building tip unless
  told never to dress up a tip), one told to tell everything as a story makes up stories and wraps
  how-to answers in tales, and one given a pose ("a big grin") may narrate it ("Pip grins: ...").
- **Small talk**:
  - **Precise and clear on its own.** Whoever reads a line knows nothing of where it comes from, may
    read English as a second language, and may have walked up mid-chat. Each line is a plain,
    checkable statement about something named: a book and its author, a person, a place, a date, an
    animal, a button in the game ("'Flatland' is a novel from 1884 by Edwin Abbott."). No metaphor,
    no poetic musing, no pun or idiom that needs a feel for English, no in-joke. An idea that needs
    its writing's setup to make sense is left out, however good. Humor comes from a funny true fact
    or a plain exaggeration ("Cats sleep up to 16 hours a day. That's my dream job!").
  - **Every fact true**: the game's as the guide has them; the world's well known and certain (a
    number rounded, a legend called a legend). When unsure of one, leave it out.
  - Each part stays under about 120 characters as it shows (a link counts as its words; a hello or
    a nod may go in front), in its character's voice, so that the same idea sounds different from
    each.
  - An idea from a writing is retold as the writing has it, satire as satire, and credited to
    "Youngjin, who made ThingsPool" where it could pass for a fact about the game or the world. A
    line that names a writing gives its title and what kind it is, and only a then carries a link,
    so a chat has at most one.
  - Nothing is claimed to have happened in the game that didn't ("someone built a castle today"): a
    fact, a favorite or an opinion is fine. No visitor is named or described.
  - Variety comes from more openers and more answers, not longer ones: every voice opens on several
    topics, and a topic many openers share gets more than one answer in each voice, or the same answer
    follows every one of them.
- **Topics** (`helperTopics.ts`) follow the small talk's rules for truth and plain words: each a
  statement about something named, in its personality's field, the world's facts well known and certain.
  An idea from a writing is a whole entry, as in the knowledge (title, kind, the link, the idea), retold as
  the writing has it. No entry appears twice across the lists (a test checks). A writing whose idea is a
  topic need not be in the knowledge too, which keeps the shared part small.
- **Simple words** throughout. Many visitors read English as a second language, and the helpers
  borrow the wording they are given.
- **Mind the size.** The shared part is read from the cache on every reply, and paid in full again
  after five quiet minutes. A few thousand tokens is fine; keep it under about six thousand, and
  make room by cutting the stalest lines rather than by squeezing every line. The small talk is
  never sent to the model, so it costs nothing to grow.

Every file under `src/` is changed with Edit or Write, never a shell command
(`.claude/rules/source-edits.md`).

## Step 3 — Check it

```bash
npx vitest run tests/integration/scenarios/helper.test.ts
```

Then hear them. The sampler asks the real model as each played personality would be asked, and
prints the things on its mind in that talk, every reply, its length, and the tokens the run took:

```bash
ANTHROPIC_API_KEY="$(gcloud secrets versions access latest --secret=ANTHROPIC_API_KEY --project=thingspool)" \
    node dev/scripts/helper/sampleHelperReplies.js
```

`--personality=<id>` hears one, and each `--line="..."` replaces the default lines; ask about
whatever was added. The speaker knows how to play, as most do; `--untold` speaks as one never told.
A full run costs well under a cent, outside the helpers' daily budget. Fetch the key inline like this,
and never print it.

Read every reply. Each should be in its character's voice, true, short, specific (a named thing, often
one of the things on its mind in free talk), plain and precise (no metaphor, loose comparison, riddle
or pun, no made-up quote, story or number, no narration of what the helper does), a how-to answer only
the guide's basics, with nothing added, and only when asked, never a key, each control as its picture's
markup (by a name `ScreenControlMap` has, never where on the screen it is), and never an example line said
back. No reply welcomes the visitor again or gives the helper's name (a short hello back to a hello is
fine); ask with lines that open "hi!", which draw both out. "What can I do here?" from one who knows how to
play gets an idea to try, not the basics; from one not yet told, the basics, and never a room of their own
(people build in the rooms they visit). A writing comes up only when it fits the talk, at most one in a reply, named in one sentence as
to someone who has never heard of the website, with its link, whose words are a word or two (a longer
label shows as text before a button with the site's name). Addresses appear only inside links. Ask each
character for something to read a few times over: a voice can turn a recommendation into a teaser that
names nothing. A reply whose link the cut would leave out is asked for again, shorter (see
`HelperChatUtil`), so a sampled reply may have taken two requests.
`cacheReadTokens` and `cacheWriteTokens` in the last line show the shared part's size.

Then read the small talk, which asks no model and costs nothing:

```bash
node dev/scripts/helper/sampleSmallTalk.js [--pair=jester,sage] [--count=3]
```

It prints a chat for every pair of personalities (or `--count` chats for one `--pair`), each line
with how long it shows, flagging long ones. Run it a few times for every voice you touched: each line
should say something precise that someone who has never seen its source follows at once, follow
the one before whoever says it, and sound like its speaker. Check every fact you added.

## Step 4 — Hand it over

Report what changed in each file, a few of the replies heard and chats read, and what the shared part
now weighs. Nothing ships until the user commits and deploys.
