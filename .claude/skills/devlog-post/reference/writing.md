# Writing the post

**The house style is in [`../../../writing-style.md`](../../../writing-style.md). Read it before
drafting anything.** It carries the voice, the sentence rules, how much detail is allowed, and what
to cut — all of it shared with the copy `distribution-push` writes, so it is not repeated here.

This page adds what is specific to a dev-log post: what the post is for, what goes in it, how it
opens, and how it is checked.

## What the post is for

Advertising. The post exists to make a stranger want to open the game.

Being informative is how it earns the right to do that — a truthful account of something real
persuades better than a slogan — but the information is the means, not the goal. A paragraph that
is accurate and interesting to nobody but its author should be cut.

The test the whole post is written against: **a reader should finish it able to picture one
specific thing they would like to go and make or try in ThingsPool.** One thing, not a list of
things.

## What the earlier posts are for

`public/devlog-2026/source.txt` holds every post already published. Read it, for exactly two
reasons:

- **The openings**, all of them, so the new one does not repeat a construction already used. See
  [Say it differently every time](#say-it-differently-every-time) below.
- **The facts**, so the new post does not contradict what an earlier one told the reader.

**Do not take the writing style from them.** They were written under earlier versions of these
rules and several of them break the current ones — sentences carrying three ideas, lists of four
things to try, a mention of a feature the post was not about. The house style states this rule for
all public copy; it matters most here, where a whole series of previous work sits one file away.
Each post should come out better than the last, which cannot happen if the last one is the model.

Old posts are dated records. Fix the new post, never the published ones.

## What to write about

**Prefer what a player can do over how the program works.** Most of the post is what you can see,
do and make. At most one short paragraph is how it works underneath, and only when that idea is
genuinely interesting to someone who does not program.

**Describe the concept, not the controls.** Walking through which button opens which panel, in what
order, is the fastest way to lose a reader, and it is the part that changes next month anyway. Say
what the feature *is* and what it lets somebody do, and let one concrete detail stand in for the
rest. "Enter play mode and explore a room's hidden corners, or switch to edit mode and craft the
space you actually want" carries further than a paragraph tracing every click.

**Include one possibility, not only facts.** A feature is worth a post because of what it makes
possible. Say what someone might build or try with it, concretely enough to picture: a gallery of
paintings hung along your own hallway. Imaginative and forward-looking is right; vague is not.
"Endless possibilities" is worth nothing. One specific possibility is worth the sentence it takes,
and the second one costs more than it adds. This is the paragraph where lists breed, so watch it
hardest.

**Keep the possibility honest.** Write it as what becomes possible, not as what already exists. "A
click is no longer automatically an edit, so a click can come to mean something else later" is
fair. "You can now pick objects up" is a lie if you cannot.

**Grow less detailed as the post goes on, not more.** Posts drift into step-by-step description
toward the end, because by then the writer is deep inside the feature and forgets that the reader
has only just met it. Do the reverse. Once the reader knows what the feature is, give the short
conceptual summary of each part:

> Play mode is a first-person adventure through a labyrinth of rooms. Edit mode lets you customize
> everything around you.

Two short sentences where a walkthrough would have taken eight, and the reader is left with
something to imagine rather than something to memorize.

## Length

**2964 characters is a hard ceiling, not a target.** It is the most a post is permitted to be, and
has nothing to do with how long it should be. A post that says everything it has to say in 1200
characters is better than the same post padded to 2900, and the shorter one is more likely to be
read to the end. Never add a sentence because there is room for it.

What comes out of a draft first is listed in the "Cut" section of
[`../../../writing-style.md`](../../../writing-style.md).

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

**These are the shortest sentences in the post.** Two short sentences beat one long one here, every
time. "ThingsPool is a 3D chat app in a browser tab. The app now has game modes" delivers both jobs
without a single clause the reader has to hold open. Save the elaboration for the third sentence.

The rest of the post expands on the opening. Never open with a scene, a question, or a detail
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
- Whether they are one sentence or two. Two is usually better, and always better when one would run
  long.
- How ThingsPool is described. "An immersive 3D chat app that runs in a browser tab" is one true
  description of it, not its name — it is also a shared world you walk into as a character, a room
  full of blocks anyone present can rebuild, a 3D space that opens from a link. Pick the description
  that suits *this* post's feature, and let a post about building sound different from a post about
  talking to people.
- Whether the appositive clause ("ThingsPool, a ..., now ...") is used at all. It is one construction
  among many, it packs a relative clause into the first sentence, and it has had its turn.

What may not vary: the reader still learns what ThingsPool is and what is new, inside the first two
sentences. Variety is in the delivery, never at the cost of length or of a newcomer understanding
the post.

## Structure

This order is the default, and a post with a good reason may vary it:

1. **Title** — see above.
2. **The link to the landing page**, on the line directly under the header. The exact line is in
   [post-format.md](post-format.md).
3. **The opening two sentences** — what ThingsPool is, and what is new.
4. **What the feature is and what it lets you do** — the body. Concept first, concrete enough to
   picture, and free of step-by-step instructions.
5. **What it makes possible** — the one possibility described above.
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

ThingsPool is a 3D world you explore and rebuild in a browser tab. The world now has an orbit
camera.

Click a block, and the camera circles it. You can work on a wall from every side.

<orbit-camera-overview>

Before this, you built from wherever you stood. Reaching the far side of a wall meant walking
around it.

A ceiling is now as easy to build as a floor. Paint one to look like a sky.

<orbit-camera-detail>

#ThingsPool #Metaverse #VirtualWorld #Sandbox #BrowserGame #IndieGame #GameDev #OpenSource
#WorldBuilding #GameMechanics #CameraControl #LevelEditor #VoxelEngine #TypeScript #ThreeJS #WebGL
```

(Each paragraph is one line in the source file, and so is the hashtag line; both are wrapped here
only to fit this page.)

The title names the feature. Somebody who reads only the first two sentences knows what ThingsPool
is and what is new in it. Every sentence is short, active, and free of clauses the reader has to
hold open.

Note what it does not do. It never says which button to press, where the camera control sits on
screen, or how the camera decides what to circle. It offers one thing to try — a painted ceiling —
rather than four. It stays on its own subject and mentions no other feature. It does not say the
feature is exciting, does not thank anyone for reading, does not ask for a click, and does not sum
itself up at the end. Every sentence could be restated by the reader in their own words.

Note also how short it is — under a third of the budget, because that is all the feature needed.

## Checks before publishing

First run every check in "The checks" at the end of
[`../../../writing-style.md`](../../../writing-style.md) — one pass per test, on the finished text.
Then these, which belong to the dev-log post specifically:

1. **The title names the feature in literal words.** If it could belong to any other post, or
   needs the post to explain it, rename it.
2. **The first two sentences stand alone, and are the shortest in the post.** Cover everything
   from the third sentence down: what is left must still say what ThingsPool is and what is new.
3. **The opening does not repeat an earlier post's construction.** Put the new opening directly
   beside the opening of every post already in `source.txt`. If two of them share a shape — the same
   appositive, the same "ThingsPool ... now ..." frame, the same clause order — the new one is
   rewritten, not reworded.
4. **No step-by-step instructions,** and the post gets *less* detailed as it goes, not more. If a
   later paragraph traces a sequence of interactions, replace it with what that part of the feature
   lets somebody do.
5. **The post names one specific thing the reader could go and make or try.**
6. **Every screenshot kept is referenced,** at the point the prose has just described what it shows.
7. `node dev/scripts/devlog/postLength.js` passes — and remember its number is a ceiling. Being
   well under it is a good sign, not wasted room.
