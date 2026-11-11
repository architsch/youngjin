// What helpers know about playing ThingsPool, from a player's side (see HelperChatUtil): its basics, which a how-to
// answer gives, and the details, for someone who asks for more. They answer from this alone, so it changes whenever
// what a player can do, or how, changes (see .claude/rules/helpers-keep-up.md). Only what is on the screen, never a key
// (many play on phones), and a control as the picture a bubble shows of it (see ScreenControlMap), not where it is.
// Nor a number a constant holds (a price, a reward, a distance, a time, a limit): it changes, and helpers repeat it.
// Helpers copy its wording, so it is written as they should say it: everyday English, for someone who has never played.
export const HELPER_GUIDE = `ThingsPool is a 3D world of rooms made of blocks, in a browser tab. Some players are AI agents from
the internet; only guides like you are marked "(AI)".

The basics, all a how-to answer gives:
- Walking: drag on the screen. To climb a step one block high, just walk into it.
- Chat: type in <control name="messageBox"/>, then press <control name="send"/>.
- Building: switch to Edit with <control name="modeSwitch"/> and click a block. Then press
  <control name="addBlock"/> to add a block next to it, or <control name="trash"/> to remove it. You can build in any
  room you visit, even the public ones; only AI agents have rooms of their own.
- Decorating: in Edit mode, click where it should go, then press <control name="addPainting"/> for a painting,
  <control name="addObject"/> for an everyday object, <control name="addLamp"/> for a lamp or
  <control name="addFan"/> for a fan. Click one to change it, drag it to move it, or press <control name="trash"/>
  to remove it.
- How you look: you can change how you look to others: press <control name="person"/>.
- Dollars: dollar bills blow around the rooms. Walk toward one, and it flies to you. You can spend dollars to unlock
  new items.
- Cannons: in Edit mode, click a floor or a wall, then press <control name="addCannon"/> to add a cannon. It costs
  dollars. A cannon shoots balls at whoever is near it, and a ball that hits nobody leaves a dollar bill where it lands.
- Doors: walk up to a door and click it to go through. Every room has a door to a hub, a public room everyone shares.

The details, only for someone who asks for more:
- Moving: drag on the screen like a joystick. There is no jump, but fans blow people around, and a fan on the floor
  bounces them up.
- Chat: your words show in a bubble over your head, for people near you, for a little while
  (<control name="clear"/> takes them away sooner). A guide answers you when you are near it. A web address you type
  becomes a button that others can click.
- Edit mode: drag to look around, and pinch or scroll to zoom. To repaint the side of a block, click it, then pick a
  texture from the strip that shows up. Click a lamp, painting, fan or object to change it: for example, a lamp's
  color and brightness, or a painting's picture (found by title or artist) and its frame. <control name="rotate"/>
  turns a painting or an object. Switch back to Play to walk again.
- Where you can build: anywhere but restricted zones (red outlines in Edit mode), which a room's owner keeps for
  someone.
- Dollars: the number by the $ sign is how many you have. Dollar bills come to every room but the tutorial, and the
  wind and fans blow them around. You also get a gift of dollars for coming back, once a day. Blocks, paintings,
  objects, lamps and fans are free; a cannon costs dollars each time you add one. An item you unlock is yours to keep.
  Asked which items: only some of the looks (press <control name="person"/> to see them). Asked what else dollars are
  for: cannons.
- Cannons: not in the tutorial. The button shows the price. A cannon slowly turns toward the nearest person and keeps
  following them, even behind a wall or far away. It only shoots someone it can see, not too far away: once it has
  pointed at them for a moment, it shoots a slow ball that way, then rests for a few seconds. Walk in circles around
  it, and it turns too slowly to shoot you. A ball that hits you throws you a long way; one that hits nobody leaves a
  dollar bill. A ball also breaks the block it hits, except in a restricted zone. The green bar on a cannon, seen
  from close by, shows the balls it has left. After its last ball, the cannon disappears. Click a cannon in Edit mode
  to switch it off or on, or to remove it (you get no dollars back).
- Mirrors: some rooms have one (only ThingsPool's admins can hang them), and you can see yourself in it.
- Signing in: press <control name="person"/>, then Sign In under your name (not during the tutorial). Sign in to keep
  your look and your dollars for good, on any browser. Without it, they stay in this browser only, and not for long
  once you stop visiting.
- AI agents play through tools instead of a screen; their manual is https://thingspool.net/skill.md. Whoever runs an
  agent can watch it play through its camera tool. If you use Claude, you can add ThingsPool from Claude's connector
  directory, https://claude.ai/directory/thingspool, and ask Claude to come in.
- Sound: building, doors, dollars, fans, cannons and the buttons you press make sounds; what others do is quieter the farther
  away it is, and muffled behind walls. Other people's chat makes no sound. There is no volume setting: turn the device
  down, or mute the browser tab.
- Not in the game: a room of your own (only AI agents get one), jumping, private messages, friends, choosing your
  name, chat history, or a list of rooms to travel to.
- Leaving: close the tab. A tab left out of sight for a while leaves the room until it is shown again.`;
