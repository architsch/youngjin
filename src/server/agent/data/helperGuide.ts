import { AWAY_DISCONNECT_DELAY_MS, MINUTE_IN_MS } from "../../../shared/system/sharedConstants";

// What helpers know about playing ThingsPool, from a player's side (see HelperChatUtil): its basics, which a how-to
// answer gives, and the details, for someone who asks for more. They answer from this alone, so it changes whenever
// what a player can do, or how, changes (see .claude/rules/agents-keep-up.md). Only what is on the screen, never a key
// (many play on phones), and a control as the picture a bubble shows of it (see ScreenControlMap), not where it is.
export const HELPER_GUIDE = `ThingsPool is a 3D world of rooms made of blocks, in a browser tab. Some players are AI agents from
the internet; only guides like you are marked "(AI)".

The basics, all a how-to answer gives:
- Walking: drag on the screen. Walk into a one-block step to climb it.
- Chat: type your words in <control name="messageBox"/>, then press <control name="send"/>.
- Building: switch to Edit with <control name="modeSwitch"/>, click a block's face, then <control name="addBlock"/>
  to add a block, or <control name="trash"/> to remove it. People build in the rooms they visit, hubs included; nobody
  but an AI agent has a room of their own.
- Adding things: in Edit mode, select a face, then <control name="addPainting"/> (a painting),
  <control name="addObject"/> (an everyday object), <control name="addLamp"/> (a lamp) or <control name="addFan"/>
  (a fan). Select a thing to change it, drag it to move it, or remove it with <control name="trash"/>.
- A new look: in Edit mode, click yourself.
- Doors: walk up to one and click it. Every room has a door to a hub, a public room everyone shares.

The details, only for someone who asks for more:
- Moving (Play mode): press on the screen and drag, like a joystick: up walks forward, down walks back, left and
  right turn. There is no jump. Fans blow people around, and upward ones bounce them up.
- Chat: 72 characters at most. The words show in a bubble over your head to people near you, until you send another
  or clear it with <control name="clear"/>. Of several guides near you, the one you face answers. A web address typed
  there becomes a link: a button in the bubble that others click to open it, a page of ThingsPool's own website over
  the game and any other in a new tab, and a ThingsPool room by going there.
- Edit mode: drag to look around, and zoom with a pinch, the mouse wheel or the slider. Click a block's face, or a
  thing, to select it. The strip of textures under the tools repaints the selected face. A thing goes on the face it
  is added to, so a fan on a floor blows upward. Select a thing to change it: a lamp's color, brightness and reach; a
  fan's color and blades; a painting's picture (found by title or artist) and frame; an everyday object's picture.
  Paintings and everyday objects turn with <control name="rotate"/>. A mistake is taken away with
  <control name="trash"/>. Switch back to Play to walk again.
- Where you can build: anywhere, hubs and agents' rooms included, except in restricted zones (red outlines in Edit
  mode), which a room's owner keeps for someone.
- Doors: one shows "Click to Enter" when you are close enough.
- Your character: choose a shape and color for each part. It is saved for next time.
- Mirrors: some rooms have one, which only ThingsPool's admins hang; it shows the room in front of it, you included.
- Signing in: <control name="person"/> (not during the tutorial) shows your name, with Sign In under it. Signing in
  keeps your character for good, on any browser, under your account's name; a guest's is kept in one browser, and
  not for long once it stops visiting. You come back to the room you were in.
- Agents play through tools rather than a screen, and their manual is https://thingspool.net/skill.md. An agent with a
  browser tool takes pictures through its camera tool, which whoever runs it can also open to watch it play.
- Not in the game: a room of your own (only AI agents get one), jumping, private messages, friends, choosing your
  name, chat history, or a list of rooms to travel to.
- Leaving: close the tab. A tab kept out of sight for ${AWAY_DISCONNECT_DELAY_MS / MINUTE_IN_MS} minutes (behind
  another tab, or minimized) leaves the room too, and rejoins it when shown again.`;
