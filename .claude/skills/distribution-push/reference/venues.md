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
> refuses `reddit.com` outright. Re-checked 2026-10-28: Claude in Chrome refuses it too ("not allowed due to
> safety restrictions"), even with the user signed in. Signing in would be Lane C, so **every
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
| DEAD.ARMY | The app | No — a listing; its playtest reports are the only repeat traffic |
| The Colony — Get Reviewed | The manual, with the app beside it | Yes, as a follow-up when something changes |
| Moltbook, from the user's own agent | The manual, and a room the agent built | Yes, sparingly |
| MCP and connector directories | The MCP endpoint | No — a listing, not a post |
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
- **No generated text.** newsguidelines.html now says "Please don't put generated text in HN posts"
  and "Don't post generated text or AI-edited text". So an HN kit carries the rules, the facts and the
  angle as notes, and **never a title or comment to paste**: the user writes both in their own words.
- **Effort:** Low to prepare, high to attend. **Verified:** 2026-10-20 (showhn.html: still asks for
  something people can try "ideally without barriers such as signups or emails"; excludes blog
  posts, sign-up pages, landing pages, quickly generated one-offs and minor updates;
  newsguidelines.html: the generated-text rule above).
- **Kit prepared:** 2026-08-22, `temp/distribution/hn-show/`. Not posted. Rebuilt 2026-10-20 for the
  AI-agents launch, as notes rather than copy (see above). **Dropped 2026-11-08:** it needs his own words and his
  presence for hours, and he works only venues where his part is a yes.

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

### DEAD.ARMY
- **Fit:** Right kind of venue, very little reach. A curated catalog of creator-hosted web projects ("Independent
  web projects. Lasting links."), in its "extremely early stage": 46 of 100 founding projects on 2026-10-28.
  ThingsPool has been listed since 2026-09-02 (see the ledger) and drew 3 views and 0 launches in ten weeks (still so
  on 2026-11-08, after the 10-28 refresh went live), and none of the 46 projects had a playtest report (10-28).
- **Mechanics:** a project page that opens the creator's own HTTPS page in a new tab, never an iframe, so it sits in
  the link-out lane. Fields: title, tagline, description, type (Game, App, Prototype; the catalog has a tab for
  each), category, content rating, tags, project URL, cover artwork, preview media. Review within two business days.
  Members file structured playtest reports (minutes played, device, what worked, what broke), the playtest page
  lists the projects with the fewest reports first, and anyone with an account may file one, developers included.
  A "Listed on DEAD.ARMY" badge exists for a README.
- **Rules and gotchas:** HTTPS with no mixed content; only your own work; "accurate project details". A changed
  destination can send a listing to security review. Its availability checker poses as an ordinary browser
  (2026-09-22 update), so each check of the app probably counts as a `direct` arrival.
- **Public page vs dashboard:** on 2026-11-08 the public page showed "Destination check: Needs review" beside "Alive",
  while the owner's dashboard showed nothing needing attention or in review. Read the dashboard before acting on it.
  By 2026-11-11 the public page read "HTTPS · Destination checked Nov 9, 2026".
- **Effort:** Low. **Verified:** 2026-10-28 (the For Devs, Playtest and Updates pages, and the user's dashboard);
  the listing and dashboard re-read 2026-11-08; the public page re-read 2026-11-11 (the 11-08 refresh approved, still
  no playtest report).

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
- **Mechanics:** The user pastes a dev-log post's text and attaches its screenshots by hand.
- **Rules and gotchas:** Treat these as the baseline the other venues are measured against, never as
  the push itself. A run that reports "posted to LinkedIn" as its distribution work has not done
  any.
- **Effort:** Already happening. **Verified:** 2026-08-22.

### MCP server directories (the AI-agents angle)
Where people who run agents look for servers to connect them to. They list the MCP endpoint
(`https://app.thingspool.net/mcp`), not a page, so no `?ref=` tag applies: an agent says where it heard
of ThingsPool itself when it registers, if it does (see SKILL.md, "Measure agents apart").

**What they deliver, measured 2026-10-24:** machines, not operators. In the five days after the listings
went up, `/mcp` took 4,449 requests, nearly all from about 40 crawlers, liveness probes and scanners;
the only agents that registered were automated test runs (see the ledger). ClawHub counted 208
downloads and 0 installs, and GitHub saw no referral from any listing. Re-measured 2026-10-28, eight
days on: the same (296 downloads, 0 installs; the one real agent came from The Colony's post). Re-measured
2026-11-08, nineteen days on: ClawHub 465 downloads and 0 installs; Claude's directory 5 accounts tried, 3
connected, 0 used a tool; the only new agent was the same automated tester under a new name. Re-measured 2026-11-11: ClawHub 541 downloads
and 0 installs, and one agent that looks run by someone (ref "openclaw", 11-09), with nothing saying which listing
sent it. Keep the listings current, since they cost little, but never count one as distribution. Claude's
Connectors Directory is the exception to watch: people browse it inside Claude, and Claude can
suggest from it.

- **Official MCP Registry** (registry.modelcontextprotocol.io): published 2026-10-20 as
  `net.thingspool/thingspool` 1.0.0 from `server.json`, with `mcp-publisher` signed in by the
  thingspool.net DNS key. Several directories below copy from it, so it is the one to keep current.
- **Glama** (glama.ai/mcp/connectors): imports registry entries by itself. ThingsPool appeared at
  `glama.ai/mcp/connectors/net.thingspool/thingspool` within the hour, "Healthy", with all 25 tools and a
  tool-quality score being calculated. The owner may "claim ownership" by verifying the domain or a
  GitHub account, which adds control over the page; nothing else is needed. **Verified:** 2026-10-20.
  Re-read 2026-11-08: Healthy, 100% uptime over 20 days, re-tested daily, TDQS A (3.5/5) across 32 tools, filed
  under Art & Culture, Entertainment & Media and Games & Gamification. It re-tests and re-scores a new version on its
  own within the hour, so Test Connection is rarely needed. Still so 2026-11-11 (last tested that morning).
- **PulseMCP** (pulsemcp.com/submit): "We are not accepting new MCP server or client submissions right
  now." It says to publish to the official registry first, and that "we will pick it up automatically
  once we are back". No date given. **Verified:** 2026-10-20. Still paused 2026-10-24 ("New server
  submissions and listing changes are still paused", updated 2026-09-03), and its newsletter, now The
  Agentic Loop, last went out 2026-05-20. Still paused 2026-11-08 (search finds no ThingsPool). On 2026-11-11 it refused automated reads (403), and his
  Chrome extension doesn't allow the domain, so it went unchecked that day.
- **mcp.so** (mcp.so/submit): **free, through a review queue.** The submit page's button reads as
  paid, but a submission made from a signed-in account is "Queued for review" for free; $39 only
  skips the queue ("Skip review — go live now", with a "Verified" badge and featured placement).
  ThingsPool goes in as a **Remote Server** (`?type=remote-server`: endpoint URL and name), filed
  under Remote Servers ("hosted MCP endpoints ... connect directly, no install required"). The plain
  MCP Server type wants a repository and presents a program to install and run, and ThingsPool's
  repository would only give a visitor an empty world of their own. **Category** is a separate field
  with no games category, and "Other" holds over half of all servers; "AI & Agents" ("LLMs, AI
  assistants, chatbot integrations, and agent servers") fits best. After submitting, the listing's own form asks for: name, author name, avatar, a short description,
  category, tags, GitHub, website and docs URLs, listing type, the remote endpoint URL, the
  authentication it uses ("API Key" or "None"), a client configuration snippet, up to 6 screenshots,
  and an overview in Markdown. Its tools section reads "No tools detected" until someone presses
  "Fetch tools" on the listing, which asks mcp.so's own server to call the endpoint (so the browser's
  cross-site rules don't apply). That only works once the listing is published: on a submission still
  queued for review, the button answers "Server not found" (2026-10-20), whatever the authentication
  setting. A third-party collector tool posts to an undocumented mcp.so API; it goes around the
  site's own form, so it is not a path to use. **Verified:** 2026-10-20 (by the user's own
  submission); types and categories 2026-10-22.
  **The free queue is not first come, first served** (2026-11-08): a sweep around 11-05 put 23 free remote servers
  live (on `/remote-servers?sort=latest`, those without the Verified tag; `&tag=verified` filters to the paid ones),
  and passed over ThingsPool, queued since 10-20. Listings now live at `/servers/<slug>`, and the list pages render in
  the browser, so read them there rather than with curl. Still 404 on 2026-11-11.
- **Smithery: dead since 2026-10-31.** It became part of Arcade and shut down its proxy (`server.smithery.ai`,
  run.tools), accounts, API keys, CLI and SDKs; what remains is a curated, non-proxied registry of about 214 servers
  with no way to publish (`/new` and `/docs` answer 404). Its relay, which would have put every user behind one
  address, went with it. **Verified:** 2026-11-08.
- **ClawHub** (clawhub.ai; 465 downloads, 0 installs, 0 stars on 2026-11-08): the manual's MIT-0 copy, published 2026-10-20 as `thingspool` 1.1.0 with
  `npx clawhub@0.23.3` after the user's `login`. The scan's verdict was "clean", but ClawHub still held it
  as "pending publication" (hidden) an hour later, 19:41 to 20:39 KST: its own review. Its page will be
  `clawhub.ai/architsch/thingspool`. **Search** (2026-10-24, `clawhub search`): found for "sandbox
  world" and its name, not for "game", "3D sandbox", "virtual world", "multiplayer game" or "build with
  blocks". OpenClaw's bundled clawhub skill tells agents to prefer searching for *plugins*, and a bundle
  plugin can carry a streamable-http MCP config (docs.openclaw.ai/plugins/bundles). **Featured** is 16
  slots picked by 30-day installs with a maintainer's approval, and "not taking requests" (a maintainer,
  2026-06-15); **trending** ranks the last 24 UTC hours of installs.
- **Claude's Connectors Directory: ThingsPool listed 2026-10-28** (https://claude.ai/directory/thingspool),
  published about 30 minutes after submission. Track it in the portal's Usage tab: rank, health, accounts
  that connected or used a tool, tool calls and error rate, a day behind. On 2026-11-08: rank #7,252 (#6,732 on
  11-04), 5 accounts tried, 3 connected, 0 used a tool in 30 days. People who connect don't go on to ask Claude to
  play: the sign-in hands them straight back to Claude, with nothing saying what to ask. Built 2026-11-08, live once
  deployed: the sign-in page now says what to ask, and the endpoint (1.6.0) offers a "Visit ThingsPool" prompt.
  Watch "Used a tool" after that (still 0 on 2026-11-11, rank #7,572; the daily chart runs two to three days behind).
  Until 2026-11-08 an agent that never built was deleted after a day, and its
  host's connector then asked to sign in again (both of the user's own did); that day he had agents kept for good,
  so a directory user's connector stays signed in. Whether Claude's "+" menu shows a server's prompts is still
  unverified: check it with a connector that is signed in.
  (claude.ai/directory/manage → Submit new → MCP connector; needs a
  paid Claude plan): the one listing a chat can recommend by itself (Suggested Connectors, ranked by
  usage); the MCP Registry does not put a server in Claude. Requires a `title` and `readOnlyHint` or
  `destructiveHint` on every tool, OAuth for an authenticated service (none is allowed, and "required
  when the server asks" lets sign-in come later), a docs URL, privacy policy, support contact, icon, a
  reviewer test account and at least 3 example prompts. No games category; "Media & entertainment" is
  the nearest. **No longer blocked** (2026-10-28): every tool has a `title` and a hint, OAuth
  sign-in exists (`/mcp/oauth`, checked with a claude.ai custom connector on 2026-10-25), and with
  OAuth the registering happens in the operator's browser, not from Anthropic's addresses. After an
  automated policy scan a submission is listed as a **Community** connector "with no action from
  you"; listings judged highly useful may be escalated to Verified review. Listing: name 100
  characters, one-liner 200, description 2,000, one to five categories, a permanent slug; test
  credentials "for a fully populated account". Two policy lines to weigh against the server's
  instructions: "must not direct Claude to dynamically pull behavioral instructions from external
  sources" (they point at skill.md, which carries manners) and no promotion (they ask for a daily
  visit). Claude's later requests still come from Anthropic's addresses, under the per-address caps.
  The portal itself (walked 2026-10-28) differs from the docs in one place: it flags every tool
  without `annotations.title`, even one with the top-level `title`, so the endpoint sends both (1.4.2).
  Its steps: connection (pick a connector already signed in), tools, listing (categories: Productivity,
  Communication, Data & Analytics, Development tools, Financial Services, Consumer Health, Health &
  Life Sciences, Media & Entertainment, Commerce & Shopping, Legal, Sales and marketing, Creative,
  Nonprofit, Education, Travel, Other; icon defaults to the server address's favicon), three use cases
  with prompts, company, authentication (detected), data handling, test instructions plus a
  "Self-tested" box, seven policy acknowledgments, review. One acknowledgment reads "Tool descriptions
  contain no instructions about model behavior, other tools, or external instruction sources". The
  draft lives in the tab's sessionStorage, and it keeps the tool list from the first connect. After a
  server change, use the connector's ⋯ → "Refresh tools list" in Claude's settings, then reload the
  form tab, and check that step 6's OAuth client is still the detected one.
  A custom connector (one on Free) can be prefilled by link:
  `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=ThingsPool&connectorUrl=https%3A%2F%2Fapp.thingspool.net%2Fmcp`.
  **Verified:** 2026-10-28 (claude.com/docs/connectors/building/submission and review-criteria, the
  Software Directory Policy).
- **OpenAI's plugin directory** (ChatGPT and Codex; platform.openai.com/plugins → Upload → With MCP):
  identity verification, a domain token at `/.well-known/openai-apps-challenge`, 5 positive and 3
  negative test cases, a privacy policy, explicit read-only, destructive and open-world hints on every
  tool, no keys or tokens in tool responses, and content suitable for 13 to 17. A UI is optional.
  ChatGPT "can't present custom API keys", so it needs OAuth or no auth. **Verified:** 2026-10-24 (developers.openai.com plugin docs).
  Re-read 2026-11-08: OAuth no longer blocks it (dynamic registration and metadata documents are both accepted), but
  it **doesn't fit a yes-or-no-only push:** identity verification means a physical government ID, perhaps with a
  selfie; a demo video goes with the submission; the reviewer's account may not need "additional login steps, such
  as a new account sign-up" (the sign-in page names a new agent); none of the 32 tools sets `openWorldHint`; and its
  rules forbid soliciting API keys, so `register` and `new_key` would likely have to be left off what it reaches.
  It re-checks the live server daily.
- **GitHub MCP Registry** (github.com/mcp): curated by hand; once a server is onboarded, its new versions sync
  from the official registry by themselves. Since a maintainer's note of 2026-11-05 (SamMorrowDrums, in
  github/github-mcp-server discussion 1257), each request is **its own Q&A discussion** in that repository, with
  the registry record, namespace and latest version, transport and auth, repository and license, and a
  verification query ("does not … imply an ETA"). About ten requests a day; onboarding does happen (Antevo: asked
  10-18, live by 11-04). `https://api.mcp.github.com/v0.1/servers?search=thingspool` shows whether it is in (0 on
  11-08). VS Code's docs no longer say where its `@mcp` gallery comes from, so whether it follows is unverified.
  Approve-only, through his `gh`; kit at `temp/distribution/github-mcp-registry/`. **Verified:** 2026-11-08.
  **Requested 2026-11-08** (discussion #3743). No reply by 2026-11-11.
- **MCP Market** (mcpmarket.com/submit; it claims 1M+ monthly visitors): the free queue (4 to 6 weeks) and the $29
  listing take a GitHub repository, a program to install. A hosted endpoint is "a separate paid listing" (the page's
  own words), so ThingsPool's would be paid, which he declines. It lists Golemreach, an MMO for people and agents, from
  its repository. **Not for a yes-only push.** **Verified:** 2026-11-11.
- **MCP server lists on GitHub** (a pull request from his `gh`; researched 2026-11-08):
  - **TensorBlock/awesome-mcp-servers** (1,041 stars): **high.** `docs/gaming.md` already holds hosted agent
    worlds (Brontide, DrinkedIn, Agentic Kingdoms, Plazmi), each with its endpoint, auth, registry id and docs.
    Merges within a day; no Glama, star or AI rule; a merged entry also becomes a profile in its hosted MCP Index.
    Kit at `temp/distribution/tensorblock-mcp/`. **Merged 2026-11-08**, the day it was opened (PR #5542; see the
    ledger). Its MCP Index profile was live under Gaming on 2026-11-11.
  - **punkpeye/awesome-remote-mcp-servers** (2.8k stars; Gaming holds Agentic Kingdoms, Elsewhere, Plazmi,
    SpaceMolt): needs a Glama connector badge (ThingsPool's exists), an entry of name, endpoint, auth markers and
    one sentence of at most 120 characters; CI sends a keyless `initialize`, so `/mcp` reads as 🔓 ("🔓 🔐" is
    accurate). "PRs are not merged unless the account opening them has starred the repo." For agents: "add
    `🤖🤖🤖` to the end of the PR title to opt-in. Merging your PR will be fast-tracked." **Stalled:** 2 merges
    since 10-24 against 1,321 new PRs. punkpeye's main list sends remote-only servers here. Kit at
    `temp/distribution/awesome-remote-mcp/`. **Submitted 2026-11-08** (PR #4166, CI passed). Still open 2026-11-11.
  - **stacklok/toolhive-catalog** (a PR with `server.json`; small audience), mcpHQ, AIAnytime, MobinX (wants a
    stars badge), yzfly (entries in Chinese): medium to low.
  - **Low or closed:** toolsdk-mcp-registry relays every call through its gateway (one address for all its users);
    the Docker MCP Catalog takes remote and OAuth servers but rarely reviews (6 merges since 09-01 against 1,847
    PRs); Cline's marketplace wants a 400×400 PNG and vets maintainers' identity; appcypher's list is archived,
    jaw9c's dormant since 06-23; modelcontextprotocol/servers holds reference servers only; mcpserverfinder
    submits by email only; OpenTools retired its CLI for the official registry.
  - **Already carrying ThingsPool, unasked** (copied from the registry): bendyline/gilde,
    rogerchappel/mcpchangefeed, rdmgator12/awesome-claude-connectors.
- **Directory sites with a form** (researched 2026-11-08):
  - **mcpservers.org** (wong2's site; the repo takes no PRs): name, category (none for games, so Other),
    description, a link, optional registry name, a "supports remote connections" box and a required contact email;
    free, "Review within 2 weeks", or $39 for a day, a badge and a dofollow link ("DR 72"). Its remote-server pages
    list agent games (Tidewrath). Cloudflare challenges automated reads of its listing pages. Its contact email is
    his Gmail (his standing permission, 2026-11-11). Ticking the remote box adds a Remote Server URL, which the site
    fills from the registry name, and an optional authentication choice. **Verified:** 2026-11-11; kit at
    `temp/distribution/mcpservers-org/`. **Submitted 2026-11-11** (free; see the ledger).
  - **cursor.directory** (now Cursor's `cursor/community-plugins`; `/mcp/new` → `/plugins/new?type=mcp_server`):
    sign in once with GitHub or Google, then name, a description and one MCP component, logo optional,
    "Auto-reviewed by a Cursor SDK agent." Never its auto mode on youngjin: it wants a root `.mcp.json`, which
    Claude Code would also load in his sessions.
  - **LobeHub** (`lhm` CLI): a browser sign-in plus connecting GitHub, and the repo must be his;
    "Publish creates the listing immediately." Whether its cloud connects from its own addresses is unverified.
  - **mcp.directory** says it imports from the registry, but ThingsPool wasn't found there, and its form wants a
    GitHub repo. Unverified.
- **Gemini CLI extension gallery: fading.** "You don't need to submit an issue or email us"; it "crawls tagged
  repositories daily" for a public repo with the `gemini-cli-extension` topic and `gemini-extension.json` at its
  root (remote servers by `httpUrl`; OAuth discovered, dynamic registration supported). But Antigravity CLI replaced
  Gemini CLI for free, Pro and Ultra users on 2026-06-18, and the gallery's data file last changed 10-16. Installing
  clones the repo, so it would need a new small public repo of his. Low. Antigravity's own marketplace (launched
  10-29) takes partners by an intake form. **Verified:** 2026-11-08.
- **Plugin and skill directories** (researched 2026-11-08). **The game repo is too big for them:** youngjin is about
  242 MiB as an archive, 5,984 files.
  - **Anthropic's plugin directory** (claude.ai/directory/manage, shown in Claude Code's `/plugin` Discover; the
    official marketplace holds 317): **high fit**, paired with the connector listing. A plugin folder needs
    `.claude-plugin/plugin.json`, `.mcp.json` (`type: "http"`, the connector's URL), `skills/thingspool/SKILL.md`, a
    README of 40+ words and a LICENSE. The whole repo must stay under 50 MiB as an archive and 256 MiB unpacked, so
    youngjin is refused ("Repository too large to validate") and it needs a new small public repo, his decision.
    He ticks four compliance boxes himself; a person reviews each new listing.
  - **One small repo could serve them all**: `.claude-plugin/`, `.cursor-plugin/`, a root `plugin.json`,
    `gemini-extension.json` and `skills/thingspool/SKILL.md`. That is a third copy of the manual to keep in step.
  - **skills.sh:** no submission; a page appears after the first `npx skills add`. On `architsch/youngjin` that
    command finds the nine internal skills under `.claude/skills/` first and never offers ThingsPool's. The clean
    route is a file on thingspool.net, `/.well-known/agent-skills/index.json` (draft format 0.2.0: name, `type:
    "skill-md"`, the URL `/skill.md` and a sha256 that must change with every edit of the manual), after which
    `npx skills add https://thingspool.net` gives it a page. A change to the site, so his call. The CLI's own
    find-skills skill tells agents to be wary of skills under 100 installs. Medium.
  - **Lists of skills on GitHub** (researched 2026-11-11), all gated on usage ThingsPool's skill doesn't have yet:
    - **VoltAgent/awesome-openclaw-skills** (53.7k stars): links to ClawHub skills only, with a Gaming category of 26
      agent worlds and games (an agent city, agents in Minecraft, a social-deduction game). It asks for a clean scan
      (ThingsPool's is), a description of ten words or fewer, and "real community usage... Brand new skills are not
      accepted". On 10-30 it closed unmerged a clean skill with 1,484 downloads; merges come in batches (10-11,
      10-19, 10-30). **High fit once ClawHub shows installs**; ThingsPool's has 0, and a refusal would spend it.
    - **VoltAgent/awesome-agent-skills** (37k stars): skills for coding assistants, the same usage rule. Low.
    - **heilcheng/awesome-agent-skills** (6.4k stars): a public repo with a `SKILL.md`, at least 20 stars and 14
      days old; youngjin has 1 star. Not eligible.
  - **claude-plugins.dev** indexes `skills/` folders and plugin marketplaces by itself (0-star repos included);
    `dev/clawhub/` doesn't match its pattern. **claudemarketplaces.com:** a free form after a GitHub sign-in. Its
    `/mcp/<registry name>` pages (SpaceMolt's, Tokenarcade's) looked like copies of the official registry, but on
    2026-11-11 it had no page for `net.thingspool/thingspool` ("MCP Server Not Found", read in his Chrome; curl gets
    a Vercel checkpoint). Its way in is its form, behind a sign-in he made himself with GitHub on 2026-11-11. The form
    takes a type (Skill, MCP server, Marketplace), one URL (a GitHub repo, or a hosted endpoint for an MCP server) and
    an optional note. It is free ("Reviewed when there is time"), or $4 for a review within 24 hours that buys no
    listing. Listings are "ranked by real installs and refreshed from GitHub every day". **Submitted 2026-11-11** as an
    MCP server (the endpoint), never as a skill: the youngjin repo's skills are its internal ones. **SkillsMP**
    reportedly crawls repos with 2+ stars (unverified; 403). **agentskills.io** is a spec, not a directory. Low.
  - **Cursor Marketplace** (cursor.com/marketplace/publish): open source only, a `.cursor-plugin/` manifest, every
    plugin reviewed by hand; form fields unverified. **Kiro powers:** a form, mostly AWS. Low.
- **No way in:** goose retired its directory on 07-30 and reads the official registry (so ThingsPool is covered);
  Le Chat's directory is curated by Mistral; Perplexity, Windsurf, LM Studio and Raycast take servers only from
  their users. No directory of games for agents was found: League of Agents refuses connections, and OpenClawCity,
  Agent Arcade and letaiplay.games run only their own games. **Verified:** 2026-11-08.

### Agent networks and operator communities (the AI-agents angle)
Where agents post and their operators read along. Agents arrive because an operator, or a post an agent
read, sent them; the products that got real operators were posted here, or written up by the press,
not merely listed. Reddit's agent subreddits are under the Reddit warning at the top of this file.
- **The Colony — Get Reviewed** (thecolony.cc/c/reviews, "Product Review Requests"): "Ask the Colony
  agent community to review your website, application, service etc." Its API docs define the post as
  "A HUMAN inviting AI agents to review their product, site or project", so the user posts it himself
  (sign-in with GitHub, Google or X). 2,750 agents and 1,334 humans; the section has 82 posts.
  - Terms (2026-09-09): don't "Disguise advertising, sponsorship or self-promotion as independent
    content", and don't pass an agent off as a person. Authors put their tie in the title: "(affiliated)",
    "(disclosed: our own game)".
  - What drew replies: a bar for agents asked for one `GET` and blunt answers, and its owner replied to
    each and shipped fixes, so reviewers came back to recheck (20 replies). A browser MMO for agents and
    people ("join in one step, no key") drew 4, which reviewed its skill file without playing.
  - **Fit: high**, the only venue built for inviting agents to try something. **Verified:** 2026-10-24.
  - **A challenge drew words, not visits.** The build week in the `art` colony (10-28 to 11-04: a small museum in a
    room of one's own) drew five room proposals in comments, and not one agent registered with its tag or built a
    room. Agents there describe what they would do far more readily than they connect; one said its token budget was
    the reason. The review request, which asked for a visit and a report, is what brought the one real agent.
- **Moltbook** (moltbook.com): live (a new post every 30 to 40 s), Meta-owned since 2026-03-10. Only
  agents post; the human claims one with an email and a public post on X naming @moltbook. A new agent
  may post once every two hours for its first day. Rules: "Don't spam or self-promote excessively"; the
  terms forbid "unauthorized advertising". Submolts: m/builds ("Show what you made", about 2,600),
  m/openclaw-explorers (about 2,700), m/buildlogs, m/mcp, m/gaming. Link posts there have sent 1,000+
  agents to a site within a week (Zenity Labs, 2026-02). Posting is the user's own agent's act.
  **Fit: medium-high**; posts sink fast. **Verified:** 2026-10-24 (rules.md, skill.md v1.12.0). Still so on
  2026-11-08: the human verifies an email **and posts a verification tweet** (one agent per X account), so it is
  outside a yes-or-no-only push.
- **4claw** (4claw.org): agents only; its skill.md says "Avoid self-promotion of products", and no board
  suits a game. **Fit: low.** **Verified:** 2026-10-24.
- **awesome-agent-native-social** (github.com/ColonistOne/awesome-agent-native-social, kept by The
  Colony's own agent): a list of social platforms where agents are first-class users, with a "Gaming &
  Play" section (League of Agents, OpenClawCity, The Crab Games). Criteria: first-class agent accounts,
  a documented agent-facing surface, live; "Browser-only platforms don't qualify". Entry format
  `- [Name](URL) — One-line neutral description.`, alphabetical; "Self-submissions are accepted; the
  affiliation is fine, the puffery isn't." A pull request. **Fit: high, but merges have stalled**
  (2026-10-28): 2 stars, last push 10-17, eight PRs open since 10-13 (one a game, Plazmi) and none merged. A PR
  would likely sit. Cheap, but last in line. **Verified:** 2026-10-28. Still dormant 2026-11-08 (nine PRs open,
  nothing merged since 10-17).
- **OpenClaw's community:** the forum's Build & Showcase category (community.openclaw.ai; 7 topics, a
  few dozen views each; "Don't post spam"): medium. Discord (about 100k members): #showcase is for "cool
  stuff you and your agent are actually doing together… Not for shilling your skill", self-promotion has
  its own channel, crypto banned; **UNVERIFIED** (secondary source). GitHub Discussions are off on the
  OpenClaw repositories.
- **MCP community:** the official Discord is for contributors and says to avoid "Service or product
  marketing" (none). The modelcontextprotocol GitHub Discussions' "Show and tell" is quiet (low).
  mcpnewsletter.com, a weekly from the r/MCPservers team, takes submissions by form or email (medium).
  **Verified:** 2026-10-24. Re-read 2026-11-11: "A weekly brief for AI builders" (issue #006); its form (name, email,
  a link, "What should we look at and why does it matter?") is for "possible inclusion". Kit at
  `temp/distribution/mcp-newsletter/`. **Suggested 2026-11-11** ("saved it for editorial review"); a second
  suggestion only with real news behind it.
- **Product Hunt:** an "AI Agents" category with an "OpenClaw" subcategory, and "Games". Comment
  guidelines: "No LLMs or Chrome extensions please!" Image sizes are in its own entry above. **Fit:
  medium**, one-shot. **Verified:** 2026-10-24.
- **AI newsletters** (TLDR AI, The Rundown, Ben's Bites): no editorial submission route, only paid ads.
  Paid AI-tool directories (There's An AI For That, Toolify, Futurepedia) list tools, not games. **Fit:
  low.** **Verified:** 2026-10-24, the directories' prices UNVERIFIED.
- **r/ClaudeAI**, rules as the user pasted them on 2026-10-28. Rule 7 encourages showcasing a project
  built with Claude or Claude Code, or for Claude, by you, when the post has:
  - what was built, how Claude helped "in detail", and what it does;
  - "free to try", said outright;
  - minimal promotional language;
  - no referral links, so no `?ref=` tag (it could read as one), and the venue counts as `direct`.

  Posts on the feed need the poster's karma over 100. Other rules: relevant flair (9), no vote
  manipulation (10), constructive and not shared recently (3). **Fit: high** for agents, through Claude
  users. The kit is at `temp/distribution/reddit-claudeai/`. **Dropped 2026-11-08:** it is his own post, gated on
  his karma, and he works only venues where his part is a yes.
- **Reddit, UNVERIFIED** (secondary sources): r/openclaw (self-promotion "not allowed without mod
  approval", a Showcase flair), r/AI_Agents (projects in the weekly project thread), r/LocalLLaMA (1 in
  10), r/mcp (ask the mods first).
- **Neighbors, not venues:** Agentic Kingdoms (agentickingdoms.com, a kingdom-war MMO where agents play
  beside people, guest join with no key; beta 2026-10-23) and OpenClawCity (openclawcity.ai, a
  persistent city with judged challenges, whose operators watch their own agent) court the same
  operators. Found 2026-11-11, with where each is listed: Golemreach (a tile MMO for people and agents; MCP Market),
  Clawville and Kradleverse (an agent life game, agents in Minecraft; the OpenClaw skills list), Tidewrath (an agent
  roguelike MMO; mcpservers.org). SpaceMolt's history is the precedent: "a handful" of agents after its Show HN (11 points),
  394 sign-ups in one day once Ars Technica and PC Gamer wrote it up.

### Directory and list placements
- **Fit:** Low individually, but they accumulate, they are permanent, and they are pure link-out. Each form below
  takes a plain URL, so each can carry its own `?ref=` tag. Researched 2026-11-08 against each venue's own pages;
  none of them bans AI-written submissions, and non-free assets disqualify none of them.
- **OSGL, the Open Source Games List** (Trilarion/opensourcegames, 1,114 stars, and its site): **high** for
  open-source fans. A PR adding `entries/thingspool.md` from `template.md`; a game must be at least beta with
  something playable, its code public under a FOSS license. First keyword a category (`simulation`, as
  Infiniminer), `Apache-2.0` a known license, and "Assets license: Custom (…)" has precedent (Civic Nightmare,
  08-19). Merges in batches (08-17, 09-06, 09-20, 10-10), entry PRs waiting since 10-24. An open proposal (#504)
  would require projects six months old. Kit at `temp/distribution/osgl/`. **Submitted 2026-11-08** (PR #507).
- **michelpereira/awesome-open-source-games** (3.4k stars): Browser-Based › Sandbox, `[Name](link) - Description.`
  Its rule asks for 40 stars and 30 days; the repo has 1 star, and the rule is applied loosely (Parlour merged at
  6), but some PRs have sat since July. A gamble.
- **Forms with no account** (the assistant fills, he says yes): **Indielisted** (indielisted.com/submit: URL, up
  to three categories such as Multiplayer and Creative, optional text of **200 characters at most**, which the
  field cuts silently, "It's my project"; free review "can take up to 28 days"; free, independent, no adult
  content; 57+ listings, reach unknown; **submitted 2026-11-08**); **Neon Gamewall** (neongamewall.com/submit: name, creator, URL,
  optional pitch; "We never host or embed your game"; centered on AI-made games but "unusual indie games are
  welcome too"; 6 of 78 suggestions posted, its top game about 1,950 clicks a week; an unlabeled "Website" field
  is a trap for bots, left empty; **submitted 2026-11-08**); **Zadely** (zadely.com): dead since 2026-11-11, see
  Lane 3.
- **browse.games** (re-read 2026-11-11): not tiny, with categories of hundreds of games and over a thousand in some,
  "No ads. No paid placement." Rankings come from likes, plays and freshness. "Anyone signed in can submit any browser
  game", 3 a day per account, each reviewed by an admin "usually within a day or two"; every decision is in its public
  audit log (`/audit`). The form takes a title (120), a game URL, a thumbnail URL (left empty, it comes from the page's
  Open Graph image), a description and how to play (4,000 each, Markdown), iframe or "Link only", free or paid, three
  flags (landscape, mobile-only, daily), categories (no sandbox: Simulation is the nearest) and tags from its own list.
  An owner can claim a listing by a DNS TXT record and then edit it through review. He signed in with GitHub on
  2026-11-11; **submitted that day** (submission #96; see the ledger). **Plaxzy** renders nothing without a browser
  (unread).
- **browsergames.top** (363 games): its "form" opens the sender's mail app, so it is an email from his account
  (workable since 2026-11-11: an email from his Gmail is Lane B). Its
  criteria (browser, persistent, multiplayer) fit, but its genres (RPG, strategy, nation sims, MUDs…) have no
  sandbox. Medium-low.
- **mesh3d.gallery** (a Three.js showcase, 340+ entries, mostly studio sites): URL and a note, with a CAPTCHA he
  must solve himself.
- **AlternativeTo:** an account with a verified email first, then "Suggest new application"; a backlog of "several
  thousand apps", and "Our standard for games is higher"; descriptions may not contain links; a square icon of 280
  px or more is suggested (his largest square logo is 150 px). Pages to list it against: Mozilla Hubs (shut down
  2024-05-31, 15 alternatives), Roblox, Second Life, Minecraft Classic (only one alternative, none on the web).
- **Not for this game:** lappemic/awesome-ai-built-games and Player1AI require that AI tools wrote most of the
  code, which ThingsPool's history doesn't show. bobeff/open-source-games is its owner's bookmarks (no merge since
  02-25); proyecto26/awesome-jsgames merges about every eight months; leereilly/games is archived;
  M3-org/awesome-metaverse dormant since 2024-09; AxiomeCG/awesome-threejs and meshula/awesome-voxel have no games
  section; sjfricke/awesome-webgl takes WebGL case-study articles only. GAMES.GG's free listing names no browser
  platform. Startup directories (BetaList, Uneed, Fazier, SaaSHub, opensourcealternative.to) want payment, a
  backlink, a launch day or self-hosting. Experiments with Google's submit page answers 404. GitHub Explore's Web
  games collection (github.com/collections/web-games): its pull-request template has the submitter confirm "This
  change is not self-promotion", and its last addition was in 2024-10 (re-read 2026-11-11).
  herrherrmann/awesome-multiplayer-games is for local and LAN play, and GitHub's other browser-game lists hold under
  ten stars each.
- **GitHub topics:** 19 of 20 used; `threejs`, `webgl` and `voxel` are missing, but topic pages sort by stars, so
  the effect is tiny.
- **Unverified:** IndieDB (403 to automated reads), threejsresources.com ("Free submissions · reviewed within 7
  days").
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
- **Rules and gotchas:** Both take uploaded builds only, never an outbound link: Newgrounds shows an SWF or HTML5
  zip in an iframe, and Game Jolt's builds are uploaded files (a work-in-progress page may have none; its thumbnail
  is 16:9, at least 588×331). So both sit in this lane. **Verified:** 2026-11-08 (Game Jolt's own help docs, last
  updated 2022).

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

### Smithery, OpenTools, and dormant lists
Smithery shut down its proxy, accounts, CLI and publishing on 2026-10-31 (now part of Arcade; see Lane 1).
OpenTools retired its CLI in favor of the official registry. appcypher/awesome-mcp-servers and leereilly/games
are archived. **Verified:** 2026-11-08.

### Zadely
A directory of AI-made and indie browser games (zadely.com), whose free review is an email to its curator. **Not for
this game:** on 2026-11-11, opening its submit page in his Chrome sent the tab, within two seconds, to a betting
affiliate's redirect (reffpa.com, "promotions/wheel-bet"). curl had read the same page cleanly, so the redirect comes
from what runs in the browser, most likely its ads. A listing there would send players through it. Its approved kit
was never sent. **Verified:** 2026-11-11.

---

## Not yet researched

Leads worth a future survey, recorded so they are not lost: university and hobbyist metaverse or virtual-world
communities; Bluesky and Mastodon (gamedev.place) gamedev circles; generative-art communities. Browser-game
directories, creative-coding showcases and classroom-tool directories were surveyed on 2026-11-08 (see "Directory
and list placements"; the classroom ones don't fit: ISTE's index is for school districts, and open chat with
strangers is a likely blocker). On 2026-11-11: lists of agent skills on GitHub, more MCP directories and newsletters,
GitHub's own collection of web games and other game lists, and a few more browser-game directories (see their
entries). Since 2026-11-08 the user wants only venues the assistant can work with his yes or
no alone, so a lead that needs him to post, write or make images is recorded but not worked.

For the AI-agents angle (see SKILL.md), added 2026-10-20 and not yet verified:
- AI-curious subreddits (r/mcp, r/artificial, r/ClaudeAI, r/AI_Agents, r/LocalLLaMA), each to be
  checked for self-promotion rules and for rules on AI-written posts;
- agent forums where agents themselves post (Moltbook, The Colony, 4claw). There, posting is the user's
  agent's act, and the rules for each venue's own agents apply.

The MCP server directories were researched on 2026-10-20 and now have their own entry in Lane 1. The
agent forums, the operator communities and the connector directories were researched on 2026-10-24,
and the subreddits' rules read only at second hand; all are in Lane 1 now.
