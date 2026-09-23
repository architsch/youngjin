# Venue Registry

What is currently known about each place ThingsPool could be published or promoted. Every entry
carries a **Verified** date. Entries stamped more than a couple of months ago are hypotheses, not
facts — step 3 of the skill re-fetches the venue's own rules page before the venue is used.

Entries marked **Unverified** were written from general knowledge and have never been checked
against the venue itself. Treat their mechanics as a lead to confirm, not as instructions to follow.

**Mechanics** is also where a verified entry records what images the venue asks for — how many, at
what dimensions or aspect ratio, in what format, and which one becomes the thumbnail. That is what a
kit's image brief is built from, and the user takes the screenshots to it.

> **Reddit's rules cannot be read by the assistant.** Verified 2026-08-22: `old.reddit.com` now
> answers "accounts are required to access old Reddit", the modern rules page renders its rules only
> after sign-in, and the `.json` endpoints return an app shell to non-browser clients. A headless
> browser reaches the page and finds the rules table empty. Re-checked 2026-09-24: WebFetch now
> refuses `reddit.com` outright. Signing in would be Lane C, so **every
> Reddit entry below is permanently unverifiable from here.** That does not rule the venues out — it
> moves one step to the user. A Reddit kit must carry "read the subreddit's rules yourself before
> posting" as a required action in the handover, not as a footnote, and must say which rules it is
> guessing at.

Three lanes, in the order they are worked:

1. **Link-out** — accepts a plain link to `https://app.thingspool.net`. Preferred.
2. **Embed** — hosts an uploaded build inside an iframe on its own domain. Blocked on the auth-cookie
   prerequisite in SKILL.md until that is resolved.
3. **Dead** — closed or not worth researching again. Kept so no future run re-discovers them.

## Destination at a glance

Which link each venue should carry, decided by the rules in SKILL.md. Where a venue takes a dev-log
post, it becomes a **repeatable** channel — a new post is a new reason to return.

| Venue | Link to | Repeatable |
|---|---|---|
| r/WebGames, r/iogames, r/playmygame | The app | No — one link, once |
| Hacker News, Show HN | The app | No — Show HN is for something people can play with |
| Hacker News, ordinary submission | A dev-log post | Yes, sparingly |
| Three.js forum — Showcase | The app, from a post with its own text and images | Once as a thread; later news as replies in it |
| r/threejs, r/webgl, r/proceduralgeneration | A dev-log post | Yes, per feature |
| r/gamedev Screenshot Saturday | A dev-log post | Yes, weekly |
| dev.to | A full article on dev.to itself — link-only posts are banned | Yes, per feature |
| Lobsters | A dev-log post | Yes, sparingly |
| Discord showcase channels | Either | Yes, per feature |
| itch.io, portals, directories | The app / the build | No — a listing, not a post |
| The user's own social feeds | A dev-log post | Yes, per feature |

---

## Lane 1 — Link-out venues

### r/WebGames
- **Fit:** High. Community explicitly for browser games, curated against aggregator spam, and its
  readers arrive expecting to click something and play it in the tab they are already in.
- **Mechanics:** A link post from the user's own account.
- **Rules and gotchas:** Read the subreddit's current rules before posting — self-promotion limits
  and required post formatting are the usual constraints, and moderators here are active. A history
  of ordinary participation on the account matters more than in most places.
- **Effort:** Low. **Verified:** 2026-08-22 (existence and character of the community; posting rules
  not yet read in full).

### Hacker News — Show HN
- **Fit:** High, but for a different audience than the rest of this file. The draw is not "a game" —
  it is a browser-based 3D multiplayer world with a custom voxel engine, custom physics and no
  install step, whose source is public. That is a Show HN story.
- **Mechanics:** One submission: a URL plus a title beginning `Show HN:`. The explanation goes in a
  comment the author leaves immediately afterwards, not in the submission.
