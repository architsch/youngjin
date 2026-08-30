# House Writing Style

The one style guide for everything this project publishes in the user's name to people outside it:
dev-log posts, submission copy for a venue, a store description, a forum body, a directory entry.

It is shared on purpose. Two skills write this kind of text — [`devlog-post`](skills/devlog-post/SKILL.md)
and [`distribution-push`](skills/distribution-push/SKILL.md) — and a house style that exists in two
copies becomes two house styles within a few revisions. **Rules about how to write live here. Rules
about what a particular piece must contain live in the skill that owns it.**

A skill may add rules on top of this page, and may name an explicit exception for a venue whose
audience is unusual. It may not quietly write in a different register.

## The corpus is the style guide; this page only names its principles

**The published dev-log posts are the authority. Read them before drafting anything, and imitate the
pattern that runs through them.** They live one year to a directory, as
`public/devlog-<year>/source.txt`. Read the whole of the current year's file and the year before it —
**many posts, not the latest one**. A single post shows one solution; the run of them shows the style,
and it is the style that is being copied.

This page exists to name the few principles the corpus is built on, so that a draft can be checked
against something shorter than the whole archive. It is a summary of the posts, not a supplement to
them. **Where this page and the posts disagree, the posts win**, and where this page is silent or
ambiguous, the answer is in the posts rather than in an inference from these rules. Ask the user only
when the corpus itself is genuinely divided.

The posts are also the only writing on the site to take style from. The books and essay collections
in the Library are a different genre — long-form, discursive, written to explain rather than to
invite — and that voice does not transfer to a short piece of promotional copy.

Published posts are dated records. Fix the draft, never the published ones.

## Who reads it

Someone who has never heard of ThingsPool, does not write software, and owes the text nothing. They
will read one sentence before deciding whether to read the second. Many of them read English as a
second language, so every individual word has to be a common one — but a common word arranged into
an exciting sentence is exactly what is wanted.

---

## 1. It is an invitation, not an account

**This copy is an advertisement.** Not a report, not a release note, not a summary of work done. Its
whole job is to make a stranger want to open the link.

Truthfulness is how it earns the right to do that, but a paragraph that is accurate, clear, correct
and boring has failed at the only thing it was for. **Dryness is a failure mode, not a safe default.**
If a draft reads like a specification with the numbers removed, throw it out.

Everything the reader is not being invited by is spent words. That single test is what the following
all come to:

- **Never explain how a feature works.** Name it, say what a player does with it, move on. This catches
  far more than jargon does — *"A door goes up wherever a wall is wide enough, slides along it, takes
  any name we give it, and is finished in the timber, plate and knob colors that suit it"* holds no
  trade vocabulary at all, and is still four clauses about how an editing tool behaves. The reader is
  not the person holding that tool, and its constraints least of all concern them.
- **Never say where a feature sits on screen.** The screenshots show the interface.
- **Never at all:** class names, file paths, function names, algorithms, data structures, performance,
  network bandwidth, protocols, state management, architecture, refactoring, and the trade vocabulary
  ("instanced mesh", "observable", "signal", "decoupled", "single source of truth").
