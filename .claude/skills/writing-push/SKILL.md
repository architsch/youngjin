---
name: writing-push
description: Get the user's essays and other library writing on thingspool.net in front of readers through what an assistant can do on its own, each action only after he has seen it — review where every earlier submission and listing stands and bring the ledger and the registry up to date, research new routes that reach more readers, notify search engines through IndexNow, list the site's feed in small-web directories, send one invited suggestion to a curator — and record every submission and what came of it. It gives him nothing to write or post: no Hacker News, Reddit, forum, Slack or LinkedIn posts. Use when asked to promote, advertise, share or spread a blog post, essay or library writing, or after a new essay is published. For the game itself, use distribution-push.
---

# Writing Push

The user publishes essays and other writing in the library on `thingspool.net`, a GitHub Pages site built
from `public/`. This skill gets a published post in front of readers through what the assistant can do
itself. His part is a yes or no to each action and, where a route needs it, a one-time setup. It never
writes, edits, titles or chooses the subject of his writing, and it does not promote the game: that is
`distribution-push`.

## Scope

The rooms where readers talk about essays (Hacker News, Reddit, MetaFilter, forums, community Slacks,
LinkedIn) need his account and, under most of their rules, his own words. Writing those posts isn't worth
his time, so this skill neither suggests nor prepares any: no venue, draft, title or checklist for him to
post.

What it does is quieter. It makes the post findable (search engines, and small-web directories that
follow the feed) and makes the few requests that venues invite by email or API. Say so plainly whenever
he asks what was reached, and never present a listing as reach it hasn't shown.

## Where things live

- `temp/writings-strategy/VENUES.md`: the registry. This skill takes only its "Routes the assistant can
  take alone", each with the date it was checked; the venues above them are background.
- `temp/writings-strategy/ledger.md`: every submission and listing, and what came of it. It is history,
  not instructions: never rewrite or delete a row.
- `temp/writings-strategy/STRATEGY.md` and the dated research folders beside it: background only.

`temp/` is gitignored, so these stay private, and names of individual people go there, never into
`.claude/`. If a file is missing, recreate it from this page rather than guessing what it held.

## Step 1 — Review where everything stands, and sync it

The most damaging act available here is sending the same link to the same place twice: it reads as spam,
and the penalty falls on his name and his domain. From the ledger, work out what was done once per site
(directory listings, the IndexNow key), what was done for this post, and what is still waiting on a reply
or a merge.

A row says what was true when it was written. Check every row whose result is still open, at the venue
itself:

- A pull request or an issue: its state and any reply (`gh`).
- A listing: the directory's own page or export (the feed in Kagi's `smallweb.txt`, the site on
  indieblog.page, and so on). One listed earlier may also have gone.
- A curator's reply: his Gmail, searched only for that curator's address.
- Visits, when he asks how many came: Google Analytics' Acquisition > Traffic acquisition shows referrers
  such as Bing or Kagi.

Then sync:

- Write what each check found into its row's result, dated, after what is there, "nothing came of it"
  included, and move the status only to what the venue now shows.
- A library post published or changed since its last IndexNow row is one to ping: compare the
  `<updated>` dates in `public/feed.atom` with the ledger, and add those posts to step 4's list.
- In `VENUES.md`, restamp each route checked. One that has closed or changed its rules is marked so, with
  the date and why, never deleted.

## Step 2 — The post

- Take the post the user names, or else the newest library entries in `public/feed.atom` (its entries
  are not in date order: sort by `<updated>`). Dev logs belong to `distribution-push` unless he asks.
- Read the post: its title, its meta description (his own one-line summary), its opening and its
  figures. Matching a post to a curator needs what it actually argues.
- Check it is ready to be seen. The page answers `200`; `og:title`, `og:description`, `og:image` and the
  canonical link are present, and the image loads; a series volume links to its neighbors and to the
  series list; the feed carries it. A failure is a finding for him, not something this skill fixes.

## Step 3 — Look for new routes

