# House Writing Style

The one style guide for everything this project publishes in the user's name to people outside it:
dev-log posts, submission copy for a venue, a store description, a forum body, a directory entry.

It is shared on purpose. Two skills write this kind of text — [`devlog-post`](skills/devlog-post/SKILL.md)
and [`distribution-push`](skills/distribution-push/SKILL.md) — and a house style that exists in two
copies becomes two house styles within a few revisions. **Rules about how to write live here. Rules
about what a particular piece must contain live in the skill that owns it.**

A skill may add rules on top of this page, and may name an explicit exception for a venue whose
audience is unusual. It may not quietly write in a different register.

## What this copy is

**It is an advertisement.** Not a report, not a release note, not a summary of work done. Its whole
job is to make a stranger want to open the link, and it does that by making the game sound like
somewhere worth going.

Being truthful is how it earns the right to do that. But a paragraph that is accurate, clear,
correct and boring has failed at the only thing it was for. **Dryness is a failure mode, not a
safe default.** If a draft reads like a specification with the numbers removed, throw it out.

## The model to copy

The published dev-log posts are **the worked examples of this page — read them before drafting
anything, and when in doubt, follow them.** Everything below is derived from them.

They live one year to a directory, as `public/devlog-<year>/source.txt`. Read the current year's,
and the year before it as well when the current file is new or short.

They are also the only writing on the site to take style from. The books and essay collections in
the Library are a different genre — long-form, discursive, written to explain rather than to invite
— and that voice does not transfer to a short piece of promotional copy.

## Who reads it

Someone who has never heard of ThingsPool, does not write software, and owes the text nothing. They
will read one sentence before deciding whether to read the second. Many of them read English as a
second language, so every individual word has to be a common one — but a common word arranged into
an exciting sentence is exactly what is wanted.

## Voice

Warm, direct, and enthusiastic. The project speaks as **"we"** and addresses the reader as
**"you"**. It is pleased about what it built and it says so.

- **Talk to the reader.** "You don't need to download anything; just click the link and you will be
  right inside our virtual universe!" Contractions are fine. Second person throughout.
- **Exclamation marks are allowed**, roughly one or two per post, at the end of a promise rather
  than sprinkled through the middle.
- **Invite them in.** Every post ends with an invitation: *"So jump in, and become part of our
  everlasting journey."* / *"Come join ThingsPool."* / *"Stay tuned!"* The copy asks for the click.
- **Grand words are welcome where the thing is genuinely grand.** "Our virtual universe",
  "architectural wonders", "unforeseen adventures", "hidden corners". These are not vague — they
  are an invitation to imagine, which is the point.
- **One vivid physical image per post, at most.** *"You will fly in mid air, chasing what you are
  editing in real time!"* — a real mechanic, described as a sensation rather than as a feature. This
  is usually the best line in the post. It is also the line that goes wrong if there are three of
  them, so find several and keep one.
- **Spell in American English** — "color", "behavior", "two-story", "socialize".

The picture to keep in mind is somebody showing a friend around a place they built themselves and
are proud of.

## Sentences

Ordinary, unfussy prose. These are the only mechanical rules:

- **Every sentence has a subject and a main verb.** No fragments used as rhetorical beats. This is
  the one sentence-level rule that does not bend.
- **Common words only.** No word is chosen for its strangeness. Every word in the model posts is one
  a second-language reader already knows.
