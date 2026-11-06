---
name: writing-push
description: Get the user's essays and other library writing on thingspool.net in front of readers — do the few things an assistant may do on its own (notify search engines through IndexNow, list the site's feed in small-web directories, send one invited suggestion to a curator, draft a cross-post through an official API), each only after the user has seen it; hand over what each human-only venue requires for the posts he writes himself, with any introduction he asks for prepared as far as that venue's rule on AI-written text allows (a draft he rewrites, his own sentences only, or the submission's fields only); and record every submission and what came of it. Use when asked to promote, advertise, share or spread a blog post, essay or library writing, to find where to post one, to draft a post introducing one on a forum (Hacker News, r/philosophy, The Motte, intfiction.org and the like), or after a new essay is published. For the game itself, use distribution-push.
---

# Writing Push

The user publishes essays and other writing in the library on `thingspool.net`, a GitHub Pages site built
from `public/`. This skill gets a published post in front of readers. It never writes, edits, titles or
chooses the subject of his writing, and it does not promote the game: that is `distribution-push`.

## Why most of the reach is his to post

The rooms where thoughtful readers find essays and argue about them (Hacker News, r/philosophy,
MetaFilter, community Slacks and forums) all need a person's account, and most ban machine-written posts
and bots. LinkedIn's and X's terms forbid posting through scripts or browser add-ons. So the posts that
carry the most reach are written and sent by him; this skill tells him where, under what rules, and in
what form.

What it can do alone is quieter. It makes the post findable (search engines, and small-web directories
that follow the feed) and makes the few requests that venues invite by email or API. Say so plainly
whenever the user asks what was automated, and never present a listing as reach it hasn't shown.

## Where things live

- `temp/writings-strategy/VENUES.md`: the registry. The human-only venues with their rules and evidence,
  and the routes this skill may take alone, each with the date it was checked.
- `temp/writings-strategy/ledger.md`: every submission and listing, and what came of it. It is history,
  not instructions: never rewrite or delete a row.
- `temp/writings-strategy/drafts/`: each introduction prepared for him, one file per post and venue.
- `temp/writings-strategy/STRATEGY.md` and the dated research folders beside it: background only.

`temp/` is gitignored, so these stay private, and names of individual people go there, never into
`.claude/`. If a file is missing, recreate it from this page rather than guessing what it held.

## Step 1 — Read the ledger and the registry

The most damaging act available here is sending the same link to the same place twice: on every forum
worth posting to it reads as spam, and the penalty falls on his name and his domain. From the ledger,
work out what was done once per site (directory listings, the IndexNow key), what was done for this post,
and what is still waiting on him.

## Step 2 — The post

- Take the post the user names, or else the newest library entries in `public/feed.atom` (its entries
  are not in date order: sort by `<updated>`). Dev logs belong to `distribution-push` unless he asks.
- Read the post: its title, its meta description (his own one-line summary), its opening and its
  figures. Matching a post to a venue needs what it actually argues.
- Check it is ready to be seen. The page answers `200`; `og:title`, `og:description`, `og:image` and the
  canonical link are present, and the image loads; a series volume links to its neighbours and to the
  series list; the feed carries it. A failure is a finding for him, not something this skill fixes.

## Step 3 — Alone (lane A), after he has seen each action

Propose this run's lane A actions as one list, then act on his word. Nothing goes out unseen, and
approval for one run does not carry to the next.

- **IndexNow, for every new or changed post.** The key file is `public/<key>.txt`, 32 hex characters,
  containing the key itself. If there is none, adding it is a one-time change he approves and deploys
  with the site. Once the post is live:

  ```bash
  curl -s -o /dev/null -w "%{http_code}\n" "https://api.indexnow.org/indexnow?url=<encoded post URL>&key=<key>"
  ```

  `200` or `202` means accepted. It reaches Bing, Naver, Yandex, Seznam and Yep. Google takes no pings;
  only Search Console, which is his login. Ping new or changed pages only.