- **Rules and gotchas:** The work must be something people can **try right now**, with signup
  barriers minimized — the guest-first account is exactly what this asks for. Articles and blog
  posts are explicitly excluded, which is why this venue takes the app and not a dev-log post; a
  post would be an ordinary submission instead. Titles must not editorialize, use uppercase or
  exclamation points. The author is expected to be present in the comments for the first several
  hours, which is the venue's real cost. Never solicit upvotes.
- **Known objection to prepare for:** the licence split. Resolved 2026-08-22 — the code is
  Apache-2.0, while the essays and artwork under `public/` stay all rights reserved
  (`LICENSE-CONTENT.md`). "Open source" is accurate for the code and should be said that way, not
  as a claim about the whole repository. Expect somebody to ask why the repo is not wholly open.
- **Effort:** Low to prepare, high to attend. **Verified:** 2026-09-24 (showhn.html: still asks for
  something people can try "ideally without barriers such as signups or emails"; excludes blog
  posts, sign-up pages, landing pages and quick one-offs).
- **Kit prepared:** 2026-08-22, `temp/distribution/hn-show/`. Not posted. It was written before
  lights, sky and fog, labels and resizable objects shipped, so rebuild it before using it.

### r/iogames
- **Fit:** Good. Audience is specifically browser multiplayer.
- **Mechanics:** Link post.
- **Rules and gotchas:** Not yet read. **Unverified.**

### r/playmygame, r/IndieGaming, r/IndieDev
- **Fit:** r/playmygame is players asking for games to try, which suits the app link. r/IndieGaming
  is player-facing and r/IndieDev is devlog culture, so the latter suits a dev-log post.
- **Rules and gotchas:** Not yet read. Named by several 2026 indie-marketing guides, which also say
  short gameplay clips beat text posts on Reddit. **Unverified.**

### Three.js forum — Showcase
- **Fit:** High for the technical audience, and the only Three.js venue whose rules can be read from
  here. Games are posted there regularly. **Projects posted there are considered for the
  threejs.org homepage**, which lists featured projects and is updated "a couple of times a year".
  threejs.org's own "submit project" link points at this category.
- **Mechanics:** A topic in `discourse.threejs.org/c/showcase`, from the user's own forum account,
  with its own text and images and a link to the project.
- **Rules and gotchas:** Every showcase post waits for moderator approval, usually a couple of
  hours. Only your own work. New accounts get stricter automatic moderation on long posts and posts
  with several links, and it relaxes after a few days of ordinary use. So sign up and take part a
  little before posting, and keep the post to one or two links.
- **Image sizes:** Not specified.
- **Effort:** Low. **Verified:** 2026-09-24 (the category description and forum FAQ, and the
  threejs.org homepage).

### r/threejs, r/webgl
- **Fit:** Good for the technical story; small but genuinely interested, and the kind of readers who
  look at a custom renderer and go and try it.
- **Mechanics:** Link or image post, usually paired with something about how it was built.
- **Rules and gotchas:** Not yet read. **Unverified.**

### r/gamedev — Screenshot Saturday
- **Fit:** Moderate. Developer audience rather than player audience, so it converts to attention and
  feedback more than to retained players. Recurring, which makes it a durable channel rather than a
  one-shot.
- **Mechanics:** Image post inside the weekly thread.
- **Rules and gotchas:** Posting outside the designated thread is removed. **Unverified.**

### r/proceduralgeneration, r/InternetIsBeautiful, r/SideProject
- **Fit:** Moderate and situational — each wants a specific angle (the room generator, the
  no-install novelty, the solo-built project respectively).
- **Rules and gotchas:** r/InternetIsBeautiful in particular has strict submission rules and removes
  a lot. Read them first. **Unverified.**

### itch.io
- **Fit:** Good audience, and free. Sits awkwardly across the two lanes, which is the important
  thing to know about it.
- **Mechanics:** A project page. A page that is *primarily an outbound link* is permitted but is
  excluded from itch's search and browse — which removes most of the reason to be there. Getting the
  "playable in browser" treatment and the discovery that comes with it requires uploading an actual
  HTML5 build, which puts it in the embed lane and under the cookie prerequisite.