- **Short paragraphs** — one to three sentences, then a break or an image.
- **No jargon, ever.** See [How much detail](#how-much-detail).

Things earlier versions of this page banned, which the model posts do freely and which are
therefore **fine**:

- **Relative clauses.** "a 3D chat app which runs in a browser tab", "which is a news feed for the
  project's major updates", "in which you can build your own room". Natural English uses these.
- **Phrasal verbs.** "open up", "made up of", "comes in", "jump in", "picking things up".
- **The appositive opening.** "ThingsPool, an immersive browser-based metaverse app, now supports…"
- **Semicolons and dashes.**
- **A pronoun carrying across a paragraph break** where the subject is obvious: *"It used to only
  have single-story rooms…"* opening a paragraph, meaning ThingsPool.
- **Repeating a construction on purpose.** "In Play Mode, you will be… / In Edit Mode, on the other
  hand, you will be…" Parallel structure across two paragraphs is a technique, not a repetition
  fault.

## Lists are the main technique

Earlier versions of this page said never to enumerate. That was wrong, and it is most of what made
the copy dry.

**A list with an open end is how this copy suggests abundance.** Name three or four concrete things
and then leave the door open:

> …you can chat with people, build your own personal space, and partake in unforeseen adventures.

> …the room's walls, floors, ceilings, doors, staircases, furniture, **and a variety of other
> hidden corners**.

> …you can build stairs, vast halls of high ceilings, **and other architectural wonders**!

The named items make it real; the tail makes it feel bigger than the sentence. One such list per
paragraph is the natural rhythm. A paragraph with no list in it is usually the one that sets a
list up.

The tail is doing real work, so pick it deliberately. "And so on" is the weakest of them because it
adds nothing the reader can picture; "a variety of other hidden corners" and "other architectural
wonders" both hand the reader something to imagine.

## Be concrete about what it is, open about what you do

This is the rule that replaces the old blanket demand for definable nouns.

**What the thing is** gets named plainly, in words the reader already holds: *a 3D chat app in a
browser tab*, *two-story rooms*, *walls, floors, ceilings*. Never make the reader guess what the
product is.

**What the reader might do with it** is deliberately open: *unforeseen adventures*, *various
treasures*, *hidden corners*, *architectural wonders*. Here the reader's own imagination does the
selling, and pinning it down to one specific scene makes it smaller.

Getting this backwards is the failure: fuzzy about the product, over-specific about the activity.

## How much detail

This rule survives from every previous version, unchanged, because the model posts contain
literally none of what it forbids.

**Never explain how a feature works.** Name it, say what a player does with it, move on.

**Never say where a feature sits on screen.** The screenshots show the interface.

**Never at all:** class names, file paths, function names, algorithms, data structures, performance,
network bandwidth, protocols, state management, architecture, refactoring, and the trade vocabulary
("instanced mesh", "observable", "signal", "decoupled", "single source of truth").

**Allowed once, in a plain-language clause:** the name of a technology ("built with Three.js and
WebGL"). Then move on.

A skill may raise this ceiling for a venue whose audience came specifically for the engineering, and
it says so where it does.

## Length

**Aim for about 600 characters of prose.** The three model posts run roughly 620, 550 and 510
characters of body text, excluding the title and the hashtag line. Six short paragraphs is a long
post.

A character ceiling set by a platform is a limit, never a target. Being at a fifth of it is the
normal, correct outcome. **Never add a sentence because there is room for one.**

What comes out of a draft first:

- **Sentences that restate the sentence before them.** Keep the better one.
- **The second explanation of anything.** One pass at an idea is enough.
- **Modifiers that place, time or qualify something the reader does not need placed, timed or
  qualified.**
- **Commentary about the text itself** — "The pictures deserve a paragraph of their own".
- **Anything an engineer would find interesting and a player would not.**

## The shape of a post

The model posts share it, and it is a good default:

1. **One sentence** saying what is new, or what ThingsPool is.
2. **One sentence** giving the newcomer the other half — what ThingsPool is, or what is new.
3. A short paragraph per part of the feature, each ending in an open list.
4. **A closing invitation.**

Images break the text up at roughly even intervals, about one per paragraph. An image may sit
before the prose it illustrates, and a post may end on one.

## Truth

Every claim traceable to code that was read or a screenshot that was looked at. A promotional claim
the game does not deliver is discovered within thirty seconds of the click, and that is the one
mistake this copy cannot survive.

The open-ended list is what makes this easy rather than hard. **The named items are read as
shipped; the tail is read as an invitation.** "Stairs, vast halls of high ceilings, and other
architectural wonders" is completely fair — stairs and tall halls both exist, and "other
architectural wonders" promises nothing in particular.

The line falls inside the list, not around it. Compare:

> In Play Mode, you will be engaging in all sorts of rich gameplay experiences - such as
> inspecting, attacking, picking things up, eating, and so on.

Inspecting is real. Attacking, picking things up and eating are not, and a reader who arrives
looking for them finds a room they can only look at. The tail would have carried all three by
itself: *"…such as inspecting the things around you, and a good deal more to come."*

So: check every *named* item against the code, and let the tail carry the future.

## The checks

Read the finished text once for each, and fix what fails. The skill that owns the piece adds its
own checks on top.

1. **Would a stranger want to click after reading this?** If the honest answer is "it is accurate",
   the draft has failed and needs rewriting, not polishing.
2. **Every sentence has a subject and a main verb.**
3. **Every word is a common one.** No word chosen for its strangeness.
4. **The reader learns what ThingsPool is** within the first two sentences.
5. **What the product is, is concrete. What the reader might do, is open.** Not the other way round.
6. **There is at least one open-ended list,** and at most one vivid physical image.
7. **The post ends by inviting the reader in.**
8. **No paragraph would interest only a programmer,** and none explains how a feature works or
   where it sits on screen.
9. **Every named item is real.** Check each against the code; the open tail needs no check.
10. **It is about 600 characters,** not two thousand. Cut until it is.
