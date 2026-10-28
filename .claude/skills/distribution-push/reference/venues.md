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
  AI-agents launch, as notes rather than copy (see above).

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
  ThingsPool has been listed since 2026-09-02 (see the ledger) and drew 3 views and 0 launches in eight weeks, and
  none of the 46 projects had a playtest report.
- **Mechanics:** a project page that opens the creator's own HTTPS page in a new tab, never an iframe, so it sits in
  the link-out lane. Fields: title, tagline, description, type (Game, App, Prototype; the catalog has a tab for
  each), category, content rating, tags, project URL, cover artwork, preview media. Review within two business days.
  Members file structured playtest reports (minutes played, device, what worked, what broke), the playtest page
  lists the projects with the fewest reports first, and anyone with an account may file one, developers included.
  A "Listed on DEAD.ARMY" badge exists for a README.
- **Rules and gotchas:** HTTPS with no mixed content; only your own work; "accurate project details". A changed
  destination can send a listing to security review. Its availability checker poses as an ordinary browser
  (2026-09-22 update), so each check of the app probably counts as a `direct` arrival.
- **Effort:** Low. **Verified:** 2026-10-28 (the For Devs, Playtest and Updates pages, and the user's dashboard).

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
days on: the same (296 downloads, 0 installs; the one real agent came from The Colony's post). Keep
the listings current, since they cost little, but never count one as distribution. Claude's
Connectors Directory is the exception to watch: people browse it inside Claude, and Claude can
suggest from it.

- **Official MCP Registry** (registry.modelcontextprotocol.io): published 2026-10-20 as
  `net.thingspool/thingspool` 1.0.0 from `server.json`, with `mcp-publisher` signed in by the
  thingspool.net DNS key. Several directories below copy from it, so it is the one to keep current.
- **Glama** (glama.ai/mcp/connectors): imports registry entries by itself. ThingsPool appeared at
  `glama.ai/mcp/connectors/net.thingspool/thingspool` within the hour, "Healthy", with all 25 tools and a
  tool-quality score being calculated. The owner may "claim ownership" by verifying the domain or a
  GitHub account, which adds control over the page; nothing else is needed. **Verified:** 2026-10-20.
- **PulseMCP** (pulsemcp.com/submit): "We are not accepting new MCP server or client submissions right
  now." It says to publish to the official registry first, and that "we will pick it up automatically
  once we are back". No date given. **Verified:** 2026-10-20. Still paused 2026-10-24 ("New server
  submissions and listing changes are still paused", updated 2026-09-03), and its newsletter, now The
  Agentic Loop, last went out 2026-05-20.
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
- **Smithery** (smithery.ai/new): takes a server by its public HTTPS address, or by
  `smithery mcp publish "<url>" -n @<org>/<name>`, and scans its tools (public servers scan without
  help). An auth-required server must support OAuth; ThingsPool's key is optional, so the scan works.
  **It relays:** its gateway proxies every connection, from Cloudflare Workers with the UA
  `SmitheryBot/1.0` (smithery.ai/docs/build/publish.md). So all its users would share one set of the
  per-address caps on registering (10 an hour; `guestCreationLimitUtil.ts`). Not before those limits
  go by agent or client rather than by address. **Verified:** 2026-10-24.
- **ClawHub** (clawhub.ai): the manual's MIT-0 copy, published 2026-10-20 as `thingspool` 1.1.0 with
  `npx clawhub@0.23.3` after the user's `login`. The scan's verdict was "clean", but ClawHub still held it
  as "pending publication" (hidden) an hour later, 19:41 to 20:39 KST: its own review. Its page will be
  `clawhub.ai/architsch/thingspool`. **Search** (2026-10-24, `clawhub search`): found for "sandbox
  world" and its name, not for "game", "3D sandbox", "virtual world", "multiplayer game" or "build with
  blocks". OpenClaw's bundled clawhub skill tells agents to prefer searching for *plugins*, and a bundle
  plugin can carry a streamable-http MCP config (docs.openclaw.ai/plugins/bundles). **Featured** is 16
  slots picked by 30-day installs with a maintainer's approval, and "not taking requests" (a maintainer,
  2026-06-15); **trending** ranks the last 24 UTC hours of installs.
- **Claude's Connectors Directory** (claude.ai/directory/manage → Submit new → MCP connector; needs a
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
  A custom connector (one on Free) can be prefilled by link:
  `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=ThingsPool&connectorUrl=https%3A%2F%2Fapp.thingspool.net%2Fmcp`.
  **Verified:** 2026-10-28 (claude.com/docs/connectors/building/submission and review-criteria, the
  Software Directory Policy).
- **OpenAI's plugin directory** (ChatGPT and Codex; platform.openai.com/plugins → Upload → With MCP):
  identity verification, a domain token at `/.well-known/openai-apps-challenge`, 5 positive and 3
  negative test cases, a privacy policy, explicit read-only, destructive and open-world hints on every
  tool, no keys or tokens in tool responses, and content suitable for 13 to 17. A UI is optional.
  ChatGPT "can't present custom API keys", so it needs OAuth or no auth. **Blocked** until OAuth exists
  (`register` hands back a key). **Verified:** 2026-10-24 (developers.openai.com plugin docs).
- **GitHub MCP Registry and VS Code's gallery** (github.com/mcp; the `@mcp` gallery reads the same
  list): curated by hand, not mirrored from the official registry: "onboarding a new server is still a
  manual curation process today" (GitHub staff, 2026-05-19). ThingsPool is not in it. A request goes in
  github.com/github/github-mcp-server/discussions/1257. Cheap, low odds. **Verified:** 2026-10-24.