- **Rules and gotchas:** itch tightened its policies on link-forwarding pages in response to malware
  distribution; do not plan around a redirect trick. A page still has value as a landing presence
  even unindexed, and jams can be entered with it. The quality guidelines say "avoid only uploading
  keys or links to other stores", and staff answers on the support forum say a page must be
  purchasable, downloadable or playable in the browser to be indexed.
- **Effort:** Low for a link page, medium for a real build. **Verified:** 2026-09-24.

### Discord communities (Three.js, indie gamedev, web gamedev)
- **Fit:** Good, and repeatable in a way one-shot submissions are not.
- **Mechanics:** Sharing in the appropriate showcase channel, from the user's account.
- **Rules and gotchas:** Nearly all such servers restrict self-promotion to a named channel and
  expect participation first. The official Three.js server is `discord.gg/56GBJwAnUS`, linked from
  threejs.org. Its channels cannot be read without joining. **Unverified** beyond that. Identifying
  two more worth joining is a good task for an early run.

### dev.to
- **Fit:** Moderate. The technical and open-source angle again.
- **Rules and gotchas:** "Posts must contain substantial content — they may not merely reference an
  external link that contains the full post", and content "designed primarily for the purposes of
  promotion" is removable. So this venue takes a real article about how something was built,
  published on dev.to itself, with the link to the app or post inside it. That article is new
  writing, so it waits on the user rather than being lifted from a dev-log post.
- **Verified:** 2026-09-24 (dev.to/terms, content policy).

### Lobsters
- **Fit:** Moderate, technical.
- **Rules and gotchas:** Invite-only. New accounts are marked for their first 70 days and cannot
  use the `show` tag or submit new domains freely. Self-promotion should stay under a quarter of an
  account's stories and comments. Not usable until the user has an invite and some history there.
- **Verified:** 2026-09-24 (lobste.rs/about).

### Product Hunt
- **Fit:** Moderate, and effectively one-shot. It rewards a prepared launch day, so do not spend it
  casually.
- **Mechanics:** Posted from a personal account; company accounts cannot post.
- **Image sizes:** Thumbnail 240×240 (square; GIF allowed under 3MB). Gallery 1270×760, and at least
  two images before it shows. Video only as a YouTube link.
- **Verified:** 2026-09-24 (help.producthunt.com, "How to post a product"). Relaunch rules not
  read.

### Short-form video — YouTube Shorts, TikTok, Reels
- **Fit:** Unknown for this game, but the 2026 indie-marketing guides agree it is the strongest
  free discovery channel, and a room being lit, fogged and built reads well in a few seconds of
  footage.
- **Mechanics:** The user records and posts, as with every image. A clip can also sit in a Reddit
  or Three.js post.
- **Rules and gotchas:** The guides say it takes a steady habit of several clips a week, not a
  single post. **Unverified** for this project.

### The user's own feeds — LinkedIn, Facebook, X, Medium
- **Fit:** Low for finding new players, and this is worth stating plainly rather than rediscovering:
  nobody on a professional or social feed is looking for a game to play in the next minute, so the
  conversion from these is poor and will stay poor. That is an audience-intent problem, not a
  content problem, and better writing does not fix it.
- **But they are not worthless.** They cost nothing, the dev-log posts are already written for them,
  they compound slowly with people who know the user, and they are the one channel that carries
  every release rather than one link once.
- **Mechanics:** The user pastes a dev-log post's text and attaches its screenshots by hand. The
  `devlog-post` skill's character budget exists for this.
- **Rules and gotchas:** Treat these as the baseline the other venues are measured against, never as
  the push itself. A run that reports "posted to LinkedIn" as its distribution work has not done
  any.
- **Effort:** Already happening. **Verified:** 2026-08-22.

### Directory and list placements
- **Fit:** Low individually, but they accumulate, they are permanent, and they are pure link-out.
- **Candidates:** GitHub topics on the repository itself, `awesome-*` list pull requests (awesome
  webgl, awesome threejs, awesome gamedev), AlternativeTo, browser-game directory sites.
