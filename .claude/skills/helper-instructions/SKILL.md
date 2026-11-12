---
name: helper-instructions
description: Bring up to date what the helpers (the NPCs an admin places, which the server plays as AI guides through Claude) are told — mostly ThingsPool's maker, his writings and the subjects they join, with ThingsPool's story, ideas to try, and no more than an outline of the game itself (what people can do, add to a room, unlock or buy; never how a feature works), each personality's character and the things on its mind — and the fixed words they say without a model, the small talk to one another and the remarks on things they go and look at (with the tastes and picture keywords behind those), from the library, the dev log, well-known facts and the game as it is now; check every claim and address; then hear the helpers answer through the real model, and read their small talk and remarks, before handing the change over. Use when asked to update, enrich or refresh what the helpers or NPCs know or say (to visitors, to each other, or of the things around them), after new library writings or dev-log posts, when a new feature changes the outline of what people can do, or when a helper is reported saying something wrong, stale or dull.
---

# Helper Instructions

A helper knows only what it is told, and is told the same thing on every reply. Whatever is wrong or
missing in that text, every helper in every room repeats to every visitor, so this skill keeps it
true, current and worth listening to. Helpers also chat with each other in fixed words that no model
writes, which visitors overhear, so those are kept the same way. It is a small job: read the sources,
edit a handful of files, run one test file, and listen to the result.

**What fills it, at the maker's wish (2026-11-12):** mostly ThingsPool's maker, his writings and the
subjects those join, so that a talk with a helper is rich and can go anywhere. Of the game itself the
helpers are told an outline and nothing more: what people can do in general, the kinds of thing they
can add to a room, and the kinds of thing they can unlock or buy. They are not the game's manual, and
their instructions are no encyclopedia of its mechanics: a new feature never brings how it works with
it (see "An outline, not a manual" below, and `.claude/rules/helpers-keep-up.md`).

## What the helpers are told

One system prompt, in two parts (built in `src/server/agent/util/helperChatUtil.ts`):

| Part | File | What it holds |
|---|---|---|
| Shared, cached | `RULES` in `helperChatUtil.ts` | How every helper talks. Rarely changes; change it only for a fault every helper shows. |
| | `src/server/agent/data/helperGuide.ts` | An outline of the game, from a player's side: what people can do, the kinds of thing they can add to a room, what dollars unlock or buy, each with the control it is done with, and what is not in the game. All a how-to answer gives; never how a thing works. A test holds its length. |
| | `src/server/agent/data/helperKnowledge.ts` | The larger part by far: who ThingsPool's maker is, what he writes about and how he joins one field to another, and his writings by subject, each with its link and one idea from it; then ThingsPool's story so far, things worth trying, his art and his games. |
| Each helper's own | `src/server/agent/data/helperPersonalities.ts` | Each character: who it is, its field of subjects across the whole world, its voice and a line in it (an idea to try, never a fact it could reuse), its favorite ideas and reads, its manner in small talk, and its moods: one is picked at random for each talk, and its small talk comes from it, so that it doesn't greet everyone in the same words. |
| | `src/server/agent/data/helperTopics.ts` | Each personality's list of things on its mind: specific, true statements from the world and from the maker's writings (with links). Three, picked at random, go with each talk, for when a visitor leaves the subject to the helper, so what it brings up ranges wide; only those are sent, so the lists cost nothing to grow. |

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
`HELPER_PERSONALITIES`, `HELPER_TOPICS`, `HELPER_SMALL_TALK`, `HELPER_TASTES` and `HELPER_REMARKS`
together; one that is not played (like Idle) has no role, no character, no topics, no small talk, and no
tastes or remarks.

When all of this must change is the helpers-keep-up rule's to say (`.claude/rules/helpers-keep-up.md`):
with every feature, in the same change, but in outline only, which for most changes means not at all.
What agents read is another matter (`.claude/rules/agents-keep-up.md`): agents act on the details, and
get them.

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

## What the helpers say of what they look at

Now and then, in place of a wander, a helper goes and looks at something placed near it and says what
it thinks of it, in fixed words too (`HelperRemarkUtil`):

- `src/server/agent/data/helperTastes.ts`: the **interests** a helper may like or dislike (coffee, old
  things, music, a color, lamps, doors…), each with the phrase it is called by and the picture keywords
  that show it; `UNREMARKED_KEYWORDS`, the keywords that show none; `UNSPOKEN_KEYWORDS`, those of
  things helpers never speak of (Korea and its food), whose pictures are never remarked on; and what each personality loves,
  likes and dislikes. Each helper adds a few tastes of its own, by its NPC's id, with a favorite color
  and painter. Every keyword in the picture map's manifest is in exactly one of these (a test checks),
  so a new keyword is classified when it arrives (see `.claude/rules/helpers-keep-up.md`). One that could mean two things (`fish`, food or a pet) shows none: a wrong interest gives a
  wrong reason ("The planted aquarium! I love seafood.").
