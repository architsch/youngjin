# Writing the post

## Who reads it

Someone scrolling a social feed who has never heard of ThingsPool, does not write software, and
owes the post nothing. They will read one sentence before deciding whether to read the second.

## What the post is for

Advertising. The post exists to make that person want to open the game.

Being informative is how it earns the right to do that — a truthful account of something real
persuades better than a slogan — but the information is the means, not the goal. A paragraph that
is accurate and interesting to nobody but its author should be cut.

The test the whole post is written against: **a reader should finish it able to picture one
specific thing they would like to go and make or try in ThingsPool.**

## Voice: copy the author's own books

The user has written several books and essay collections, all published on this same site, all in
one recognizable voice, and all written without an AI. That voice is the target. Read a few pages
of it before writing anything:

- `public/bridge-to-math/source.txt` — mathematics, explained to people who do not like mathematics.
- `public/game-design/source.txt` — game design, argued from first principles.
- `public/concepts-of-plan/source.txt` — software product design, worked through with examples.

What that voice does:

- **States the point, then explains it.** The topic sentence comes first; elaboration follows.
- **Uses complete sentences with explicit subjects.** "The camera circles whatever you selected",
  not "Circling whatever you selected, and staying put while it does".
- **Puts one idea in each sentence,** and lets sentences be short.
- **Reaches for a concrete example** the moment an idea turns abstract.
- **Uses ordinary words.** No word is chosen for its sound or its strangeness.
- **Is occasionally funny, never coy.** A joke is allowed. A riddle is not.
- **Spells in American English** — "color", "behavior", "favorite".

The picture to keep in mind is a good mathematics or philosophy teacher explaining an idea to an
intelligent adult who does not know the field: clear, logical, unhurried, and never showing off.

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
it appears to. It reads like a wall label at a modern art gallery. Written plainly, it is two clear
sentences:

> Until now, clicking anything at all started an edit. The camera swung around whatever you
> touched and the editing tools appeared, which is what you want while building and the wrong thing
> entirely while visiting.

Specific things not to do:

- **Sentence fragments** (no subject, or no main verb) used for effect.
- **A clause left standing as its own sentence** — "Which is…", "Not that…", "And that is…".
- **Metaphor that stands in for a plain statement instead of sharpening one.** A little color is
  welcome and makes the post better company — "craft your dream space", "explore a room's hidden
  corners", "the camera lifts off your shoulder". The test is whether the sentence still says one
  definite thing that the reader takes in at speed. "A gesture already spoken for" fails it,
  because the reader has to stop and work out what was meant.
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

> This is the very first post of ThingsPool's development log, which is basically a news feed whose
> job is to share the major updates happening in this project.

Every term in that sentence has a definition the reader already holds — post, development log, news
feed, update, project — and the whole sentence can be repeated back exactly.

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

The reader is not an engineer and does not want to become one for the length of a post.

**Never explained in depth:** user-interface flow, performance, computational cost, algorithms,
data structures, network bandwidth, protocols, state management, architecture, refactoring, code
structure. These are the subjects that turn a post into an internal memo.