- **Rules and gotchas:** Awesome-list maintainers reject entries that do not meet a quality bar; read
  the list's contribution guide. **Unverified.**
- **iogames.space:** There is no submission form. Its "feature your game" page says to contact the
  site, and its paid feature tokens are "not currently available". The site favors competitive
  pick-up-and-play games, which a sandbox is not. Low fit. **Verified:** 2026-09-24.

---

## Lane 2 — Embed / upload portals

**All entries here are blocked on the `sameSite: "lax"` auth-cookie prerequisite in SKILL.md.**
Confirm that has been resolved before preparing any submission in this lane.

### CrazyGames
- **Fit:** High, and architecturally the closest match of any portal. It hosts only the game files
  and expects the developer to run their own multiplayer backend — which is exactly this project's
  VPS arrangement.
- **Mechanics:** Developer portal submission. Two-stage launch: a basic launch on a small test
  cohort, then full launch if playtime and retention hold up.
- **Limits:** Initial download 50MB or less; total build 250MB or less (50MB if the SDK is not
  integrated); under 1,500 files.
- **Rules and gotchas:** Non-exclusive — publishing here does not block Poki, itch, Steam or
  anywhere else. Provides a JWT the game can pass to its own backend for auth, verified against a
  published public key, which is a plausible route around the cookie problem for this lane
  specifically. The launch gate is measured on retention, so the first ten seconds decide it.
- **Accounts:** Even Basic Launch requires "no external login options", so the Google sign-up
  would have to be hidden inside the embed. Full Launch requires progress tied to the CrazyGames
  account, its username and avatar, and automatic login. That is an account integration, not a
  config change.
- **Image sizes:** Three covers — 1920×1080, 800×1200 and 800×800 — consistent with each other. No
  border, no text but the game's title (which should be on the cover), no store logos, and no
  "New" or "Play" labels. The docs discourage a bare gameplay screenshot, so a cover is a designed
  image. Format and file size are not specified.
- **Verified:** 2026-09-24 (docs.crazygames.com, requirements and game covers).

### Poki
- **Fit:** High reach; the established home of browser multiplayer games. Hardest gate on this list.
- **Limits:** No fixed size is stated any more. The requirements now judge by load time: players
  leave after about ten seconds, so keep the initial download small with progressive loading. The
  client JavaScript is about 270KB compressed on a first visit (commit `c141428f`). The rest of a
  first load has not been measured.
- **Rules and gotchas:** **"Poki blocks all external requests by default"**, with limited
  exceptions. A game whose world lives on its own Socket.IO server needs one of those exceptions
  before anything else matters. Also requires incognito support (storage access wrapped in
  try/catch), and either progress saving or a clear notice that progress is not saved.
- **Verified:** 2026-09-24 (sdk.poki.com/new-requirements now redirects to
  developers.poki.com/guide/requirements-quality).

### Newgrounds, GameJolt
- **Fit:** Moderate. Smaller than the above, but engaged, and the submission effort is low once a
  build exists.
- **Rules and gotchas:** Not yet read. **Unverified.**

### Y8, Armor Games, Addicting Games
- **Fit:** Low. Listed for completeness; older portals with declining relevance to this kind of game.
- **Unverified.**

---

## Lane 3 — Dead

### Kongregate
**Closed to new submissions since 2020.** The developer portal and its upload documentation are still
online and still read as live, which is exactly why this entry exists — do not spend a run
rediscovering it. Only previously approved developers retain upload access.
**Verified:** 2026-08-22.

---

## Not yet researched

Leads worth a future survey, recorded so they are not lost: browser-game aggregator sites that accept
external links; university and hobbyist metaverse or virtual-world communities; Bluesky and
Mastodon (gamedev.place) gamedev circles; creative-coding and generative-art communities, which suit the
build-a-room framing; teacher and classroom-tool directories, which suit the shared-space framing.
