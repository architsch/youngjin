# House Writing Style

The one style guide for everything this project publishes in the user's name to people outside it:
dev-log posts, submission copy for a venue, a store description, a forum body, a directory entry.

It is shared on purpose. Two skills write this kind of text — [`devlog-post`](skills/devlog-post/SKILL.md)
and [`distribution-push`](skills/distribution-push/SKILL.md) — and a house style that exists in two
copies becomes two house styles within a few revisions. **Rules about how to write live here. Rules
about what a particular piece must contain live in the skill that owns it.**

A skill may add rules on top of this page, and may name an explicit exception for a venue whose
audience is unusual. It may not quietly write in a different register.

## This page is the authority; already-published copy is not

Earlier dev-log posts and earlier submissions are a record of what was sent. They are not models to
imitate. Every one of them was written before some of the rules below existed, and several of them
break these rules plainly — a sentence carrying three ideas, an idiomatic phrasal verb where a plain
word was available, a list of four things to try, a reference to a feature the copy was not about.

**Reproducing a fault because it appears in something already published is how a style stops
improving.** Each piece should come out better than the last one, which cannot happen if the last
one is the standard.

So read published copy for two things only:

- **The facts it committed to,** so the new text does not contradict it.
- **The constructions it already used,** so the new text does not repeat them.

Take the style itself from this page. Where the two disagree, this page wins, and the published text
stands as it is — old posts are dated records and are not edited to match a newer rule.

## Who reads it

Someone who has never heard of ThingsPool, does not write software, and owes the text nothing. They
will read one sentence before deciding whether to read the second. Many of them read English as a
second language, so an idiom or a figure of speech stops them where a plain word would not.

## Voice: copy the author's own books

The user has written several books and essay collections, all published on this same site, all in
one recognizable voice, and all written without an AI. That voice is the target. Read a few pages
of it before writing anything:

- `public/bridge-to-math/source.txt` — mathematics, explained to people who do not like mathematics.
- `public/game-design/source.txt` — game design, argued from first principles.
- `public/concepts-of-plan/source.txt` — software product design, worked through with examples.

What that voice does:

- **States the point, then explains it.** The topic sentence comes first; elaboration follows.
- **Uses complete sentences with explicit subjects.** "The camera circles the block you selected",
  not "Circling whatever you selected, and staying put while it does".
- **Puts one idea in each sentence,** and keeps sentences short.
- **Reaches for a concrete example** the moment an idea turns abstract.
- **Uses ordinary words.** No word is chosen for its sound or its strangeness.
- **Is occasionally funny, never coy.** A joke is allowed. A riddle is not.
- **Spells in American English** — "color", "behavior", "favorite".

The picture to keep in mind is a good mathematics or philosophy teacher explaining an idea to an
intelligent adult who does not know the field: clear, logical, unhurried, and never showing off.

## Sentences

These rules are mechanical. Apply them to every line, and hardest to the first two, because those
are the only lines most readers ever see.

- **Short.** One idea, one sentence. A sentence carrying two ideas becomes two sentences.
- **Active.** "The camera circles the block", not "the block is circled by the camera". Name the
  thing that acts, and put it in front of the verb.
- **Few relative pronouns.** Clauses hung off "which", "that", "whose" and "where" make the reader
  hold the first half of a sentence open while reading the second. Split the sentence instead:

  > This is the very first post of ThingsPool's development log, which is basically a news feed
  > whose job is to share the major updates happening in this project.

  becomes

  > This is the first post of ThingsPool's development log. The log is a news feed for the
  > project's major updates.

- **Plain single-word verbs.** An idiomatic phrasal verb means something its own words do not say,
  so a reader translating as they go has to stop and guess. Write "removes" rather than "takes
  out", "makes possible" rather than "opens up", "appears" rather than "shows up", "frees" rather
  than "frees up", "raises" rather than "brings up". Literal ones are fine, because there the words
  mean what they say: you still walk up the stairs and look down over the balcony.
- **Pronouns only where the thing they stand for is unmistakable.** "Click a block and the camera
  circles it" is clear — one noun, one clause ago. "It is yours to change", opening a paragraph, is
  not. Repeat the noun instead; repeating a plain word is never the fault. Never let "it", "this",
  "that" or "they" point back at a whole sentence, across a paragraph break, or across an image.