- **MCP Market** (mcpmarket.com/submit): takes a GitHub repository URL; free in 4 to 6 weeks, or $29
  for 24 hours. Remote listings unclear, traffic unknown. Optional. **Verified:** 2026-10-24.

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
- **Moltbook** (moltbook.com): live (a new post every 30 to 40 s), Meta-owned since 2026-03-10. Only
  agents post; the human claims one with an email and a public post on X naming @moltbook. A new agent
  may post once every two hours for its first day. Rules: "Don't spam or self-promote excessively"; the
  terms forbid "unauthorized advertising". Submolts: m/builds ("Show what you made", about 2,600),
  m/openclaw-explorers (about 2,700), m/buildlogs, m/mcp, m/gaming. Link posts there have sent 1,000+
  agents to a site within a week (Zenity Labs, 2026-02). Posting is the user's own agent's act.
  **Fit: medium-high**; posts sink fast. **Verified:** 2026-10-24 (rules.md, skill.md v1.12.0).
- **4claw** (4claw.org): agents only; its skill.md says "Avoid self-promotion of products", and no board
  suits a game. **Fit: low.** **Verified:** 2026-10-24.
- **awesome-agent-native-social** (github.com/ColonistOne/awesome-agent-native-social, kept by The
  Colony's own agent): a list of social platforms where agents are first-class users, with a "Gaming &
  Play" section (League of Agents, OpenClawCity, The Crab Games). Criteria: first-class agent accounts,
  a documented agent-facing surface, live; "Browser-only platforms don't qualify". Entry format
  `- [Name](URL) — One-line neutral description.`, alphabetical; "Self-submissions are accepted; the
  affiliation is fine, the puffery isn't." A pull request. **Fit: high, but merges have stalled**
  (2026-10-28): 2 stars, last push 10-17, eight PRs open since 10-13 (one a game, Plazmi) and none merged. A PR
  would likely sit. Cheap, but last in line. **Verified:** 2026-10-28.
- **OpenClaw's community:** the forum's Build & Showcase category (community.openclaw.ai; 7 topics, a
  few dozen views each; "Don't post spam"): medium. Discord (about 100k members): #showcase is for "cool
  stuff you and your agent are actually doing together… Not for shilling your skill", self-promotion has
  its own channel, crypto banned; **UNVERIFIED** (secondary source). GitHub Discussions are off on the
  OpenClaw repositories.
- **MCP community:** the official Discord is for contributors and says to avoid "Service or product
  marketing" (none). The modelcontextprotocol GitHub Discussions' "Show and tell" is quiet (low).
  mcpnewsletter.com, a weekly from the r/MCPservers team, takes submissions by form or email (medium).
  **Verified:** 2026-10-24.
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
  users. The kit is at `temp/distribution/reddit-claudeai/`.
- **Reddit, UNVERIFIED** (secondary sources): r/openclaw (self-promotion "not allowed without mod
  approval", a Showcase flair), r/AI_Agents (projects in the weekly project thread), r/LocalLLaMA (1 in
  10), r/mcp (ask the mods first).
- **Neighbors, not venues:** Agentic Kingdoms (agentickingdoms.com, a kingdom-war MMO where agents play
  beside people, guest join with no key; beta 2026-10-23) and OpenClawCity (openclawcity.ai, a
  persistent city with judged challenges, whose operators watch their own agent) court the same
  operators. SpaceMolt's history is the precedent: "a handful" of agents after its Show HN (11 points),
  394 sign-ups in one day once Ars Technica and PC Gamer wrote it up.

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

For the AI-agents angle (see SKILL.md), added 2026-10-20 and not yet verified:
- AI-curious subreddits (r/mcp, r/artificial, r/ClaudeAI, r/AI_Agents, r/LocalLLaMA), each to be
  checked for self-promotion rules and for rules on AI-written posts;
- agent forums where agents themselves post (Moltbook, The Colony, 4claw). There, posting is the user's
  agent's act, and the rules for each venue's own agents apply.

The MCP server directories were researched on 2026-10-20 and now have their own entry in Lane 1. The
agent forums, the operator communities and the connector directories were researched on 2026-10-24,
and the subreddits' rules read only at second hand; all are in Lane 1 now.
