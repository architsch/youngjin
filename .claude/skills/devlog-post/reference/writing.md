# Writing the post

**The house style is in [`../../../writing-style.md`](../../../writing-style.md). Read it before
drafting anything.** It carries the voice, the sentence rules, how much detail is allowed, and what
to cut — all of it shared with the copy `distribution-push` writes, so it is not repeated here.

This page adds what is specific to a dev-log post.

## What the post is for

Advertising. The post exists to make a stranger want to open the game.

Being informative is how it earns the right to do that, but the information is the means, not the
goal. **A post that is accurate, clear and boring has failed.** The reader should finish it wanting
to go and see the place for themselves.

## The previous posts

**When in doubt, refer to the previous devlog posts for guidance on the style of writing. Use them
as examples.** They live one year to a directory, as `public/devlog-<year>/source.txt`. Read the
current year's before drafting, and the year before it as well when the current file is new or
short. Take from them:

- **The register** — warm, enthusiastic, speaking to the reader as "you" and for the project as
  "we", ending on an invitation.
- **The length** — the three posts of August 2026 run roughly 620, 550 and 510 characters of body
  text.
- **The rhythm** — a short paragraph, an image, a short paragraph, an image.
- **The facts**, so the new post contradicts nothing.

Where a post and a written rule disagree, the post usually wins; these rules are a distillation of
the posts and go stale first. If the difference looks like a real question rather than a stale
rule, ask the user rather than guessing.

These are the only writing on the site to take style from. The books and essay collections in the
Library are a different genre, and that voice does not transfer to a short promotional post.

Published posts are dated records. Fix the new post, never the published ones.

## What to write about

**What a player can see, do and make.** Never how the program works. The model posts contain no
implementation detail of any kind, and that is not an accident of brevity — it is the point.

**Name the parts, then open the door.** The natural paragraph shape is a few concrete things
followed by a tail that suggests more:

> In Edit Mode, on the other hand, you will be editing the room's walls, floors, ceilings, doors,
> staircases, furniture, and a variety of other hidden corners.

Six real things and then "a variety of other hidden corners". The reader gets something solid to
hold and a sense that there is more of it than the sentence had room for.

**One vivid line about what it feels like.** Per post, one:

> Enter the Edit Mode, and click anything you see; you will fly in mid air, chasing what you are
> editing in real time!

That is the orbit camera, described as a sensation instead of as a feature. Find several during
research and keep the best one; three of them in one post cancel each other out.

**Close by inviting them in.** "So jump in, and become part of our everlasting journey." / "Come
join ThingsPool. The second floor's open air is inviting you." / "Stay tuned!" The post asks for
the click. Earlier versions of this page forbade that, which was wrong.

## Length

**About 600 characters of prose.** Six short paragraphs is a long post. The platform ceiling is a
limit, not a target, and a post at a fifth of it is the normal outcome.

## The title

**The shortest noun phrase that names the feature.** "Game Modes". "Second Floor". "Introducing
ThingsPool". Two words is normal.

Not a sentence, not "X Is Here", not a colon-and-tagline, and nothing that needs decoding. A reader
scanning a feed has nothing to decode with.

## The opening

Social platforms show about two lines and hide the rest behind "see more", so the first two
sentences carry the whole post: **what is new**, and **what ThingsPool is** for a reader who has
never heard of it.

Either may lead, and the model posts do it three different ways:

> ThingsPool is a 3D chat app you can open up in a browser. You don't need to download anything;
> just click the link and you will be right inside our virtual universe!

> ThingsPool, an immersive browser-based metaverse app, now supports two distinct game modes -
> "Play Mode" and "Edit Mode".

> You can now build two-story rooms in ThingsPool!
>
> ThingsPool is a 3D real-time chat application, in which you can build your own room, socialize
> with other people, and engage in many hidden adventures.

Note the third: the new thing gets a one-line paragraph of its own, and the description follows in
the next paragraph. Note also that the appositive construction is fine — an earlier version of this
page banned it, on the theory that varying the opening's shape mattered more than writing a good
one. It does not.

Never open with a scene, a question, or a detail that only makes sense once the reader already
knows what the feature is.

## Structure

1. **Title.**
2. **The link to the landing page**, on the line directly under the header. Exact line in
   [post-format.md](post-format.md).
3. **What is new, and what ThingsPool is** — the first two sentences.
4. **A short paragraph per part of the feature**, each ending in an open list.
5. **A closing invitation.**
6. **Hashtags**, on the final line.

What the game was like before the feature existed is often worth a sentence — *"It used to only
have single-story rooms, which severely limited your creative freedom. It is no longer the case."*
— and rarely worth more than that.

Images break the text up at roughly even intervals. One may sit before the prose it illustrates,
and a post may end on one.

## Hashtags

About sixteen, each `#` followed by a PascalCase term, on one line at the end. The bank and the
rules are in [hashtags.md](hashtags.md). Do not improvise a set without reading it.

## SEO

Search engines read the page, not the `:k:` line alone. Name the things the post is about in the
prose — the product, the technologies, the domain terms someone would search for. Once each, where
the sentence wanted the word anyway.

## An annotated example

This is the third model post, in full:

```
[Second Floor] August 21, 2026

@@<h3>New here? Start with <a class="inlineButton" href="https://thingspool.net#what-is-thingspool">What is ThingsPool?</a></h3>

You can now build two-story rooms in ThingsPool!

ThingsPool is a 3D real-time chat application, in which you can build your own room, socialize
with other people, and engage in many hidden adventures.

<second-floor-stairs>

It used to only have single-story rooms, which severely limited your creative freedom. It is no
longer the case. Rooms are now two stories high, meaning you can build stairs, vast halls of high
ceilings, and other architectural wonders!

<second-floor-gallery>

Come join ThingsPool. The second floor's open air is inviting you.

<second-floor-editing>

#ThingsPool #VirtualSpace #OpenWorld #WebGame #SandboxGame #GameDesign #WorldBuilding #FreeToPlay
#VoxelEngine #ProceduralGeneration #LevelEditor #GameEngine #DigitalArt #ThreeJS #WebGL #TypeScript
```

(Paragraphs are one line each in the source file, as is the hashtag line; both are wrapped here only
to fit this page.)

Four short paragraphs and 510 characters. The title is two words. The new thing gets the first line
to itself, and the second paragraph tells a newcomer what ThingsPool is, with a three-item list that
ends open ("many hidden adventures"). The third paragraph says what was wrong before, fixes it in a
four-word sentence, and ends on another open list. The last paragraph asks for the click, and the
final line is the one piece of poetry in the post.

Note what it does not do. It never says which button to press, where anything sits on screen, or how
a storey is built. It does not explain, summarize itself, or thank anyone for reading.

## Checks before publishing

First run every check in "The checks" at the end of
[`../../../writing-style.md`](../../../writing-style.md). Then these:

1. **Would a stranger want to click?** The first question and the one most often skipped. If the
   honest answer is "it is accurate", rewrite it.
2. **The title is a short noun phrase naming the feature.**
3. **The first two sentences say what is new and what ThingsPool is,** and stand alone if the rest
   is covered up.
4. **It ends with an invitation.**
5. **At least one open-ended list, and exactly one vivid physical line.**
6. **No step-by-step instructions, and nothing about how the feature works.**
7. **Every item named in a list is real in the code.** The open tail needs no check.
8. **Every screenshot kept is referenced.**
9. `node dev/scripts/devlog/postLength.js` passes, and the post is near 600 characters rather than
   near the ceiling.