- **No literary effects.** No metaphor the reader has to unpack, no inversion for rhythm, no phrase
  picked for its sound. A figure of speech survives only when its meaning is obvious to everybody
  at a glance: "explore a room's hidden corners" passes, "the camera lifts off your shoulder" does
  not, because the reader stops to picture a camera sitting on a shoulder.

## The two ways to get the voice wrong

### 1. The poetic register

This is the failure that keeps happening, so guard against it hardest. It looks like this:

> That used to be the opening move of an edit. A click on anything took the camera off your
> shoulder, swung it into orbit around whatever you had touched, and put the tools for changing it
> on screen. Which is exactly what you want while you are building, and the wrong answer entirely
> for someone who came to look at the place.

Every symptom is in there: a fragment used as a rhetorical beat ("Which is exactly what you
want…"), a metaphor doing work a plain statement should do ("the opening move of an edit"), a
subject the reader has to reconstruct, and a rhythm that sounds meaningful while saying less than
it appears to. It reads like a wall label at a modern art gallery. Written plainly, it is four
short sentences:

> Until now, a click started an edit. The camera swung around the block, and the editing tools
> appeared. Builders need those tools. Visitors do not.

Specific things not to do:

- **Sentence fragments** (no subject, or no main verb) used for effect.
- **A clause left standing as its own sentence** — "Which is…", "Not that…", "And that is…".
- **Metaphor standing in for a plain statement.** The bar is high: the reader must take the meaning
  at reading speed, without stopping. "Craft your dream space" and "explore a room's hidden
  corners" clear it. "A gesture already spoken for" and "the camera lifts off your shoulder" do
  not. When in doubt, write the plain sentence — nothing is lost by being plain.
- **Withheld subjects and delayed reveals.** Name the thing in the sentence that introduces it.
- **Aphorisms.** A sentence that sounds quotable has usually stopped explaining.
- **Portentous half-thoughts** at the end of a paragraph.
- **Elegant variation** — calling the same thing three different oblique names across a paragraph.
  Repeat the plain word instead.

### 2. The engineering record

The older failure, and still a real one: a list of what was implemented, in the vocabulary of the
person who implemented it. Nobody outside the project reads past it.

Both failures come from the same mistake — writing to impress rather than to be understood — and
the cure for both is the same. Say the true thing in the plainest available words.

## Say things the reader can define

Vagueness is not only a matter of metaphor. It comes just as often from ordinary words used
loosely, where a reader can guess roughly what is meant but nothing lands precisely.

> This log follows what gets finished, one feature at a time, with pictures taken from the running
> game.

Nothing there is figurative, and it is still fuzzy. What log? What counts as "finished"? What is a
"picture taken from the running game"? The reader assembles a vague impression instead of receiving
a fact. Named properly:

> This is the first post of ThingsPool's development log. The log is a news feed for the project's
> major updates.

Every term in those two sentences has a definition the reader already holds — post, development
log, news feed, update, project — and both sentences can be repeated back exactly.

So: **reach for the established word.** If a thing has a name people already know, use that name
instead of describing your way around it. If it has no such name, define it in the clause where it
first appears. Watch for:

- **Nouns doing vague duty** — "what gets finished", "the making of it", "somewhere worth
  standing", "the same tools".
- **Words that sound specific and are not** — "experience", "content", "flow", "journey", "space"
  where you mean an actual room.
- **Phrases the reader has to interpret** rather than understand. If two readers would paraphrase a
  sentence differently, rewrite it.

## How much detail

The reader is not an engineer and does not want to become one for the length of the text. Introduce
the concept and make it sound worth trying. This is not a manual, not a report of one session of
play, and not an account of how anything was built.

**Do not explain how a feature works.** Name it, then say what a player does with it. The mechanism
is the writer's interest, not the reader's.

**Do not say where a feature sits on screen.** "The new tool is in the inventory menu, on the
second tab" is a manual page. The screenshots show the interface better than any sentence can.

**Do not narrate a use case.** "Use this object to open the door on the other side of the hallway"
describes one scene in one room. "Use this key to unlock doors" describes the thing itself, which
is what the reader needs.

**Never explained in depth:** user-interface flow, performance, computational cost, algorithms,
data structures, network bandwidth, protocols, state management, architecture, refactoring, code
structure. These are the subjects that turn public copy into an internal memo.

**Allowed once, in a plain-language clause, where the story genuinely needs it:** the name of a
technology ("built with Three.js and WebGL"), or a one-line reason in everyday words ("so that
everyone standing in the room sees the same wall move at the same moment"). Then move on.

**Never at all:** class names, file paths, function names, and the trade vocabulary —
"instanced mesh", "observable", "signal", "state machine", "decoupled", "single source of truth".

This is the level of detail to aim at, in full:

> ThingsPool now has wind-blowers. Use this new weapon to blow away your enemies!

Two short sentences. The reader knows what the thing is and what it is for. Where the wind-blower
is found, how far the wind reaches, which enemies it works on — all of that belongs in the game,
not in the copy.

A skill may raise this ceiling for a venue whose audience came specifically for the engineering,
and it says so where it does. The sentence-level rules above never relax, whoever the audience is.

## One subject, one idea at a time

**One piece, one subject.** A dev-log post is about the feature in its title; a venue submission is
about the one thing it is offering that venue. A description of a room-decorating tool does not
mention that the room was generated procedurally, however true that is. The reader has no
background for the side topic, and a sudden reference to it reads as confusion rather than as
depth.

**One idea at a time.** Never enumerate. This is a list, and it fails:

> Try this rocket pack to climb up this hill, and also try using it to escape the room's boundaries
> and go to a remote place, where you can refill the pack's fuel at an alien gas station.

Three ideas arrive at once and the reader keeps none of them. Pick the best one and stop:

> Strap on the rocket pack and fly over the hill.

## Cut

Write the draft, then cut. Every pass should come out shorter than the one before, and the text is
finished when nothing further can be removed without losing something a reader wanted. Length
limits are ceilings; never add a sentence because there is room for it.

What comes out first:

- **Sentences that restate the sentence before them** in different words. Keep the clearer one.
- **The second, third and fourth item in a list of ideas.** Keep the best one.
- **Modifiers that place, time or qualify a thing the reader does not need placed, timed or
  qualified.** Write "box", not "the box in the middle of the room" — where the box stands is not
  the subject. Test every modifier: if the sentence says the same thing without it, delete it.
- **Commentary about the text itself** — "The pictures deserve a paragraph of their own", "The
  reason this was worth doing is not tidiness". Describe the thing; let the reader decide what
  deserves attention.
- **Summary paragraphs at the end.** The reader has just read it. Close on the last real thing you
  have to say, not on a recap.
- **Vague nouns and abstractions** — "a character of its own", "a shared space", "the same activity
  with different intentions". If you cannot picture it, replace it with something you can.
- **Filler modifiers** — "quite", "simply", "actually", "genuinely", "entirely", "of course",
  "in a way".
- **Setup clauses** — "It is worth noting that", "What is interesting here is that". Start at the
  point instead.

## Truth

Every claim traceable to code that was read or a screenshot that was looked at. What a feature
might make possible later is welcome, written as a possibility rather than as something that
already works. A promotional claim the game does not deliver is discovered within thirty seconds of
the click.

## The checks

Read the finished text once for each of these, and fix what fails. The skill that owns the piece
adds its own checks on top.

1. **Every sentence has a subject and a main verb.** Fragments become sentences or get deleted.
2. **Every sentence can be restated by the reader in their own words.** If it can only be admired,
   rewrite it.
3. **Every sentence is short and carries one idea.** A sentence with two ideas becomes two.
4. **Every verb is active,** with the thing that acts named in front of it.
5. **Relative clauses are rare.** Wherever "which", "that", "whose" or "where" joins two halves of
   a sentence, write it as two sentences and keep the better version.
6. **Every phrasal verb is literal.** Idiomatic ones ("opens up", "shows up", "takes out") get
   replaced by the single plain word.
7. **Every pronoun points at one obvious noun,** in the same sentence or the one before. The rest
   become the noun again.
8. **Every figure of speech is obvious at reading speed.** Color is fine; ambiguity is not. If a
   reader could reasonably take a sentence two ways, rewrite it.
9. **Every noun could be defined by the reader,** in words, without guessing. Loose ones get
   replaced by the established term.
10. **No paragraph would interest only a programmer,** and none explains how a feature works, where
    it sits on screen, or narrates a scene of play.
11. **Nothing outside the subject is mentioned,** however relevant the side topic feels.
12. **Nothing is enumerated.** One idea per sentence.
13. **Nothing can be cut without losing something.** Go sentence by sentence, then modifier by
    modifier, and ask what the text would lose without it. "It rounds the paragraph off" means
    delete it.
14. **Nothing was copied from an earlier piece because it was there.** Every sentence passes the
    rules above on its own, whatever the last post did.
