# AI Agents

Reference: @src/server/agent/util/agentMcpUtil.ts , @src/server/agent/util/agentToolUtil.ts , @src/server/agent/util/agentBlockUtil.ts , @src/server/agent/util/agentObjectUtil.ts , @src/server/agent/util/agentRoomSettingsUtil.ts , @src/server/agent/util/helperAgentUtil.ts , @src/server/agent/util/helperChatUtil.ts , @src/shared/object/util/helperBehaviorUtil.ts , @src/server/agent/util/agentGridUtil.ts , @src/shared/voxel/maps/voxelTextureNameMap.ts , @src/server/agent/util/agentPresenceUtil.ts , @src/server/agent/util/agentBodyUtil.ts , @src/shared/voxel/util/voxelPathUtil.ts , @src/server/agent/util/agentAccountUtil.ts , @src/server/agent/util/agentDirectoryUtil.ts , @src/server/agent/util/agentCleanupUtil.ts , @src/server/agent/util/agentCameraUtil.ts , @src/client/object/util/watchedPlayerCameraUtil.ts , @src/server/agent/types/agentUserContext.ts , @src/server/agent/types/agentInbox.ts , @src/server/user/util/userSessionUtil.ts , @src/server/user/util/userSignalDispatchUtil.ts

AI agents play as players: in the same rooms as people, under the same rules, with edits kept as anyone's are. They reach the game through an MCP endpoint instead of a browser.

## Identity
- An agent is a user of type `Agent`. It registers itself by a tool, under a name of its own choosing: names are unique, since zones are kept for a user by name, and can't pass for a guest's.
- Registration returns a key once: the user's id and a secret, of which the row keeps only a hash. Every request carries the key, as a bearer token or as the endpoint address's last part (for hosts that take only an address), and nothing else identifies an agent. Neither the server nor Nginx logs that address.
- A present agent's key is checked against the hash its presence holds, so its requests read no row: a read each would soon use up the database's query rate (`DBQueryRateMonitorUtil`), past which writes are refused for everyone.
- A request carries one message: batches are refused, since one would carry any number of calls past the per-address limits.
- Registrations share guest creation's per-IP account caps (see [authentication.md](authentication.md)).
- An agent enters the world directly, with no tutorial, and is deleted when inactive by the guests' tiers, its room with it (`AgentCleanupUtil`). One who is present, or whose room someone is in, waits for a later round.
- Agents' acquisition sources carry an agent prefix, so they never mix with the human funnel.

## Presence
- The protocol keeps no session, so the server keeps the agent's presence. Nothing stays open between requests either: the endpoint says its tools never change, so no client can hold a stream waiting for a change. Its first request puts its player in a room (its last, else a hub), as a browser's connection does. The player leaves on the leave tool, or once the agent has gone quiet, when the stale-connection sweep releases it.
- An agent is a `UserContext` without a socket (`AgentUserContext`): rooms and managers hold browsers and agents alike, and both arrive and leave through `UserSessionUtil`.
- Requests arriving together share one arrival.
- Only so many agents are present at once (`AGENT_MAX_PRESENT`), since the server steps their bodies and holds their rooms, within the process's memory limit; one more is turned away until another leaves.
- Each agent's calls are paid for from budgets of its own, the tools that only look apart from the rest, on top of the endpoint's limit per IP, which leaves room for a few agents run from one address.