The routes in `VENUES.md` are the ones earlier runs found. Every run, look for more, aiming at readers
they don't reach yet:

- directories, webrings and feed catalogs that take a feed or a site by pull request, issue, API or open
  form;
- search engines with a submission route of their own;
- curators, newsletters and link roundups whose own page invites suggestions, on subjects the post's
  argument fits.

Check each against its own rules page, then write it into `VENUES.md` with the date, whatever the verdict:
under "Routes the assistant can take alone" if it is one, or else with what rules it out. A route rules
itself out when it needs more of him than a yes or a single step (his own post, his words, an account to
keep up), needs a login or a CAPTCHA, or bars self-promotion or AI-made pull requests. Notes go in a dated
folder beside the earlier ones (`temp/writings-strategy/venues-<date>/`), and a curator's name stays in
`temp/`. A route that fits joins step 4's list. Finding nothing new is a result too, and is reported.

## Step 4 — Propose, then act on his word

Propose this run's actions as one list, then act on his word. Nothing goes out unseen, and approval for
one run does not carry to the next.

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
    rule for self-submissions). He picks the two from candidates this skill finds. Its other rules:
    English, a personal single-author blog, a post within the last year, no popups, and no LLM-generated
    content (heavier LLM use must be acknowledged on the site; help at the level of a spell checker is
    fine). Keep the file sorted; push the branch to his fork over SSH
    (`git@github.com:architsch/<repo>.git`), as HTTPS pushes fail on this machine.
  - indieblog.page: one POST of the feed URL to `https://indieblog.page/suggest` (field `suggest`; the
    hidden `title` field is a honeypot and stays empty).
  - Marginalia Search: an issue in `MarginaliaSearch/submit-site-to-marginalia-search`.
  - Left out: personalsit.es, whose maintainer closes AI-made pull requests, and ooh.directory, whose
    form has a CAPTCHA.
  - The registry's further lists and directories, each once per site, as its row says. Skip any form
    that needs a login or shows a CAPTCHA, and any list whose rules bar self-promotion or AI-made pull
    requests.
- **His one-step routes**, such as a bridge that makes the site a fediverse account: hand him the link
  and the step, once. The assistant never creates an account for him.
- **One invited suggestion to a curator, rarely.** Only a curator whose own page invites suggestions,
  only for a post that fits what they publish, at most one per run, never twice for the same post, and no
  follow-up unless they reply. The email says who he is, the post's title and its bare link, and his own
  one-line description, and claims nothing more. It keeps the "say it once, in ordinary words" rules of
  [`../../writing-style.md`](../../writing-style.md) but not that page's advertising voice, which is the
  game's: a note to an editor about an essay is plain. Create it as a draft in his Gmail through the Gmail
  connector, show it in full, and send it only on his word in this run. The connector stores every link in
  a draft as a google.com redirect that expires within a day, so before sending, retype the link in
  Gmail's own compose window (Claude in Chrome), check the draft now holds it bare, and send from there.

## Never

- Create accounts, sign in as him, or post, comment or vote anywhere as though the assistant were him.
- Post through his browser on LinkedIn, X or any site whose terms bar automation.
- Get around a site's bot checks: no CAPTCHAs, and no mirrors or proxies of a site that blocks fetching.
- Send the same text to many places, or a second message to a curator who has not answered.
- Write or change his essays, their titles or their subjects.

## Step 5 — Record

One ledger row per action, at the moment it happens: date, post, venue, lane (`alone`, or `him` where he
did it himself), what was sent, status (`prepared` · `sent` · `listed` · `posted` · `rejected` ·
`removed`), and the result, filled in on a later run (step 1). A `prepared` row, such as an email or a
draft waiting for his word, stays prepared until it goes out.

## Step 6 — Report

What was done, with links; what waits for his word; where earlier rows now stand (step 1); what the
registry learned (checked, newly found by step 3's search or that it found none, dead); and what was not
done, and why. Keep "prepared" and "sent" apart, and report a
rejection or a removal as exactly that.
