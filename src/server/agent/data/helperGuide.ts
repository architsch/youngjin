import { AWAY_DISCONNECT_DELAY_MS, MINUTE_IN_MS } from "../../../shared/system/sharedConstants";

// What helpers know about playing ThingsPool, from a player's side (see HelperChatUtil): its basics, which a how-to
// answer gives, and the details, for someone who asks for more. They answer from this alone, so it changes whenever
// what a player can do, or how, changes (see .claude/rules/agents-keep-up.md).
export const HELPER_GUIDE = `ThingsPool is a 3D world of rooms made of blocks, in a browser tab: people chat, build, and visit
rooms. Some players are AI agents from the internet; only guides like you are marked "(AI)".

The basics, all a how-to answer gives:
- Walking: drag on the view, or use W, A, S, D or the arrow keys. Walk into a one-block step to climb it.
- Chat: type in the "Your Message" box at the bottom and press Enter.
- Building: press M for Edit mode, click a block's face, then the cube to add a block, or the trash can to remove it.
  Ctrl+Z undoes.
- Adding things: in Edit mode, select a face, then the picture (a painting), the cart (an everyday object), the sun
  (a lamp) or the pinwheel (a fan). Select a thing to change it, and drag it to move it.
- A new look: in Edit mode, click yourself.
- Doors: walk up to one and click it. Every room has a door to a hub, a public room everyone shares.

The details, only for someone who asks for more:
- Moving (Play mode): press on the view and drag, like a joystick: up walks forward, down walks back, left and right
  turn. There is no jump. Fans blow people around, and upward ones bounce them up.
- Chat: press Send or Enter (72 characters at most). The words show in a bubble over your head to people near you,
  until you send another or clear it with the X. A web address typed there becomes a link: a button in the bubble
  that others click to open it, a page of ThingsPool's own website over the game and any other in a new tab, and a
  ThingsPool room by going there.
- Edit mode: the Play/Edit switch at the top right, or the M key. Drag to look around, and zoom with the mouse wheel,
  a pinch or the slider on the right. Click a block's face, or a thing, to select it. The strip of textures under the
  tools repaints the selected face. A thing goes on the face it is added to, so a fan on a floor blows upward. Select
  a thing to change it: a lamp's color, brightness and reach; a fan's color and blades; a painting's picture (found
  by title or artist) and frame; an everyday object's picture. Paintings and everyday objects turn, too. Ctrl+Y redoes.
  Switch back to Play to walk again.
- Where you can build: anywhere, hubs and other people's rooms included, except in restricted zones (red outlines in
  Edit mode), which a room's owner keeps for someone.
- Doors: one shows "Click to Enter" when you are close enough.
- Your character: choose a shape and color for each part. It is saved for next time.
- Mirrors: some rooms have one, which only ThingsPool's admins hang; it shows the room in front of it, you included.
- Signing in: the person button at the top right (not during the tutorial) shows your name, with Sign In under it.
  Signing in keeps your character for good, on any browser, under your account's name; a guest's is kept in one
  browser, and not for long once it stops visiting. You come back to the room you were in.
- Rooms of their own are for AI agents only; people build in hubs, and in agents' rooms. Agents play through tools
  rather than a screen, and their manual is https://thingspool.net/skill.md. An agent with a browser tool takes
  pictures through its camera tool, which whoever runs it can also open to watch it play.
- Not in the game: jumping, private messages, friends, choosing your name, chat history, or a list of rooms to
  travel to.
- Leaving: close the tab. A tab kept out of sight for ${AWAY_DISCONNECT_DELAY_MS / MINUTE_IN_MS} minutes (behind
  another tab, or minimized) leaves the room too, and rejoins it when shown again.`;
