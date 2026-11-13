# Agents Keep Up With Every Feature

The rule in one line, as [`../../CLAUDE.md`](../../CLAUDE.md) states it: **when a feature is added or
changed, what AI agents can do over MCP and what they are told change with it, in the same change,
unasked.** This page is why, and what that touches. Its twin for the helpers, the NPCs played as AI
guides, is [`helpers-keep-up.md`](helpers-keep-up.md); most features change both.

## Why

AI agents are players (see [`../../docs/networking/agents.md`](../../docs/networking/agents.md)): they
share rooms with people, under the same rules. But an agent has no screen. It can do only what the MCP
endpoint's tools reach, sees only what those tools put into words, and knows only what it is told. So
every feature has two front ends, the browser's and the agents', and only the browser's is noticed when
it falls behind.

Nothing fails when the agents' side drifts. A feature the tools don't reach is one no agent can use. A
change the instructions don't mention is one agents keep getting wrong, acting on the old description.
And much of what they read is published apart from the server (the manual on the website and ClawHub,
the endpoint's entry in the MCP Registry, which directories copy), so a stale line there also reaches
agents that have not connected yet.

## What a change touches

1. **The tools** (`AgentMcpUtil` and the agent utils under `src/server/agent/`): an agent can do with the
   feature what a person can, through the same signals or calls and the same checks. Where it can't (an
   admin's tool, say), the change says why, in a comment. Each tool's title, description and arguments
   say what it does now, and a refusal says why, and what to do instead.
2. **What agents see**: if people can see the new thing, `look`, `look_blocks`, `room_settings`,
   `whats_new` or the tool it belongs to says it, in the grid's terms (see `AgentGridUtil`).
3. **The endpoint's instructions** (`INSTRUCTIONS` in `AgentMcpUtil`): a line where the feature fits.
   They are what every agent reads on connecting. A number agents act on (a price, a distance, a limit)
   is built into them, and into the tools' descriptions, from its constant, never typed by hand.
4. **The manual**, `public/skill.md`, when the change touches connecting, manners, limits or what a first
   visit does, or leaves anything it says untrue, its front matter's description (ClawHub's summary)
   included. Its ClawHub copy, `dev/clawhub/thingspool/SKILL.md`, changes with it (a test compares the
   two). The plugin package, `dev/plugin/thingspool`, takes the manual as its skill when it is built, so
   only the `version` in its two manifests follows the manual's (a test compares them), and its README
   where a change leaves it untrue. The manual names no number a constant holds (a price, a reward, a distance, a time, a limit): it
   is published apart from the server, so such a number would go stale; the instructions give them.
5. **`server.json`**, the endpoint's entry in the MCP Registry, whose description and header description
   stay true (Glama copies them), and the README's section for AI agents.
6. **`docs/networking/agents.md`**, and **tests** in `tests/integration/scenarios/agent.test.ts`.

Find every line that names the feature, by its new words and its old ones, in `INSTRUCTIONS`, the tools'
descriptions and the manual, not only where the feature now fits: a line made untrue is rewritten or
removed, and one saying something can't be done goes when it can.

## Versions

- **What changes them.** The endpoint's version (`server.json`'s `version` and the one `AgentMcpUtil`
  gives its `McpServer`; a test compares them) changes with its tools or instructions; the manual's (its
  front matter's `version` and its closing "Version" line, in both copies, and the plugin package's two
  manifests) with the manual. A new tool or feature is a minor version, new wording or a fix a patch.
- **Only a published version is bumped.** The user publishes both by hand, and until a version is out,
  later changes keep its number. Compare before bumping: the MCP Registry's is the entry marked
  `isLatest` in `curl -s "https://registry.modelcontextprotocol.io/v0/servers?search=net.thingspool/thingspool"`,
  and ClawHub's is `tags.latest` in `npx clawhub@0.23.3 inspect thingspool --json`. A version newer than
  the one published is still waiting (an upload ClawHub holds back isn't listed: ask when unsure).
- **The plugin package** goes out by building it into a clone of its own repository and pushing, over SSH:
  `git clone git@github.com:architsch/thingspool-plugin.git <scratch>`, then
  `node dev/scripts/plugin/buildPlugin.js <scratch>`, commit and push. What is out is the `version` in that
  repository's `plugin.json`; plugin directories that list it follow its `main` by themselves.
- **Nothing is published unasked**, to any of them.

## Where the line falls

- A change with no effect a player could notice (a refactor, a speed-up) touches none of this.
- A purely visual change (a shader, a particle) needs at most a word in what an agent is told it sees.
- Tools are a public interface that agents already rely on mid-session: add rather than rename, and
  never change what an existing argument means.
- Listings edited only on their own sites (Claude's connector directory, Glama's and mcp.so's pages) are
  the user's to change: when the change leaves one untrue, the hand-over says which (the
  `distribution-push` skill's ledger lists them).
- The hand-over says what changed on the agents' side, with the versions, or that the change needed
  nothing there, and why.
- The plan documents are not part of this. They are dated records (see
  [`plan-documents.md`](plan-documents.md)).
