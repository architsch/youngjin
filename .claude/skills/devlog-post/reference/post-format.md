# The post source format

Every list in the Library — including `devlog-2026` — is one `source.txt` holding every post in
that list, one after another. `LibraryPostPageBuilder` reads it top to bottom and emits one
`page-N.html` per post: the oldest post in the file is `page-1.html`, the newest is the highest
number, and the list page shows them newest first.

So a new post is **appended to the end of the file**. Posts already in it are never edited — with
one exception: a post being rewritten because its first version was rejected is replaced in place,
since the block at the end of the file is that rejected version.

## The link to the landing page

Every post opens with a link to the site's own landing page, on the line directly under the header:

```
@@<h3>New here? Start with <a class="inlineButton" href="https://thingspool.net#what-is-thingspool">What is ThingsPool?</a></h3>
```

Someone arriving at a post about one camera behaviour has no idea what the game is; that line is
where they find out, and the fragment drops them on the section of the landing page that answers
it. It is raw HTML rather than prose, so it renders as a heading with a button on the page and
stays out of the text the user pastes into a social post — where the "Play Here" line does the same
job. `postLength.js` warns when a post is missing it.

## The shape of one post block

```
:d:One sentence of description. Becomes the page's meta description and its share-preview text.
:k:Comma, Separated, Terms, In Title Case
:l:2026-08-08

[The Post Title] August 8, 2026

First paragraph. One line per paragraph — a hard-wrapped paragraph becomes several <br>-joined
lines instead of one flowing block.

<slug-overview>

Another paragraph.

<slug-detail>

#HashTag #AnotherHashTag #AndSoOn
```

Leave a blank line between the previous post's last line and the new block's `:d:` line.

### The directive lines

The three directives sit **above** the header of the post they belong to (that is how the builder
pairs them up — not a stylistic choice).

| Line | Becomes |
| --- | --- |
| `:d:` | `<meta name="description">`, the Open Graph description, and the post's entry in the Atom feed |
| `:k:` | `<meta name="keywords">` — lower-cased by the builder, so write it however reads best |
| `:l:` | The last-modified date in the sitemap and the feed. `YYYY-MM-DD`. Use the day the post is written |

The `:k:` line is the same reach the hashtags are after, written for a crawler instead of a feed:
much the same terms — see [hashtags.md](hashtags.md) — in ordinary words rather than PascalCase
(`Virtual World`, `Free to Play`). Keep it to a dozen or so, as the rest of the Library's lists do.
A long line of loosely related terms is what a crawler treats as stuffing, and `<meta keywords>` is
worth little enough that there is nothing to win by pushing it.

### The header line

`[Title] Date` — the bracketed part is the title used on the page, in the list, in the browser tab
and in the share preview. Everything after the closing bracket is printed under it as the date.
Write the date the way the other posts do: `August 8, 2026`.

### Links

A link inside a paragraph is written with the format's angle-bracket stand-ins, the way the other
library posts write theirs — the live site's own absolute URL, and a new tab:

```
... visit {%a target="_blank" href="https://thingspool.net/read-rec/page-2.html"%}Here{%/a%}.
```

`https://thingspool.net` is rewritten to the local address when the dev server serves the page, so
an absolute URL is right even while previewing locally.

### Images

A line of the form `<name>` on its own becomes `public/devlog-2026/name.jpg`, so the name is the
screenshot's filename without the extension — `<orbit-camera-overview>` for
`public/devlog-2026/orbit-camera-overview.jpg`.

The **first** image in a post becomes its share-preview image. Appending `*` to the line
(`<orbit-camera-detail>*`) hands that job to a different one instead.

Place images between paragraphs, at the point the prose has just earned them.

## What not to use here

The format supports code snippets (`#$`), block excerpts (`#"`) and raw HTML lines (`@@<hr>`).
Dev-log posts use none of them, the one link line above excepted: the whole point is that the post
can be selected on the page and pasted into a social post unchanged, and none of those survive that
trip. `postLength.js` warns when it finds them.

Two things the format will misread if they open a line:

- A line starting with `[` is read as a new post header.
- A line starting with `<` is read as an image reference.

Write angle brackets in prose as `{%` and `%}`; the builder turns those into `<` and `>`.

## The character budget

```bash
node dev/scripts/devlog/postLength.js          # the newest post
node dev/scripts/devlog/postLength.js --all    # every post in the file
```

It counts what a reader would select and copy — the title, then the paragraphs and hashtags —
against 2964 characters: LinkedIn's 3000-character limit, less 36 for the
`Play Here: https://thingspool.net` line the user adds by hand. It exits non-zero when the post is
over, and warns about missing directives, missing hashtags, emoji, and markup that would not
survive being pasted.