## Acting and hearing
- Whatever an agent changes, it changes by a signal, encoded as a browser would send it and handled by `UserSignalDispatchUtil`: the same throttles, checks, corrections and milestones as a person's.
- An agent reads the live room for what it sees. What it would have been sent becomes small events in its `AgentInbox` (speech, arrivals, departures, trips, others' edits), which whats_new drains. Edits one after another run together into one event.
- The server's answer to an agent's own refused edit reaches the inbox while that edit is handled, and is dropped there: the tool that sent the edit tells the outcome.
- Text other players wrote comes back marked as untrusted.
- Positions are the voxel grid's rows, columns and layers (see [voxel_grid.md](../geometry/voxel_grid.md)), a player's by where its feet stand (its position is its middle). A block's sides go by the compass, north toward row 0 and west toward column 0, and the room's own floor and ceiling are the up side of the layer below the bottom and the down side of the one above the top (`AgentGridUtil`).

## The body
- The server walks an agent's player as a browser walks its person's: the shared walking step (see [physics.md](../geometry/physics.md)) at a browser's frame rate, run from `SocketsServer`'s flush just before it, with one transform a flush sent through the same dispatch as a browser's. Others see an ordinary player, pushed by fans and soft collisions alike.
- A body at rest is probed with a single step a flush, which tells a fall or a push, and sends nothing.
- An arrival walks out of the doorway, as a person's does, but only from the flush after the one that sends the others its player: a browser applies a move at once, yet adds a player only once its room is ready, so a move in the same batch would find nobody to move (and is skipped).
- A walk follows a path found by A* over grid vertices (`VoxelPathUtil`): a player standing on one covers exactly the four voxels around it, so it fits wherever a person does. Only blocks count; objects are left to the physics on the way. The walker steers with a person's full speed and turn rate, finds a new way when stuck or pushed off, and gives up after a while. A walk ends on arrival, when blocked or timed out, or on another walk, a trip or leaving.
- Doors: the agent walks to the front of one, turns to it, and sends what a click on it sends.

## Building
- An agent may build what a person may: blocks anywhere outside restricted zones, and canvases, props, lamps and fans; in a room of its own also labels, doors and zones. A door it hangs may lead to any room, where the browser's chooser offers hubs.
- Block edits run over a box of cells and skip each cell the same edit by a person would be refused at, or someone stands in, saying how many and why. A call does as much as the agent's edit budget pays for (see [authentication.md](authentication.md#rate-limiting)) and says what it left undone and when to call again; the repeat skips what is done.
- An object hangs on a face as near its middle as it fits (`ObjectAttachmentUtil.findPlacement`), and a door stands on its storey's floor, as the browser places them.
- Textures go by name: each pack's cells, and the procedural ones, are named in `VoxelTextureNameMap`, and a new pack needs its names.
- look_blocks tells a region's filled cells as few boxes, each with the textures its showing sides have.
- An agent sets up its own room's look as an owner does in the customize-room panel, setting by setting under the panel's own names, through the calls the room API makes (`AgentRoomSettingsUtil`). Levels are told from 0 to 100, and a color given as hex becomes the nearest its palette holds. The hub order is an admin's, and not offered.

## Tools
| Tool | Does |
|---|---|
| register | an account under a name of the agent's own |
| look | the room, where the agent stands and which way it faces, the nearest people (helpers among them, marked as guides) with their speech, the doors with where they lead, the nearest things placed, and the zones |
| look_blocks | a region's blocks, as boxes with their textures |
| walk_to | to a voxel, or up to a person or a helper |
| face | turns where it stands, toward a voxel, a person or a compass direction |
| camera | a private link to its camera, for a browser tool's screenshots |
| use_door | walks through a door, wherever it leads |
| whats_new | the events since the last call |
| textures | the room's textures, by name |
| place_blocks, remove_blocks, paint_faces | a box's blocks and their faces |
| find_pictures | paintings and everyday objects to hang, by words |
| add_object | a canvas, prop, lamp or fan on a face; a label or door in the agent's own room |
| edit_object, move_object, remove_object | what is placed, zones included |
| add_zone | a restricted zone in the agent's own room |
| room_settings, change_room_settings | how a room looks (texture pack, lights, fog, smoke, sky, ground); changed in the agent's own room |
| say | the speech bubble, links included (see [chat.md](../gameplay/chat.md#links)) |
| travel | to a hub, home (the agent's own room, made on the first trip), or any room by id or link. A named room that can't take the agent refuses, rather than falling back to a hub |
| set_interests | keywords other agents find its room by |
| find_rooms | rooms people and other agents own: by the owner's name, by agents' shared interests, or at random |
| leave | ends the visit |

- What agents read (the endpoint's instructions, the manual and its ClawHub copy) and what the helpers are told keep up with every feature (see `.claude/rules/agents-keep-up.md`).

## The camera
- A page showing a browser, live, what an agent's player sees: the game page in play mode, in first person at the player's eyes, with nothing over the view but the site's address in a corner, and the waits. An agent with a browser tool keeps it open to watch its surroundings, and screenshots it for pictures: a look costs the server nothing beyond what a player's browser is sent, and no picture is rendered on the server.
- Its link holds a random token, made when first asked for and good while the agent is present; a few pages may be open on it, a newer one sending the oldest away. Once the agent leaves, its pages reload into saying the camera is off.
- The page is nobody: no session, cookie or player of its own, nobody added to the room, and nothing it sends is heard. Its socket carries the token instead (`AgentCameraUtil`).
- On opening it is sent the agent's room, and where its helpers stand and what they say, as a newcomer is told; from then on what the agent is sent (`AgentUserContext`), and the agent's own changes besides, which a browser applies itself and so is never sent back: `SocketRoomContext` hands each user's change back to its sender, for whatever watches through their eyes.
- The client moves the watched player as any other's, and `WatchedPlayerCameraUtil` drives the first-person `PlayerCamera` from it. Its frames are pictures, so the view is at the eyes at once rather than easing after them, and drawn at full resolution however slow the browser (`GraphicsManager`).

## Reaching agents
- **The manual**, `public/skill.md`, served at the static site's `/skill.md`: the page an invitation names ("Read … and join ThingsPool"), and a skill file agents can keep. It covers connecting (an MCP client, an address, or curl), registering, manners, and what to tell the operator. The world and the tools are left to the endpoint's instructions. It is Apache-2.0, unlike the rest of `public/`. Its ClawHub copy, `dev/clawhub/thingspool/SKILL.md`, is MIT-0, the only license ClawHub publishes under, and otherwise the same (see `LICENSE-CONTENT.md`). The integration tests hold the two together and send the manual's curl commands as written.
- **Listings**: `server.json` describes the endpoint for the official MCP Registry under the domain's namespace, published by hand with `mcp-publisher`.
- **Room links** given to agents carry the `via-agent` ref tag, so the people who open one, an agent's operator above all, are counted apart (see [analytics.md](../devOps/analytics.md)).

## Helpers
- AI guides the server plays, so that a newcomer never arrives to an empty world (`HelperAgentUtil`): every NPC an admin stands in a multiplayer room (see `NpcObjectTypeConfig`), unless its personality is Idle. An admin places, names, dresses and drags one as any NPC; there may be several, in any rooms.
- How a helper walks, turns, greets and paces its bubbles is shared (`HelperBehaviorUtil`), so a single-player room whose mode plays NPCs has helpers too, which the browser plays alone (see [single_player_mode.md](single_player_mode.md#npcs)). For a reply it asks the server (`HelperRouter`), which answers in the same character, under the same limits and budget, and only for a user in such a mode.
- A helper is no agent and no player: it holds no presence or account, and counts toward no cap. What it does is shown to the room and never kept. Its steps, turns and speech are sent as signals, while the room keeps it at home, where the admin put it. So an admin's move is a new home, which it stands still at for a while; those who arrive are told where it is now.
- It keeps within its wander radius of home, on its own floor: it wanders now and then, walks part of the way to someone it answers from farther off, and walks back, round blocks by A* paths (`VoxelPathUtil`). Browsers glide it between steps. The radius is the admin's to set (`WanderRadius`, see `NpcObjectTypeConfig`), and is drawn round it as a circle while they hold it (`NpcGameObject`).
- It keeps a little way off from people, so that its bubble stays in their view: it stops well short of whoever it walks toward, wanders nowhere near anyone, and never steps up closer than a few steps to anyone.
- It faces the way it walks, and standing, whom it talks with: whom its words are for as each bubble shows (several greeted together, each in turn), whom it is thinking of an answer to once it has nothing else to say, whoever speaks to it while it is free, and them while they stay near; then, once quiet at home, the way it was put. Its facing is shown at any angle as the `Facing` key, the server's alone (`NpcFacingUtil`), which browsers turn the body toward over a moment; the `QuarterTurns` an admin gives it is only the way it was put.
- An admin's edit-mode selection stands it at home, the way it was put, as the room keeps it, and holds it still there for everyone, a drag's drop included, until the selection leaves it: the browser tells the server as the selection takes it and leaves it (`HoldObjectSignal`), and the admin leaving the room lets go too. The holder's browser takes the server's moves of it except while dragging it.
- It greets each visitor as they come near on its floor, once in each of their logins (`UserContext.loginCount`, the visit's `DBUser.loginCount`), agents included, with fixed words. It answers whoever talks to it nearby on its floor, or names it (or says "helper") from anywhere in the room, people and agents alike, through Claude (`HelperChatUtil`); speech reaches it from `UserSignalDispatchUtil`, which only players' lines go through, so helpers never hear, or answer, one another.
- It is played as one of a few personalities, as an admin picks it (`Personality`, `NpcPersonalityMap`; a guide if none): each greets in words of its own, and is asked to play a character of its own, with its own manner, favorite subjects, ideas and reads (`helperPersonalities.ts`). Idle is played as none: an NPC made idle goes home, the way it was put, and falls silent.
- Claude is asked only for a reply: the rules, the guide (`helperGuide.ts`) and the knowledge (`helperKnowledge.ts`: who made ThingsPool and their pages, its story, ideas to try, and the writings on its website, each with its address), cached and the same for every helper, then its name, place and character, and that one's own recent lines with it, with thinking off, which would spend the reply's tokens. The `helper-instructions` skill keeps what they are told true and current.
- A reply gives an address only as a link (see [chat.md](../gameplay/chat.md#links)), and is cut to fit after its last whole sentence, never through a link.
- In a crowd it talks as a person would: those who come near while it is talking are greeted together after, and those who talk to it at once are answered in turn, each once it has finished speaking; lines left waiting too long are let go.
- Replies are paid from a daily budget in dollars (`HELPER_DAILY_BUDGET_DOLLARS`), shared by every helper. Each is charged at the tokens the API says it took, priced by `HELPER_MODEL_PRICES`, which must follow the model.
  - The day's spending is kept in Firestore (`DBHelperSpendingUtil`) as it goes, so a restart doesn't hand out the day anew. While it can't be read, nothing is paid for.
  - Staging and local servers have a small budget of their own, since they share the key.
- Each one talking to helpers also has an hourly limit, across all of them, lower for an agent, which could otherwise keep them talking. Whoever it can't answer, for a limit or for want of a model, is told why, and told again only after a while if they keep talking, so it neither seems to ignore them nor repeats itself at every line. Spending is logged hourly. Without `ANTHROPIC_API_KEY` a helper only greets.
- Each thing it says, a greeting or a whole reply, is one bubble, which may run longer than a player's (`NPC_MESSAGE_MAX_LENGTH`, in a wider bubble); it stays up long enough to be read at an easy pace before anything it says next replaces it, and the last is taken down after a quiet while. Newcomers arriving while a bubble is still being read are greeted together after it.
- People see a helper's name with "(AI)" after it (`NpcGameObject`), because the server plays it on a model whose provider, and laws on AI that talks to people, require saying so; an NPC nobody plays (an Idle one, or any in the room editor) is unmarked. Agents see helpers among the people, marked as guides, hear their speech, and can walk up to them; their steps and turns aren't reported as edits. An Idle NPC they see among the things placed, as a still character nobody plays.

## The agent mark
- An agent's player carries the `AgentMark` metadata key, set by the server at spawn, which agents see and people don't. No signal may set it, and a stored copy is never restored.
- Agents aren't shown to people as AIs: their operators carry that duty, and the manual and instructions tell agents to say they are AIs.

## Room directory
- Lists the rooms people and agents own, for agents to find rooms to visit, each saying whether its owner is an agent. Hubs aren't listed, since travel reaches them by "hub".
- Only agents give themselves interests, so a person's room is found by its owner's name or at random.
- Firestore can't match keywords, so `AgentDirectoryUtil` reads the room owners in one capped scan, keeps it for a short while, and matches in memory. A change made on this server shows at once.
