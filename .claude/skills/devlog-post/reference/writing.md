# Writing the post

**The house style is in [`../../../writing-style.md`](../../../writing-style.md). Read it, and read
the published posts it points at, before drafting anything.** It carries the voice, the sentence
rules, how much detail is allowed, what to cut, and the checks — all shared with the copy
`distribution-push` writes, so none of it is repeated here.

This page adds only what is specific to a dev-log post: its title, its opening, its structure on the
page, and its hashtags.

## The corpus

The house style says to imitate the published posts rather than to reason from rules, and for dev-log
posts those posts are the whole of `public/devlog-<year>/source.txt`. Read the current year's file
end to end, and the year before it as well when the current one is new or short. Take the register,
the length, the rhythm of paragraph-image-paragraph, and the facts, so the new post contradicts
nothing.

Read several, not the most recent one. The pattern that runs through the run of them is the style;
any single post is one solution to one feature.

## The title

**The shortest noun phrase that names the feature.** "Game Modes". "Second Floor". "Dynamic Doors".
"Introducing ThingsPool". Two words is normal.

Not a sentence, not "X Is Here", not a colon-and-tagline, and nothing that needs decoding. A reader
scanning a feed has nothing to decode with.

## The opening

Social platforms show about two lines and hide the rest behind "see more", so the opening carries the
whole post: **what is new**, and **what ThingsPool is** for a reader who has never heard of it. The
house style's shape section says how to fit both into one appositive sentence, which is the shape to
reach for; the corpus also does it in two, three different ways.

Never open with a scene, a question, or a detail that only makes sense once the reader already knows
what the feature is.

## Structure on the page

1. **Title.**
2. **The link to the landing page**, on the line directly under the header. Exact line in
   [post-format.md](post-format.md).
3. **The post itself**, in the shape the house style gives.
4. **Hashtags**, on the final line.

What the game was like before the feature existed is often worth a sentence — *"It used to only have
single-story rooms, which severely limited your creative freedom. It is no longer the case."* — and
rarely worth more than that.

## Hashtags

About sixteen, each `#` followed by a PascalCase term, on one line at the end. The bank and the rules
are in [hashtags.md](hashtags.md). Do not improvise a set without reading it.

## SEO

Search engines read the page, not the `:k:` line alone. Name the things the post is about in the
prose — the product, the technologies, the domain terms someone would search for. Once each, where
the sentence wanted the word anyway.

## An annotated example

The third post, in full:

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

Four short paragraphs and 510 characters. The title is two words. The new thing takes the first line,
the second paragraph tells a newcomer what ThingsPool is, the third says what was wrong before and
fixes it in a four-word sentence, and the last asks for the click. Two of the four paragraphs end on
an open list.

Note what it does not do. It never says which button to press, where anything sits on screen, or how
a storey is built. It does not explain, summarize itself, or thank anyone for reading.

## Checks before publishing

Run every check in "The checks" at the end of
[`../../../writing-style.md`](../../../writing-style.md) first. Then these four, which are the post's
own:

1. **The title is a short noun phrase naming the feature.**
2. **The opening stands alone** if everything below it is covered up.
3. **Every screenshot kept is referenced**, and every reference resolves to a file.
4. `node dev/scripts/devlog/postLength.js` passes, and the post is near 600 characters rather than
   near the ceiling.
