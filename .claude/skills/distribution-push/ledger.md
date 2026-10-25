# Distribution Ledger

A running record of every place ThingsPool has been submitted or posted, and what came of it.

**This file is history, not instructions.** Its rows record what actually happened. Never rewrite a
row to match a later understanding, and never delete one because it records a failure — a venue that
rejected the game, or produced no traffic, is the most useful thing in here. An audit of this
project's skills should leave this file alone.

Read it before every run. Its first job is preventing the same link being posted to the same
community twice, which is the single most damaging thing this skill can do.

## Columns

| Column | Meaning |
|---|---|
| Date | When it was posted, not when it was prepared |
| Venue | The registry entry in `reference/venues.md` |
| Destination | `app` or the dev-log page number linked |
| Ref tag | The `?ref=` slug used. `a-z0-9-_`, 32 chars max — the server drops everything else. This is the join key between this ledger and `funnelReport.js`, so it must match exactly |
| Post URL | Where the submission actually lives, once live |
| Status | `prepared` · `posted` · `removed` · `rejected` · `expired` |
| Result | Filled in on a later run: reception, traffic, what was learned |

`prepared` means a kit was built but the user has not sent it. A row sits at `prepared` until the
user confirms it went out — never promote a row on the assumption that they did it.

## Submissions

| Date | Venue | Destination | Ref tag | Post URL | Status | Result |
|---|---|---|---|---|---|---|
| 2026-08-22 | Hacker News — Show HN | app | `hn-show` | — | prepared | Kit at `temp/distribution/hn-show/`. Rules verified against showhn.html and newsguidelines.html the same day. Not sent: Show HN requires the author present in the comments for hours, so the hour is the user's to pick. 2026-09-24: the one `hn-show` arrival in the live funnel (cohort 2026-09-23) came from an assistant's plain-`curl` link check, not a visitor, so subtract it. A `linkcheck-test` source with one arrival was created the same way. |
| 2026-10-20 | MCP Registry (official) | MCP endpoint | — (an agent names its own source when it registers) | https://registry.modelcontextprotocol.io/v0/servers?search=thingspool | posted | Published by the assistant at the user's go-ahead: `net.thingspool/thingspool` 1.0.0, active. Glama mirrored it within the hour (glama.ai/mcp/connectors/net.thingspool/thingspool), and PulseMCP says it will once its submissions reopen. 2026-10-22: Glama shows 25 tools, "Healthy" (tested 10-21), "Ownership verified", tool-definition grade B (3.1/5; add_zone, move_object and remove_object rated C), and a description of its own rather than the registry's. Version 1.1.0, with the README's catchphrase as its description, prepared in `server.json`; publishing it was left to the user, who published it later that day (latest). Glama took the registry's description within the hour (its "Glama listing details as source of truth" switch is off), but kept the 10-20 grade and tool snapshot until the assistant, in the user's Chrome, ran Test Connection in its Admin tab: that re-indexed the 1.1.0 tools and queued the five changed ones for grading. Publisher profile (Youngjin Kang, thingspool.net, first-party, docs skill.md) and the support contact set at the user's word: profile 100%. 2026-10-23: 1.1.1 published by the assistant at the user's request (`mcp-publisher login dns` went through this time), with the AI-targeted one-liner as its description ("…and build all kinds of things"); latest and active at once. Glama still showed the 1.1.0 sentence minutes later. 2026-10-24, measured from the VPS's nginx log: in five days `/mcp` took 4,449 requests, about 1% from agents that went on to register, and all of those automated (see the ClawHub row). The rest came from about 40 self-declared directory crawlers, liveness probes and security scanners (mcpbeat alone 936), one monitor on OVH (975), and the assistant's launch-day checks. The one registration with no ref (10-22 16:29 KST, from Hangzhou) was the manual's curl example run word for word, name `YOUR-NAME`, with nothing after it. One connect handshake came from Anthropic's address range (10-21 21:22 KST, a claude.ai custom connector most likely) and never registered. GitHub's traffic page shows no referral from Glama or the registry. Glama: healthy, TDQS A (3.5/5), no usage figures shown. So far the listings reach machines, not operators. |
| 2026-10-20 | ClawHub | the manual's MIT-0 copy (skill `thingspool` 1.1.0) | `agent-clawhub` (if an agent follows the manual's example) | https://clawhub.ai/architsch/thingspool | posted | Published by the assistant after the user's `clawhub login`. The scan said "clean", but it was still hidden as "pending publication" at 20:39 KST, an hour on: ClawHub's own review. 2026-10-22: public, 73 downloads, 0 installs or stars. 1.2.0 published by the assistant at the user's request to sync the listings (the link line in Manners); clean and `latest` within minutes. Later that day, on its settings page at the user's word: categories Agents, Creative, Lifestyle (was Other; three at most, from a fixed list) and topics ai-agents, mcp-server, multiplayer, sandbox-game, metaverse (five at most). 2026-10-23: 1.2.1 published by the assistant at the user's request, its description and opening leading with the 3D sandbox; `latest` within minutes, scan "No suspicious patterns detected". 2026-10-24: 208 downloads, 0 installs, 0 stars. The three `agent-clawhub` arrivals in the live funnel (10-22, 10-23 and 10-24, each between 03:28 and 05:30 KST) were one automated daily run from Baidu Cloud addresses (180.76.12.x, curl/7.88.1): a new name and key each time (agent-claw-2026, ClaudeAI_26, claude-agent-23), about two minutes each (the hub, then home, about 19 blocks, one line to an empty room, gone). It passed the manual's own example ref, so the tag doesn't show that ClawHub sent it, and its rooms were deleted with its accounts a day later. No operator-driven agent yet. ClawHub's search (`clawhub search`) finds the skill for "sandbox world" and its name, but not for "game", "3D sandbox", "virtual world", "multiplayer game" or "build with blocks". |
| 2026-10-20 | mcp.so | MCP endpoint; the listing's website and Play links to the app | `mcp-so` for people, if the links carry it; an agent names its own source | — (queued for review) | posted | Submitted by the user, free, "Queued for review"; $39 would skip the queue and was not paid. The assistant had first assumed a free path, then wrongly called it paid only. 2026-10-22: still unlisted (mcp.so's search finds nothing). The queued entry (My submissions → Remote servers) had the old description; the assistant set the registry's sentence there at the user's go-ahead. Its overview already matched the README. Still queued, with its submission date unchanged. 2026-10-23: at the user's request, the assistant set the description to the registry's 1.1.1 sentence, and the overview's tagline and "What is ThingsPool?" part to the new README's (its `?ref=mcp-so` Play link kept). Saved, and still there after a reload; still queued, date unchanged. 2026-10-24: still unpublished (mcp.so/server/thingspool answers 404). |
| 2026-10-24 | The Colony — Get Reviewed | the manual (agents register with `ref` "colony"), the app (people) | `colony` | — | prepared | Kit at `temp/distribution/the-colony/`. Rules and limits read the same day (thecolony.cc/c/reviews, its skill.md, its terms). To go out after the manual 1.3.0 and endpoint 1.2.0 are deployed, from the user's own account, with the user there to answer reviewers. |

## Prior history, outside this ledger

Before this skill existed, promotion happened by hand: dev-log posts pasted to LinkedIn, Facebook, X
and Medium as each feature was finished. Those are not itemised here — no record of the individual
posts was kept — but the outcome is known and is recorded in `reference/venues.md` under that
venue: reach was poor, because the audience on those feeds is not looking for a game to play.

That is the baseline any push from here is measured against.
