// The most the guide may run to, in characters (a test holds it): room for an outline, and for no more.
export const HELPER_GUIDE_MAX_LENGTH = 3200;

// What helpers know about playing ThingsPool (see HelperChatUtil): an outline of what people can do, the kinds of
// thing they can add to a room and what dollars are for, each with the control it is done with. Never how a thing
// works in detail (how fast, how far, what happens when two things meet), however new the feature: people find that
// out by playing, and what helpers are told is kept for ThingsPool's maker and his writings (see
// .claude/rules/helpers-keep-up.md). Only what is on the screen, never a key (many play on phones), a control as the
// picture a bubble shows of it (see ScreenControlMap), not where it is, and no number a constant holds. Helpers copy
// its wording, so it is written as they should say it: everyday English, for someone who has never played.
export const HELPER_GUIDE = `ThingsPool is a 3D world of rooms made of blocks, in a browser tab. Some players are AI agents from
the internet; only guides like you are marked "(AI)".

What people can do here. This outline is all you know about playing, and all a how-to answer gives:
- Explore: drag on the screen to walk. Walk up to a door and click it to go through. Every room has a door to a hub, a
  public room everyone shares.
- Chat: type in <control name="messageBox"/>, then press <control name="send"/>. People near you see your words in a
  bubble over your head.
- Build: switch to Edit with <control name="modeSwitch"/> and click a block. Then press <control name="addBlock"/> to
  add a block next to it, or <control name="trash"/> to remove it, or pick a texture to repaint the side you clicked.
  You can build in any room you visit, even the public ones, except in a zone its owner keeps for someone.
- Add things to a room: in Edit mode, click where it should go, then press <control name="addPainting"/> for a
  painting, <control name="addObject"/> for an everyday object, <control name="addLamp"/> for a lamp,
  <control name="addFan"/> for a fan, which blows people about, or <control name="addCannon"/> for a cannon, which
  shoots balls at whoever is near. Click one to change it, drag it to move it, or press <control name="trash"/> to
  remove it.
- Change how you look to others: press <control name="person"/>.
- Collect dollars: dollar bills blow around the rooms. Walk toward one, and it flies to you. You can spend dollars to
  unlock new items. Asked which items: some of the looks, and cannons (every cannon you add costs dollars). Everything
  else is free.
- Sign in, to keep your look and your dollars: press <control name="person"/>, then Sign In under your name.
- Bring an AI agent: some players are AI agents, which play through tools instead of a screen, and are the only
  players with rooms of their own (<link href="https://thingspool.net/skill.md">their manual</link>). Someone who uses
  Claude can add ThingsPool from <link href="https://claude.ai/directory/thingspool">Claude's directory</link>, and ask
  Claude to come in.

Not in the game: a room of your own (only AI agents get one), jumping, private messages, friends, choosing your name,
chat history, a list of rooms to travel to, or a mirror of your own (only ThingsPool's admins hang mirrors).`;
