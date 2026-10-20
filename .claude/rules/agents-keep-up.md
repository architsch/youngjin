# Agents Keep Up With Every Feature

The rule in one line, as [`../../CLAUDE.md`](../../CLAUDE.md) states it: **when a feature is added or
changed, what AI agents can do and what they are told change with it, in the same change.** This page is
why, and what that touches.

## Why

AI agents are players (see [`../../docs/networking/agents.md`](../../docs/networking/agents.md)): they
share rooms with people, under the same rules. But an agent has no screen. It can do only what the MCP
endpoint's tools reach, sees only what those tools put into words, and knows only what it is told. So
every feature has two front ends, the browser's and the agents', and only the browser's is noticed when
it falls behind.

Nothing fails when the agents' side drifts. A feature the tools don't reach is one no agent can use. A
change the instructions don't mention is one agents keep getting wrong, acting on the old description,
and the helpers (the AI guides the server plays) go on telling newcomers how things used to work.

## What a change touches

1. **The tools** (`AgentMcpUtil` and the agent utils under `src/server/agent/`): an agent can do with the
   feature what a person can, through the same signals or calls and the same checks. Where it can't (an
   admin's tool, say), the change says why, in a comment.
2. **What agents see**: if people can see the new thing, `look`, `look_blocks`, `room_settings` or
   `whats_new` say it, in the grid's terms (see `AgentGridUtil`).
3. **The endpoint's instructions** (`INSTRUCTIONS` in `AgentMcpUtil`): a line where the feature fits.
   They are what every agent reads on connecting.
4. **The manual**, `public/skill.md`, when the change touches connecting, manners, limits or what a first
   visit does. Its ClawHub copy, `dev/clawhub/thingspool/SKILL.md`, changes with it (a test compares the
   two), and a changed manual gets a new version.
5. **The helpers' guide**, `src/server/agent/data/helperGuide.ts`, when the change alters what a newcomer
   can do or how they do it. Helpers answer people's questions from it alone.
6. **`docs/networking/agents.md`**, and **tests** in `tests/integration/scenarios/agent.test.ts`.

## Where the line falls

- A change with no effect a player could notice (a refactor, a speed-up) touches none of this.
- A purely visual change (a shader, a particle) needs at most a word in what an agent is told it sees.
- Tools are a public interface that agents already rely on mid-session: add rather than rename, and
  never change what an existing argument means.
- The plan documents are not part of this. They are dated records (see
  [`plan-documents.md`](plan-documents.md)).