- `src/server/agent/data/helperRemarks.ts`: each voice's **lines**, by how much it likes the thing
  (love, like, meh, dislike, mixed), some for one kind of thing alone (a painting, a door, a mirror),
  and the **word pools** for their gaps (adjectives and common phrases picked at random, so the same
  thing is seldom spoken of the same way twice).

## Step 1 — Read the sources, not memory

- **The library**, the main source: indexed in `src/server/ssg/data/libraryData.ts`, each writing's
  text in `public/<dirName>/source.txt`, which is read and never written (read it with the Read tool
  or plain grep; a hook refuses an inline script that names one). A post starts at a `[Title] date`
  line, the Nth such line in a file being page N, under the author's own `:d:` description and `:k:`
  keywords: `grep -n "^\[\|^:d:\|^:k:"` over a file lists its posts. Read a writing before describing
  it. Its address is the page it is published as (`https://thingspool.net/<dirName>/page-<N>.html`,
  or `list.html` for a series). Take from a writing a concrete claim someone who never read it can
  follow at once (cats tamed humans; a horror game should give its ghosts gyms), and note which fields
  it joins. Every new post gets an entry in the knowledge, under its subject; see which writings the
  knowledge, the topics and the small talk's `from` already cover, to draw on others.
- **The maker**, from what he has published about himself: the portfolio page
  (`views/partial/info/portfolio.ejs`) and his memoirs in the library. Nothing he hasn't published, and
  nothing of Korea (see below).