**Allowed once, in a plain-language clause, where the story genuinely needs it:** the name of a
technology ("built with Three.js and WebGL"), or a one-line reason in everyday words ("so that
everyone standing in the room sees the same wall move at the same moment"). Then move on.

**Never at all:** class names, file paths, function names, and the trade vocabulary —
"instanced mesh", "observable", "signal", "state machine", "decoupled", "single source of truth".

Two rules of thumb. If a sentence would interest only someone who has written software, it does not
belong. If explaining the mechanism takes more than two sentences, the post is about the wrong
thing.

## What to write about

**Prefer what a player can do over how the program works.** Most of the post is what you can see,
do and make. At most one short paragraph is how it works underneath, and only when that idea is
genuinely interesting to someone who does not program.

**Describe the concept, not the controls.** The post is not a manual. Walking through which button
opens which panel, in what order, is the fastest way to lose a reader, and it is the part that
changes next month anyway. Say what the feature *is* and what it lets somebody do, and let one or
two concrete details stand in for the rest. "Enter play mode and explore a room's hidden corners,
or switch to edit mode and craft the space you actually want" carries further than a paragraph
tracing every click — and the screenshots show the interface better than prose ever will.

**Include possibilities, not only facts.** A feature is worth a post because of what it opens up.
Say what someone might build or try with it, concretely enough to picture: a gallery of paintings
hung along your own hallway, a maze built by two people standing inside it while they build, a
click that could later mean picking something up instead of editing it. Imaginative and
forward-looking is right; vague is not. "Endless possibilities" is worth nothing, and one specific
possibility is worth the paragraph it takes.

**Keep the possibilities honest.** Write them as what becomes possible, not as what already exists.
"A click that is no longer automatically an edit is free to mean something else later" is fair.
"You can now pick objects up" is a lie if you cannot.

**Grow less detailed as the post goes on, not more.** Posts drift into step-by-step description
toward the end, because by then the writer is deep inside the feature and forgets that the reader
has only just met it. Do the reverse. Once the reader knows what the feature is, give the short
conceptual summary of each part and the impression of what it makes possible:

> Play mode lets you take part in a first-person adventure through a labyrinth of rooms. Edit mode,
> on the other hand, lets you customize everything around you — your own avatar, the room's
> interior, and every intricate part of your surroundings.

Two sentences where a walkthrough would have taken eight, and the reader is left with something to
imagine rather than something to memorize.

## Length

**2964 characters is a hard ceiling, not a target.** It is the most a post is permitted to be, and
has nothing to do with how long it should be. A post that says everything it has to say in 1200
characters is better than the same post padded to 2900, and the shorter one is more likely to be
read to the end. Never add a sentence because there is room for it.

Write the draft, then cut. Every pass over it should come out shorter than the one before, and the
post is finished when nothing further can be removed without losing something a reader wanted.

What comes out first:

- **Sentences that restate the sentence before them** in different words. Keep the clearer one.
- **Commentary about the post itself** — "The pictures deserve a paragraph of their own", "The
  reason this was worth doing is not tidiness", "That last part is what makes it worth a look".
  Describe the thing; let the reader decide what deserves attention.
- **Summary paragraphs at the end.** The reader has just read the post. Close on the last real
  thing you have to say, not on a recap or an invitation.
- **Vague nouns and abstractions** — "a character of its own", "a shared space", "the same
  activity with different intentions". If you cannot picture it, replace it with something you can.
- **Filler modifiers** — "quite", "simply", "actually", "genuinely", "entirely", "of course",
  "in a way", "a few seconds later".
- **Setup clauses** — "It is worth noting that", "What is interesting here is that". Start at the
  point instead.

## The title

**The plainest, most literal name for what the post is about.** If the post introduces game modes,
the title is "Game Modes Are Here" or "Better Control With Game Modes" — not a figurative phrase
about the idea behind them.

A reader scanning a feed has nothing to decode a clever title with, so a title that needs decoding
is a title they scroll past. Name the feature, in the words somebody would use to search for it.
Enthusiasm is welcome; obliqueness is not. No colon-and-tagline construction, and no title that
could sit on any post in the log.

## The opening: the whole point, in the first two sentences

Social platforms show about two lines of a post and hide the rest behind "see more". Most people
read only that much, so those two sentences have to work as the entire post in miniature.

They carry two things, in this order:

1. **What ThingsPool is** — a short phrase, because the reader has never heard of it.
2. **What is new** — named directly, in the same breath.

Somebody who arrived knowing nothing and stops right there should still know what the product is and
what just happened, which is everything the free space was good for.

The rest of the post expands on that sentence. Never open with a scene, a question, or a detail
that only makes sense once the reader already knows what the feature is — that spends the visible
lines on setup.

### Say it differently every time

Those two jobs are fixed. **The sentence that does them is not, and reusing the previous post's
construction is a fault.** The log is read as a series — by the same followers, in the same feed —
and an opening that arrives in the same shape every week reads as a template with a new noun dropped
into it, which is a worse advertisement than the feature deserves.

The failure is specific and easy to fall into: lifting the frame of the last opener and swapping its
tail, so that post after post runs *"ThingsPool, an immersive 3D chat app that runs in a browser tab,
now ..."*. Each one is a fine sentence alone. Read one after another, they are the same sentence.

So, before writing the opening, **read the openings already in `source.txt`** — all of them, not
just the newest — and write one that does not share its construction with any of them. What must
vary is the shape of the sentence, not merely the wording:

- Which of the two jobs leads. The new thing can come first and the description second.
- Whether they are one sentence or two.
- How ThingsPool is described. "An immersive 3D chat app that runs in a browser tab" is one true
  description of it, not its name — it is also a shared world you walk into as a character, a room
  full of blocks anyone present can rebuild, a 3D space that opens from a link. Pick the description
  that suits *this* post's feature, and let a post about building sound different from a post about
  talking to people.
- Whether the appositive clause ("ThingsPool, a ..., now ...") is used at all. It is one construction
  among many, and it has had its turn.

What may not vary: the reader still learns what ThingsPool is and what is new, inside the first two
sentences. Variety is in the delivery, never at the cost of a newcomer understanding the post.

## Structure

This order is the default, and a post with a good reason may vary it:

1. **Title** — see above.
2. **The link to the landing page**, on the line directly under the header. The exact line is in
   [post-format.md](post-format.md).
3. **The opening two sentences** — what ThingsPool is, and what is new.
4. **What the feature is and what it lets you do** — the body. Concept first, concrete enough to
   picture, and free of step-by-step instructions.
5. **What it opens up** — the possibilities paragraph described above.
6. **Hashtags**, on the final line.

What was awkward before the feature existed is often worth a sentence or two, wherever it explains
why the new thing is better. It is rarely worth more than that.

Images go between paragraphs, at the point the prose has just described what they show.

Nothing in the post asks for a click. The user's own "Play Here" line does that.

## Hashtags

About sixteen, each `#` followed by a PascalCase term, on one line at the end. Six to eight are
broad ones taken from a standing bank grouped by audience — the kind of place the game is, the kind
of game it is, the craft, the arts, the adjacent fields — so that the post reaches people who have
never heard of it. The rest name what *this* post is about.

The bank and the rules for using it are in [hashtags.md](hashtags.md). Do not improvise a set
without reading it. Two ways to get it wrong: leaving out the broad project-level tags, which is
what a writer thinking only about their own paragraph does; and running the line long, which spends
the reader's attention and a twelfth of the character budget on terms nobody reads.

## SEO

Search engines read the page, not the `:k:` line alone. Name the things the post is about in the
prose itself — the product, the technologies, the domain terms someone would actually search for.
Once each, where the sentence wanted the word anyway. Repetition for its own sake reads as spam to
both the crawler and the reader.

## An example of the shape

```
[The Orbit Camera Is Here] August 8, 2026

@@<h3>New here? Start with <a class="inlineButton" href="https://thingspool.net#what-is-thingspool">What is ThingsPool?</a></h3>

ThingsPool, a 3D world you explore and rebuild inside a browser tab, now has an orbit camera. Click
any block in a room and the view lifts off your shoulder and swings around it, so you can work on a
wall from any side — including the side you are not standing on.

Before this you built from wherever you happened to be standing. The far face of a wall meant
walking around it, and anything above head height meant finding somewhere to stand that could see
it.

<orbit-camera-overview>

A ceiling is now no harder to build than a floor, and the inside of a tower no harder than the
outside. That makes a few things worth attempting: a spiral staircase, a chandelier hung over a
hall, a ceiling painted to look like a sky. All of them are built from above or below, and until
now that was the one place you could not stand.

<orbit-camera-detail>

#ThingsPool #Metaverse #VirtualWorld #Sandbox #BrowserGame #IndieGame #GameDev #OpenSource
#WorldBuilding #GameMechanics #CameraControl #LevelEditor #VoxelEngine #TypeScript #ThreeJS #WebGL
```

(The hashtag line is one line in the source file; it is wrapped here only to fit this page.)

The title names the feature. Somebody who reads only the first two sentences knows what ThingsPool
is, what is new in it, and what that is good for. Nowhere does the post say which button to press.

Note what it does not do. It does not say the feature is exciting, does not thank anyone for
reading, does not ask for a click, does not sum itself up at the end, and does not leave a single
sentence for the reader to decode. Every sentence could be restated by the reader in their own
words, and the post is interesting because of what it describes rather than how it is phrased.

Note also how short it is — under a third of the budget, because that is all the feature needed.

## Checks before publishing

Read the finished post once for each of these, and fix what fails:

1. **Every sentence has a subject and a main verb.** Fragments become sentences or get deleted.
2. **Every sentence can be restated by the reader in their own words.** If it can only be admired,
   rewrite it.
3. **Every figure of speech still says one definite thing.** Color is fine; ambiguity is not. If a
   reader could reasonably take a sentence two ways, rewrite it.
4. **The title names the feature in literal words.** If it could belong to any other post, or
   needs the post to explain it, rename it.
5. **The first two sentences stand alone.** Cover everything from the third sentence down: what is
   left must still say what ThingsPool is and what is new in it.
6. **The opening does not repeat an earlier post's construction.** Put the new opening directly
   beside the opening of every post already in `source.txt`. If two of them share a shape — the same
   appositive, the same "ThingsPool ... now ..." frame, the same clause order — the new one is
   rewritten, not reworded.
7. **Every noun could be defined by the reader,** in words, without guessing. Loose ones get
   replaced by the established term.
8. **No paragraph would interest only a programmer.** Count them; the answer should be zero.
9. **No step-by-step instructions,** and the post gets *less* detailed as it goes, not more. If a
   later paragraph traces a sequence of interactions, replace it with what that part of the feature
   lets somebody do.
10. **The post names at least one specific thing the reader could go and make or try.**
11. **Nothing can be cut without losing something.** Go sentence by sentence and ask what the post
    would lose without it. "It rounds the paragraph off" means delete it.
12. `node dev/scripts/devlog/postLength.js` passes — and remember its number is a ceiling. Being
    well under it is a good sign, not wasted room.