- **Allowed once, in a plain-language clause:** the name of a technology ("built with Three.js and
  WebGL"). Then move on.

A skill may raise this ceiling for a venue whose audience came specifically for the engineering, and
it says so where it does.

**Behind-the-scenes work gets at most one sentence**, late in the piece, and only where the feature
exists because of it. Signpost it as internal, name the system in plain words, spend the sentence on
what it now permits, and give any internal role a name a player would enjoy:

> Internally, we now have an admin system which grants the special admin user (i.e. the "Game
> Master") a right to install these custom doors, connect them to other rooms, and even create brand
> new rooms!

## 2. Concrete about the thing, open about the doing

**What the thing is** gets named plainly, in words the reader already holds: *a 3D virtual universe of
rooms*, *a 3D chat app in a browser tab*, *two-story rooms*, *walls, floors, ceilings*. Never make the
reader guess what the product is. The phrase is chosen to suit the piece's subject rather than copied
from the last one — a post about doors between rooms opens on the universe of rooms, one about the
people you meet opens on the chat app — because the phrase that shares a noun with the feature lets
the announcement be a single sentence instead of two.

**What the reader might do with it** is deliberately open: *unforeseen adventures*, *various
treasures*, *hidden corners*, *architectural wonders*, *places of pure mystery*. Here the reader's own
imagination does the selling, and pinning it down to one specific scene makes it smaller. "Open"
excludes mechanical exactness as much as it excludes jargon: *"you will step straight out of the room
you were standing in and into the one it opens onto"* and *"you will find yourself wandering off into
places of pure mystery"* describe the same door, and only the second is an invitation.

Getting this backwards — fuzzy about the product, over-specific about the activity — is the failure.

**The open-ended list is how both halves are done at once, and it is the main technique on this page.**
Name three or four real things, then leave the door open:

> …you can chat with people, build your own personal space, and partake in unforeseen adventures.

> …you can build stairs, vast halls of high ceilings, **and other architectural wonders**!

The named items make it real; the tail makes it feel bigger than the sentence. One such list per
paragraph is the natural rhythm, and a paragraph without one is usually the paragraph setting one up.
Pick the tail deliberately: "and so on" is the weakest, because it hands the reader nothing to picture.

**This is also where truthfulness is enforced, and the line falls inside the list rather than around
it.** Every *named* item is checked against the code; the tail needs no check, because a reader takes
the named items as shipped and the tail as an invitation. So:

> In Play Mode, you will be engaging in all sorts of rich gameplay experiences - such as inspecting,
> attacking, picking things up, eating, and so on.

Inspecting is real; attacking, picking things up and eating are not, and a reader who arrives looking
for them finds a room they can only look at. The tail would have carried all three by itself:
*"…such as inspecting the things around you, and a good deal more to come."* A promotional claim the
game does not deliver is discovered within thirty seconds of the click, and it is the one mistake this
copy cannot survive.

## 3. Warm, and pleased with itself

The project speaks as **"we"** and addresses the reader as **"you"**. It is pleased about what it
built and it says so. The picture to keep in mind is somebody showing a friend around a place they
built themselves and are proud of.

- **Talk to the reader**, in the second person throughout. Contractions are fine.
- **The workhorse sentence is an imperative answered by an outcome** — *"Try entering these new doors,
  and you will find yourself wandering off into places of pure mystery."* / *"Enter the Edit Mode, and
  click anything you see; you will fly in mid air…"* It asks for an action and pays for it, which is
  the whole transaction this copy is making. Using it twice in one piece is parallel structure, not
  repetition.
- **One or two exclamation marks**, at the end of a promise rather than sprinkled through the middle.
  A draft with none in it has come out flatter than the corpus every time.
- **Grand words where the thing is genuinely grand** — "our virtual universe", "architectural
  wonders", "hidden corners". These are not vague; they are an invitation to imagine.
- **One vivid physical image, at most one** — *"You will fly in mid air, chasing what you are editing
  in real time!"* A real mechanic described as a sensation. Usually the best line in the piece, and
  the line that cancels itself out if there are three. Find several, keep one.
- **End by inviting them in.** *"So jump in, and become part of our everlasting journey."* / *"Come
  join ThingsPool."* The copy asks for the click.

## 4. Say it once, in ordinary words

**Aim for about 600 characters of prose**, excluding the title and the hashtag line; the corpus runs
around that. Six short paragraphs is a long piece. A character ceiling set by a platform is a limit,
never a target — being at a fifth of it is the correct outcome, and **nothing is added because there
is room for it.**

What comes out of a draft first: sentences restating the one before them; the second explanation of
anything; modifiers that place, time or qualify what needs none; commentary about the text itself;
and anything an engineer would find interesting and a player would not.

The mechanical rules are few:

- **Every sentence has a subject and a main verb.** No fragments as rhetorical beats. This is the one
  sentence-level rule that does not bend.
- **Common words only.** No word chosen for its strangeness.
- **Short paragraphs** — one to three sentences, then a break or an image.
- **American spelling** — "color", "behavior", "two-story", "socialize".

Ordinary English is wanted, so relative clauses, phrasal verbs, appositives, semicolons, dashes, a
pronoun carrying across a paragraph break, and a construction deliberately repeated for parallelism
are all fine. The corpus uses every one of them.

---

## The shape of a piece

The corpus shares it, and it is a good default:

1. **The announcement** — preferably one appositive sentence carrying what ThingsPool is and what is
   new at once: *"ThingsPool, a 3D virtual universe of rooms, now includes custom doors!"* Two
   sentences is the older shape and still fine, but it spends a paragraph on what one sentence can do.
2. **The promise** — what the reader gets to do now, in open terms.
3. **A short paragraph per part of the feature**, each ending in an open list.
4. **A closing invitation.**

Images break the text at roughly even intervals, about one per paragraph. An image may sit before the
prose it illustrates, and a piece may end on one.

## The checks

Read the finished text once for each, and fix what fails. The skill that owns the piece adds its own.

1. **Would a stranger want to click after reading this?** If the honest answer is "it is accurate",
   it has failed and needs rewriting, not polishing.
2. **The reader learns what ThingsPool is** in the opening.
3. **What the product is, is concrete; what the reader might do, is open.** Not the other way round.
4. **At least one open-ended list**, at most one vivid physical image, one or two exclamation marks.
5. **Every named item is real** in the code. The open tail needs no check.
6. **No paragraph would interest only a programmer**, and none explains how a feature works or where
   it sits on screen.
7. **Every sentence has a subject and a main verb, and every word is a common one.**
8. **It ends by inviting the reader in.**
9. **It is about 600 characters,** not two thousand. Cut until it is.
10. **Set it beside two or three published posts.** If it reads as a different voice, the posts are
    right and the draft is wrong.

## Maintaining this page

**Consolidate; do not accrete.** When feedback arrives, find the principle it belongs to and sharpen
that principle — do not append a new rule for the case at hand. A guide that grows a bullet per
correction becomes a list nobody can hold in mind while writing, and its rules start contradicting
each other in ways only a careful reader notices.

Two specific habits keep it short. **Where a question is really about style rather than principle,
the answer is "read the posts"** — this page should send the reader to the corpus, not try to
enumerate it. And **state the present only**: no record of what an earlier version of this page said,
banned or got wrong. That history is in git, it doubles the length, and it makes the current rule
harder to find.