- **The dev log**, `public/devlog-<year>/source.txt`: every post newer than the last line of the
  story so far becomes a line of it, dated, in a few plain words. A new turn in ThingsPool's story
  may also become an opener or two in the small talk (the game's topics, with its date).
- **The game**, only for the guide's outline and the ideas to try: the UI code under
  `src/client/ui/components/hud/` for what a player actually clicks. A feature's `/docs` page says how
  it works, which the helpers are not told.
- **The world**, for the small talk's books, people, places and things: only facts that are well known
  and certain. Look up any date, number or attribution you are not sure of, and leave out what you
  can't confirm.
- **What went wrong**, when a helper was reported saying something: find the line it came from, or
  the gap it filled by guessing.

## Step 2 — Write it

- **Mostly the maker and his writings.** The knowledge is where the size goes: who he is, what he
  writes about, and his writings by subject, with a line on how each group joins one field to another
  (games and biology, math and cooking, philosophy and computing). That is what gives a helper
  something true and particular to say on almost any subject a visitor brings up, so when there is
  room, it goes to another writing, never to the game.
- **True.** Every feature an idea, the knowledge or a line of small talk names is one the guide's
  outline names, done with the control it gives. An idea that needs more than the outline says is
  dropped, not explained: the rules have a helper asked how something works say it is something to
  find out by trying, and never guess.
- **An outline, not a manual.** The guide lists what people can do (explore, chat, build, add things
  to a room, change how they look, collect and spend dollars, sign in, bring an AI agent), each in a
  line: what it is, in everyday words, and the control it is done with, as its picture's markup, never
  a key or where on the screen it is. A new feature gets a clause there only if it is a new thing to
  do, a new kind of thing to add to a room, or a new kind of thing to unlock or buy ("a cannon, which
  shoots balls at whoever is near"). How it works never goes in: how fast, how far or how long, what
  bounces off or breaks what, how it aims or counts, its settings and states, anything a player sees
  within a moment of trying it. The model passes on whatever the guide holds, and every such line
  takes room from the conversation; a test holds the guide's length (`HELPER_GUIDE_MAX_LENGTH`), and
  the answer to a guide that outgrows it is to cut, not to raise the cap. A control with no picture
  yet gets one: a name and its words in `ScreenControlMap`, its drawing in `ScreenControlPicture`
  (from the control's own icon and face), and its width in `ScreenControlPictureUtil`. A tall one (a
  slider standing upright) doesn't fit a line of text, so it is named in words instead.
- **For someone who has never played.** Say what a thing is for, in everyday words, never in a word only
  players know: "They buy shapes for your character" reached visitors as nonsense, since nobody new knows
  what a shape is, nor that others see them as a character they can change. Say what it is for in general
  ("You can spend dollars to unlock new items"), never by one use of it, which may later be only a part of
  it: the kinds of item follow as the answer to "which" ("Asked which items: some of the looks, and
  cannons"), for a helper to say only when asked. Named plainly, a use still leaked into first answers; named
  nowhere, helpers made the items up. No add-ons either, least of all how the screen marks a thing (a lock,
  an outline): a visitor is seldom looking at it while reading, so "new items, which show a lock" was vague.
  A bare sentence tempts the model to finish it with an example ("like new looks for yourself"), which the
  rules forbid until asked which. Nothing in the guide gives the fine print a player finds out by playing
  (which bill flies to whom, what a refusal says).
- **No number a constant holds** (a price, a reward, a distance, a time, a limit), written out or built into the
  text from the constant: the constant changes, and helpers go on repeating whatever they heard. Say it the way a
  player meets it ("an item you can unlock shows its price", "for a little while"); a test checks the guide, the knowledge
  and the characters. Asked for such a number, a helper says what the guide says, and at most that it doesn't know
  it exactly. A rule telling them so made it worse (they gave the reason, named "the guide", or claimed the game
  doesn't show the price), so there is none: the guide without numbers is enough.
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
- **His ideas, never stretched.** An entry gives one idea as the writing has it, and the rules have a
  helper tell it with the writing's title, never as what he "thinks" in general: asked a wide question
  ("can games teach us about life?"), the model otherwise turns an entry into a claim he never made
  ("Youngjin wrote that games work like the real world"). A series gets one entry, with its list page
  or its first part, and its most vivid example. Left out: writings on politics or other divisive
  subjects, scornful or crude ones, and whatever a reader would have to trust the helper on because
  nobody has read it yet.
- **No Korea.** At the maker's wish, nothing the helpers are told or say speaks of Korea or its food: no
  line of small talk, remark, topic or knowledge, and no picture of it remarked on (its keywords go in
  `UNSPOKEN_KEYWORDS`); a test checks.
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
  Its small talk is a manner (cheerful, gruff, calm) and at most a word of its own once in a talk (an
  Mm, a Ha!): told "now and then", the model put the word in every reply, and the caretaker's Hmph
  stood in for its gruff remark every time, so it has none. What its small talk is about comes from
  its moods, never from the manner: content written into the manner ("itching to build") became a
  catchphrase said to every visitor. A mood is a state of mind, a wish or a plan in its field, never
  something that happened, something in the room, or a thing with a famous fact attached ("with blue
  on your mind" had the curator recite how Prussian blue was found).
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
- **Remarks** (`helperRemarks.ts`) follow the small talk's rules for plain words and truth: each line
  an opinion, or a fact true of the game as the guide has it or of the world, under about 120
  characters as written. A line works for every thing it may be said of: `{thing}` is a painting
  ("'Ground Swell' by Edward Hopper") as often as a lamp or "the swim fins", so a verb or pronoun after
  it agrees through `[is|are]` and `[it|them]`; `{reason}` and `{other}` are things liked or disliked
  ("Mexican food", "the color blue", "window views"), so they appear only where any of those fits ("I
  love {reason}", "Nothing beats {reason}"), never as the one doing something. A line never claims
  something happened ("I showed it to a visitor"), and a kind's own line claims only what is true of
  every such thing (every room has a door to a hub; only admins hang mirrors). An interest's phrase is
  a plain noun phrase that reads after "I love" and "I've never cared for" alike: no praise in it
  ("hearty meals", not "good food", which nobody dislikes).
- **Topics** (`helperTopics.ts`) follow the small talk's rules for truth and plain words: each a
  statement about something named, in its personality's field, the world's facts well known and certain.
  An idea from a writing is a whole entry, as in the knowledge (title, kind, the link, the idea), retold as
  the writing has it. No entry appears twice across the lists (a test checks). A writing may be in the
  knowledge and a topic too: the topic puts one more idea of it on a helper's mind for a talk.
- **Simple, natural words** throughout, as a friendly person says them out loud, with the visitor doing
  what they can do ("You can spend dollars to unlock new items", never "Dollars unlock items"). Many visitors read
  English as a second language, and the helpers borrow the wording they are given, so the guide is written
  as they should say it, not in the terse style of the code's comments.
- **Mind the size.** The shared part is read from the cache on every reply, and paid in full again
  after five quiet minutes. It may run to about 10,000 tokens (the maker raised it from 6,500 on
  2026-11-12, for richer talk and more flexible answers), and a test holds it in characters
  (`SHARED_PROMPT_MAX_LENGTH`). What fills it is the knowledge of the maker and his writings, never
  the game's details and never padding. When it must shrink, cut the stalest lines rather than
  squeezing every line. A link costs about 27 tokens, so the whole runs at under three characters a
  token; the sampler's `cacheWriteTokens` is the shared part's size, and the API's free
  `/v1/messages/count_tokens` weighs one part or one section alone. The small talk is never sent to
  the model, so it costs nothing to grow.

Every file under `src/` is changed with Edit or Write, never a shell command
(`.claude/rules/source-edits.md`).

## Step 3 — Check it

```bash
npx vitest run tests/integration/scenarios/helper.test.ts
```

Then hear them. The sampler asks the real model as each played personality would be asked, and
prints its mood and the things on its mind in that talk, every reply, its length, and the tokens the run took:

```bash
ANTHROPIC_API_KEY="$(gcloud secrets versions access latest --secret=ANTHROPIC_API_KEY --project=thingspool)" \
    node dev/scripts/helper/sampleHelperReplies.js
```

`--personality=<id>` hears one, and each `--line="..."` replaces the default lines; ask about
whatever was added. The speaker knows how to play, as most do; `--untold` speaks as one never told.
A full run costs well under a cent, outside the helpers' daily budget. Fetch the key inline like this,
and never print it.

Read every reply. Each should be in its character's voice, true, short, on what the visitor just said
(small talk such as "hi, what's up?" or "haha, cool" gets small talk back, in words only its character
would say and from its mood, different from one talk to the next and with its own word, if any, once
at most, never a fact or story on a subject they didn't bring up, which reads like an encyclopedia
entry; one of the things on its mind comes
up only when the visitor leaves the subject to it, as with "tell me something fun"), specific on any
subject (a named thing), plain and precise (no metaphor, loose comparison, riddle
or pun, no made-up quote, story or number, no narration of what the helper does), a how-to answer only
what the guide's outline says of the thing, with nothing added, and only when asked, in everyday words someone
who has never played follows (no "shape", "face" or "your character"), never a key, each control as its picture's
markup (by a name `ScreenControlMap` has, never where on the screen it is), and never an example line said
back. Ask how something works, too (how fast a ball flies, how a cannon picks whom to shoot): the reply should
say in a few words that it is something to find out by trying, with no guess and no made-up detail. And ask
about ThingsPool's maker and the subjects he writes on (who made this, a game idea, math, AI and art, what is
real): each reply should give one true thing from the knowledge, about him or from a writing it names by its
title, with that writing's link at most once in the reply. Ask a wide question on one of his subjects several times
over, and check each thing said in his name against the knowledge: that is where the model strays. A form
the rules give "only for the form" is still said back nearly word for word, so it has to be one worth saying. No reply welcomes the visitor again or gives the helper's name (a short hello back to a hello is
fine); ask with lines that open "hi!", which draw both out. "What can I do here?" from one who knows how to
play gets an idea to try, not the basics; from one not yet told, how to walk and build, and never a room of their own
(people build in the rooms they visit). Ask things no instruction prepares a helper for, too (a recipe, the time,
tomorrow's weather, a stranger's name, code, a favorite song): each reply should give something true and
interesting on that subject, or else a question back about it, never a fact on another subject tied in ("a fun fact
about numbers: seahorse dads carry the eggs"), nor only "I can't" or "I don't know", and a favorite should be a real
one with a reason. The jester, whose field is funny facts, strays most: hear it several times over. A reply that runs past the cut loses its last sentences, so a refusal
said before the interesting part comes out bare; that is why such replies are asked for in one sentence. Check
such facts most carefully: pushed for something on a subject it knows little of, the model will make one up.
A writing comes up only when it fits the talk, at most one in a reply, named in one sentence as
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

Then read the remarks, which cost nothing either:

```bash
node dev/scripts/helper/sampleRemarks.js [--personality=curator] [--npcs=2] [--count=6] [--thing=2/169]
```

It prints, for two helpers of each personality, what each loves and dislikes and a few remarks on
things picked at random (or all of them on one picture, by path, or on a "lamp", "fan", "cannon",
"door", "mirror" or "sign"). Each remark should name its thing correctly (one, or several, and in the right
case), give a reason that fits it, and read as its speaker. A reason that doesn't fit its thing comes
from a keyword under the wrong interest; move it, or into `UNREMARKED_KEYWORDS`.

## Step 4 — Hand it over

Report what changed in each file, a few of the replies heard and chats read, and what the shared part
now weighs. Nothing ships until the user commits and deploys.
