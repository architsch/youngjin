# Writing the post

## Who it is for

Someone scrolling a feed who has never heard of ThingsPool, does not write software, and owes the
post nothing. They will give it one sentence before deciding. The post's job is to make that
person curious enough to open the game — and, along the way, to leave a record of what was built.

Both jobs are served by the same thing: showing what the feature is actually *like*. Neither is
served by a post that reads as documentation, and neither survives a post that reads as an advert.

The reader is a player, or about to become one. Write for them; the engineers reading over their
shoulder will follow a good story about a game far more happily than the reverse.

## Voice

Someone who built the thing, showing it to a curious stranger. Plain, concrete, unhurried,
confident about the work without selling it. Say what a person sees and does, in the second person
where it falls naturally — "select a wall and it is yours to work on" beats "walls are
user-selectable and editable".

Not this:

- Exclamation marks, "excited to share", "game-changing", "seamless", "revolutionary".
- Rhetorical questions aimed at the reader ("Ever wondered how...?").
- Emoji, of any kind, anywhere.
- Bullet lists standing in for prose. These are paragraphs.
- Vague superlatives where a fact would do. "Much faster" is worth nothing; what changed is.
- Opening with the machinery. The first sentence is what the reader would see or do; how it was
  built comes after they care.
- Jargon a player would not use — class names, file paths, "instanced mesh", "observable". Name a
  technology when it adds to the story, not to prove the work was hard.

Two tests, both worth applying:

- Would this sentence embarrass its author in a code review? Then it is overselling.
- Would someone who does not play games finish the first paragraph? If not, it is too dry — and
  dryness is the likelier failure of the two.

## Structure

Roughly 1200-2400 characters, well inside the 2964 ceiling, in this order:

1. **Title.** Plain words, and inviting rather than clinical. It names the thing the post is about,
   ideally through what the reader would do with it. No colon-and-tagline construction.
2. **The link to the site's landing page**, on the line directly under the header — the one piece
   of furniture every post carries, so that a stranger who arrives here first can find out what the
   game is. The exact line is in [post-format.md](post-format.md).
3. **The hook** — one or two sentences on what a player can now see or do, concrete enough to
   picture. This is the sentence the whole post is judged on.
4. **What was awkward without it.** The reason the work happened, told as the reader would have
   felt it, not as a ticket description. This is the paragraph that makes the rest interesting, and
   the one most often skipped.
5. **How it works** — the idea, not the implementation. Name the concept and, where it earns its
   place, the technology; leave out function names, file paths, constants and class-by-class
   detail. A reader should finish with a mental model, not a diff.
6. **What it means in play.** What the game is like now that this exists.
7. **Hashtags**, on the final line.

Images go between paragraphs, at the point the prose has just described what they show.

Nothing here asks for a click. The user's own "Play Here" line does that job, and a post that has
made the reader curious does not need to.

## Hashtags

About sixteen, each `#` followed by a PascalCase term, on one line at the end. Six to eight are
broad ones taken across a standing bank grouped by audience — the kind of place the game is, the
kind of game it is, the craft, the arts, the adjacent fields — so that the post reaches people who
have never heard of it. The rest name what *this* post is actually about.

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
[Build a Wall From the Other Side of It] August 8, 2026

@@<h3>New here? Start with <a class="inlineButton" href="https://thingspool.net#what-is-thingspool">What is ThingsPool?</a></h3>

Pick any block in a ThingsPool room and the camera leaves your shoulder to circle it, so you can
work on a wall from whichever side of it you like — including the side you are not standing on.

Building used to happen from wherever you were standing. A block on the far face of a wall meant
walking around it, and anything above head height meant finding somewhere to stand that could see
it. The camera was doing what a camera does while you play, which is not what you want while you
are building.

Now the thing you select becomes the thing the camera holds on to. Dragging swings the view around
it, you stay put, and because the selection is the pivot, the whole surface stays within reach from
one spot. The same drag means the same thing from every angle.

<orbit-camera-overview>

It shows up most in rooms with insides. Ceilings, alcoves and the backs of walls get built from the
same place as everything else, and dropping the selection puts the camera back on your shoulder,
exactly where it was.

<orbit-camera-detail>

#ThingsPool #Metaverse #VirtualWorld #Sandbox #BrowserGame #IndieGame #GameDev #OpenSource
#WorldBuilding #GameMechanics #CameraControl #LevelEditor #VoxelEngine #TypeScript #ThreeJS #WebGL
```

(The hashtag line is one line in the source file; it is wrapped here only to fit this page.)

Note what it does not do: it does not say the feature is exciting, does not thank anyone for
reading, and does not ask for a click. It is interesting because of what it describes, which is the
only way a post like this is ever interesting.