- **Small-web listings, once per site.** After a listing, the feed brings each new post in by itself.
  Recheck each venue's rules first; the ledger says which are done.
  - Kagi Small Web: a pull request from his GitHub (`gh`) adding `https://thingspool.net/feed.atom` to
    `smallweb.txt`, together with two blogs that are not his and not yet listed, in the same commit (its
    rule for self-submissions). He names the two. Its other rules: English, a personal single-author blog,
    a post within the last year, no popups, and no LLM-generated content (heavier LLM use must be
    acknowledged on the site; help at the level of a spell checker is fine). Keep the file sorted; push
    the branch to his fork over SSH (`git@github.com:architsch/<repo>.git`), as HTTPS pushes fail on
    this machine.
  - indieblog.page: one POST of the feed URL to `https://indieblog.page/suggest` (field `suggest`; the
    hidden `title` field is a honeypot and stays empty).
  - Marginalia Search: an issue in `MarginaliaSearch/submit-site-to-marginalia-search`.
  - Two go to him (lane B): personalsit.es, whose maintainer closes AI-generated pull requests (he opens
    it, from the file this skill prepares), and ooh.directory, whose form has a CAPTCHA. On GitHub, a pull
    request from his fork can default to the fork itself as its base, so hand him the
    `https://github.com/<owner>/<repo>/compare/main...architsch:<repo>:<branch>?expand=1` link; and
    Copilot fills in the commit message by itself, so where AI-written pull requests are refused he
    replaces it with his own words.
- **One invited suggestion to a curator, rarely.** Only a curator whose own page invites suggestions,
  only for a post that fits what they publish, at most one per run, never twice for the same post, and no
  follow-up unless they reply. The email says who he is, the post's title and its bare link, and his own
  one-line description, and claims nothing more. It keeps the "say it once, in ordinary words" rules of
  [`../../writing-style.md`](../../writing-style.md) but not that page's advertising voice, which is the
  game's: a note to an editor about an essay is plain. Create it as a draft in his Gmail through the Gmail
  connector, show it in full, and send it only on his word in this run.
- **A cross-post draft**, only once he has made a dev.to API key and stored it at
  `~/.config/thingspool/devto-api-key` (never print it). `POST https://dev.to/api/articles` with
  `published: false`, `canonical_url` set to the post, the essay as Markdown with absolute image URLs, and
  at most four tags. He reads it there and publishes it himself. Its philosophy readers are few, so offer
  it rather than push it.

## Step 4 — Hand over (lane B)

Pick two or three venues from the registry that fit this post, not ten. Re-read each one's rules page
today. Reddit cannot be read from here, and mirrors of it are a way around its bot checks, so say that he
must read the rules himself. Then give him, per venue:

- exactly where (channel, category or thread) and what account, fee or wait it needs;
- the rule lines that bear on this post, quoted, including any rule on machine-written text;
- the form the venue expects: a summary comment, one complete message, the page's own title;
- the link: tagged `?ref=<venue-slug>` (`a-z`, `0-9`, `-`, `_`, at most 32 characters, matching the
  ledger row) where the venue hides where visitors came from (Slack, Discord, email, and any site whose
  outbound links carry `rel="noreferrer"`, as The Motte's do); bare wherever Analytics sees the referrer
  anyway (Hacker News, Reddit, MetaFilter, Discourse forums such as intfiction.org);
- what to expect, from the registry's evidence.

The words of his post are his. When he asks for an introduction, prepare it as
[`introductions.md`](introductions.md) says, which holds each venue's form. The venue's rule on
machine-written text decides how much is drafted: a draft he rewrites in his own words (The Motte,
intfiction.org), only his own sentences quoted from the post (r/philosophy, which bans AI-assisted
material), or only the submission's fields (Hacker News, which bans generated text in posts and comments
alike; help him there by finding live threads he has firsthand experience for, never by suggesting what
to say).

## Lane C — never

- Create accounts, sign in as him, or post, comment or vote anywhere as though the assistant were him.
- Post through his browser on LinkedIn, X or any site whose terms bar automation.
- Get around a site's bot checks: no CAPTCHAs, and no mirrors or proxies of a site that blocks fetching.
- Send the same text to many places, or a second message to a curator who has not answered.
- Write or change his essays, their titles or their subjects.

## Step 5 — Record

One ledger row per action, at the moment it happens: date, post, venue, lane (`alone` or `him`), what
was sent or the tag used, status (`prepared` · `sent` · `listed` · `posted` · `rejected` · `removed`),
and the result, filled in later. A `prepared` row stays prepared until he says it went out.

## Step 6 — Measure, on the next run

- Replies: open each live post, thread or email he reports, and note the count and anything
  substantive. A real reply is the result this skill exists for; a page view is not.
- Visits: in Google Analytics, Engagement > Pages and screens by "Page path + query string" shows each
  `?ref=` tag, and Acquisition > Traffic acquisition shows referrers such as Hacker News and Reddit.
- Listings: confirm the feed appears in Kagi's `smallweb.txt` once the pull request merges, and on
  indieblog.page.
- Write outcomes into the ledger, including "nothing came of it".

## Step 7 — Report

What was done alone, with links; what is prepared for him, inline per venue; what needs his decision;
what the registry learned (checked, new, dead); and what was not done, and why. Keep "prepared" and
"sent" apart, and report a rejection or a removal as exactly that.
