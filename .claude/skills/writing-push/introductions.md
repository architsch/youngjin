# Introductions

How [`SKILL.md`](SKILL.md) drafts the words he posts to introduce one of his posts in a venue, when he
asks for them (Step 4). It never posts them. Venue rules change, so each one's rules are re-read on the
day; where this page disagrees with them, the venue wins and this page is corrected.

## How much is drafted

The venue's rule on machine-written text decides, and the hand-over quotes it:

| The venue's rule | What he gets |
|---|---|
| Bans generated text in posts (Hacker News) | The submission's fields, filled from his page. Nothing written |
| Bans AI-assisted material (r/philosophy) | His own sentences, quoted from the post, to choose from and write with. Nothing written |
| Allows AI help but not a message written whole by AI (intfiction.org), or wants AI text labelled (The Motte) | A draft he rewrites in his own words before posting |
| Says nothing | A draft he rewrites, and a line saying the venue is silent |

A draft is never his finished words. Hand it over saying so: he rewrites it in his own words, not a word
or two changed, or posts it labelled as AI-written where the venue accepts that.

## Writing a draft

- **Read the whole post first**, and its neighbors in a series. Every claim in the draft is one the post
  makes, and a quote is verbatim. Claim nothing about him that he hasn't said (that he uses the idea in
  his own project, that he wrote without AI): leave at most one bracketed line for him to keep or delete,
  such as `[Only if true: I wrote the essay myself, without AI.]`.
- **His voice, as the author.** This is the exception [`../../writing-style.md`](../../writing-style.md)
  lets a skill name: an introduction of an essay in a discussion forum is his note to the people there,
  in the first person, plain. That page's rules on common words, whole sentences, short paragraphs,
  American spelling and saying it once hold; its "we", its exclamation marks, its closing invitation and
  its length are the game's and do not. His own one-line introductions of each volume, in
  `temp/writings-strategy/first-party-data.md`, show how he talks about his writing.
- **Its parts:** what the post asks; its answer in a few steps, in its terms; one short quote; the step
  the post admits is weakest, where it admits one; and a real question for that room. Between 100 and
  300 words: the post does the arguing.
- **Tied to the room.** Say what the post offers these readers in particular, from what it actually
  holds: a forum about stories hears about the stories in it.
- **Nothing that reads as machine-written:** no "delve", no "I'd love to hear your thoughts!", no
  triplets of adjectives, no sentence summing up each paragraph, no headings in a forum post.
- **The title** is the page's own or its description (his words) wherever the venue allows. Where both
  are opaque to that room, a draft title, marked as one.
- **Hand-over:** save each draft as `temp/writings-strategy/drafts/<date>-<post>-<venue>.md`, with where
  it goes, its fields, the rule lines quoted with the date they were read, and the text. Show the text
  inline in a fenced block, so he copies it raw. Its ledger row is `prepared` and names the file.

## Per venue

### Hacker News

- **Fields:** Title, the page's own title character for character, with the site's name taken out
  ("please use the original title, unless it is misleading or linkbait; don't editorialize"); URL, bare;
  Text, empty.
- **Nothing written**, posts and comments alike: "Please don't put generated text in HN posts. Write your
  text yourself" and "Don't post generated text or AI-edited text." No first comment, no reply, no
  suggestion of what to say. Help him there only by finding live threads he has firsthand experience
  for.
- **Before he submits**, read the ledger and his submissions
  (`https://hn.algolia.com/api/v1/search_by_date?tags=story,author_architsch`). "It's ok to post your
  own stuff part of the time, but the primary use of the site should be for curiosity", so say so when
  most of his submissions are his own pages. A URL goes again only if it "has not had significant
  attention", and only "a small number of reposts". If a story sinks, one email to hn@ycombinator.com
  asking for the second-chance pool is allowed for one's own.

### r/philosophy

- **Nothing written.** Its rules ban posts and comments that contain or link to AI-generated or
  AI-assisted material, translations included. Reddit can't be read from here, so he reads the current
  rules himself.
- **What he gets:** the bare URL; title candidates that are his own words verbatim (the page's title, its
  description, a sentence stating its thesis), each with where it comes from; and, for the abstract he
  writes, the sentences that state the thesis and each step, quoted in order.
- **The post itself** must hold no AI-made material (code, figures), or the link breaks the same rule:
  his to judge.

### The Motte (themotte.org)

- **A new post**, not the weekly Culture War thread, for anything outside the culture war. Fields:
  title, link, body.
- **Link:** tagged `?ref=themotte`, since its outbound links carry `rel="noreferrer"`.
- **Body:** a submission statement, "highly appreciated" for blog links; a post they are unsure of may
  be removed "until you add a submission statement". The draft's parts above, up to 300 words.
- **AI:** the rules page is silent. In February 2025 the moderators agreed "AI generated content should
  be labelled as such", so he rewrites it in his own words, or labels it.

### intfiction.org

- **A new topic**, in the category whose description fits: Authoring › General Design Discussions for
  making games and the stories in them, Authoring › Story Research and Design for modelling a story,
  Playing › IF Reviews and Essays for writing about IF. Announcements › Games asks new accounts to "join
  the conversation a bit first".
- **Body:** a hello and who he is, in one line; what the post claims, in IF's terms (stories, world
  models, characters); the link alone on its own line, which the forum previews; and a question for IF
  authors. One link is enough, as Discourse limits a new account's links per post. Bare, since the forum
  passes its address on.
- **AI:** "It's okay to use AI to assist your writing, but please don't use an AI to generate your entire
  message." So he rewrites it. A new user's first post waits for a moderator.
